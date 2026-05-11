// GitHub OAuth at /verify. Replaces the Turnstile-only checkpoint.
//
// Why GitHub:
//   Turnstile only proves a human is on the page. It does nothing about
//   the same human running the device-code flow over and over to mint
//   fresh tokens. Binding every account to a UNIQUE github_user_id makes
//   "delete token, get new token" reset nothing — the same account is
//   recycled, all quotas stick. Creating a *second* GitHub account has
//   real friction (rate limits, email verification, the slow ramp on a
//   throwaway account's reputation) which is the point.
//
// Flow:
//   1. Human lands on /verify?code=<verify_code>
//   2. Clicks "Sign in with GitHub" → GET /auth/github/start?code=<verify_code>
//   3. Worker redirects to github.com/login/oauth/authorize, state=<verify_code>
//   4. GitHub bounces back to /auth/github/callback?code=<gh_code>&state=<verify_code>
//   5. Worker exchanges gh_code for an access token, fetches /user
//   6. Lookup user by github_user_id; create one if it's the first time
//   7. Mark the verification row verified + attach api_token; render the
//      shared success view. The agent's poll picks up the token (one-time
//      read, same as before).
//
// Dev mock:
//   When GITHUB_CLIENT_ID === "dev-mock", /auth/github/start skips the
//   round-trip to github.com and synthesizes a deterministic github
//   identity from a `mock_login` query param. The e2e script uses this.
//   Production binds the real client id/secret and the mock path is
//   unreachable.

import { Hono } from "hono";
import type { Bindings, Variables } from "./types";
import {
  hashToken,
  newApiToken,
  newUserId,
} from "./crypto";
import { createUser, getUserByGitHubId, insertToken, rateLimit } from "./db";
import { verifyPage } from "./views/verify";

const DEV_MOCK = "dev-mock";

export const githubOAuthRoutes = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Start: bounce the human to GitHub (or the dev-mock callback).
githubOAuthRoutes.get("/auth/github/start", async (c) => {
  const code = (c.req.query("code") ?? "").trim().toUpperCase();
  if (!code) {
    return c.html(
      verifyPage(c.env, {
        code: "",
        error: "Missing verification code. Open the link your agent printed.",
      }),
      400
    );
  }

  const verification = await c.env.DB.prepare(
    `SELECT code, status, expires_at FROM verifications WHERE code = ?`
  )
    .bind(code)
    .first<{ code: string; status: string; expires_at: number }>();

  if (!verification) {
    return c.html(
      verifyPage(c.env, {
        code,
        error: `No pending request for "${code}". Did the agent print a different code?`,
      }),
      404
    );
  }
  if (verification.expires_at < Date.now()) {
    return c.html(
      verifyPage(c.env, {
        code,
        error: "This code has expired. Ask your agent to start a new flow.",
      }),
      410
    );
  }
  if (verification.status !== "pending") {
    return c.html(
      verifyPage(c.env, {
        code,
        error: `This code is already ${verification.status}.`,
      }),
      409
    );
  }

  // Dev mock: short-circuit github.com so e2e + offline dev still works.
  if (c.env.GITHUB_CLIENT_ID === DEV_MOCK) {
    const mockLogin = (c.req.query("mock_login") ?? "dev-user").slice(0, 40);
    const cbUrl = new URL(`${c.env.PUBLIC_URL}/auth/github/callback`);
    cbUrl.searchParams.set("state", code);
    cbUrl.searchParams.set("code", "mock");
    cbUrl.searchParams.set("mock_login", mockLogin);
    return c.redirect(cbUrl.toString(), 302);
  }

  const redirectUri = `${c.env.PUBLIC_URL}/auth/github/callback`;
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", c.env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", code);
  authorize.searchParams.set("allow_signup", "true");
  return c.redirect(authorize.toString(), 302);
});

// Callback: exchange the gh code, look up / create the user, mint the
// api token, mark verification verified.
githubOAuthRoutes.get("/auth/github/callback", async (c) => {
  const state = (c.req.query("state") ?? "").trim().toUpperCase();
  const ghCode = c.req.query("code") ?? "";
  const ghError = c.req.query("error");

  if (!state) {
    return c.html(
      verifyPage(c.env, {
        code: "",
        error: "OAuth callback missing state. Start the flow again.",
      }),
      400
    );
  }
  if (ghError) {
    return c.html(
      verifyPage(c.env, {
        code: state,
        error: `GitHub denied the sign-in (${ghError}). Try again.`,
      }),
      400
    );
  }
  if (!ghCode) {
    return c.html(
      verifyPage(c.env, {
        code: state,
        error: "OAuth callback missing code. Start the flow again.",
      }),
      400
    );
  }

  // Re-check the verification (state hasn't been verified/expired in the
  // ~few seconds the human was at github.com).
  const verification = await c.env.DB.prepare(
    `SELECT code, status, label, expires_at FROM verifications WHERE code = ?`
  )
    .bind(state)
    .first<{
      code: string;
      status: string;
      label: string | null;
      expires_at: number;
    }>();

  if (!verification) {
    return c.html(
      verifyPage(c.env, {
        code: state,
        error: `No pending request for "${state}". Did the agent print a different code?`,
      }),
      404
    );
  }
  if (verification.expires_at < Date.now()) {
    return c.html(
      verifyPage(c.env, {
        code: state,
        error: "This code has expired. Ask your agent to start a new flow.",
      }),
      410
    );
  }
  if (verification.status !== "pending") {
    return c.html(
      verifyPage(c.env, {
        code: state,
        error: `This code is already ${verification.status}.`,
      }),
      409
    );
  }

  // Cap callbacks per IP — exchanging codes against github.com is real
  // network spend, and a buggy agent retrying the callback shouldn't
  // hammer it.
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const rl = await rateLimit(c.env.DB, `gh:cb:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return c.html(
      verifyPage(c.env, {
        code: state,
        error: "Too many sign-in attempts. Try again in a minute.",
      }),
      429
    );
  }

  let githubUserId: number;
  let githubLogin: string;
  try {
    if (c.env.GITHUB_CLIENT_ID === DEV_MOCK) {
      githubLogin = (c.req.query("mock_login") ?? "dev-user").slice(0, 40);
      // Deterministic but per-login id, so two different mock_logins
      // create two different accounts. 32-bit space is plenty for tests.
      githubUserId = await stableMockId(githubLogin);
    } else {
      const exchanged = await exchangeCode(
        ghCode,
        c.env.GITHUB_CLIENT_ID,
        c.env.GITHUB_CLIENT_SECRET,
        `${c.env.PUBLIC_URL}/auth/github/callback`
      );
      const ghUser = await fetchGitHubUser(exchanged.access_token);
      githubUserId = ghUser.id;
      githubLogin = ghUser.login;
    }
  } catch (e) {
    console.error("github_oauth_failed", String(e));
    return c.html(
      verifyPage(c.env, {
        code: state,
        error: "Couldn't reach GitHub to complete sign-in. Try again.",
      }),
      502
    );
  }

  // Upsert by github_user_id.
  let user = await getUserByGitHubId(c.env.DB, githubUserId);
  let linked = false;
  if (user) {
    // Existing identity → fresh token, same user_id. This is the
    // "same human on a new device" path that used to require pasting
    // an existing token.
    linked = true;
  } else {
    const newId = newUserId();
    await createUser(c.env.DB, newId, githubLogin, {
      id: githubUserId,
      login: githubLogin,
    });
    user = {
      id: newId,
      display_name: githubLogin,
      created_at: Date.now(),
      github_user_id: githubUserId,
      github_login: githubLogin,
    };
  }

  const apiToken = newApiToken();
  const tokenHash = await hashToken(apiToken, c.env.TOKEN_PEPPER);
  await insertToken(c.env.DB, tokenHash, user.id, verification.label);

  await c.env.DB.prepare(
    `UPDATE verifications SET status = 'verified', user_id = ?, api_token = ? WHERE code = ?`
  )
    .bind(user.id, apiToken, state)
    .run();

  return c.html(
    verifyPage(c.env, {
      code: state,
      success: true,
      linked,
      githubLogin,
    })
  );
});

// ---------------------------------------------------------------------------

async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ access_token: string }> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`github token endpoint returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (json.error) {
    throw new Error(`github token error: ${json.error} ${json.error_description ?? ""}`);
  }
  if (!json.access_token) {
    throw new Error("github token response missing access_token");
  }
  return { access_token: json.access_token };
}

async function fetchGitHubUser(
  accessToken: string
): Promise<{ id: number; login: string }> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "htmlbin-oauth",
    },
  });
  if (!res.ok) {
    throw new Error(`github /user returned ${res.status}`);
  }
  const json = (await res.json()) as { id?: number; login?: string };
  if (typeof json.id !== "number" || typeof json.login !== "string") {
    throw new Error("github /user response missing id/login");
  }
  return { id: json.id, login: json.login };
}

// Dev-mock id: SHA-256(login) → first 4 bytes → uint32. Same login always
// resolves to the same id, different logins almost certainly don't collide.
async function stableMockId(login: string): Promise<number> {
  const buf = new TextEncoder().encode(login);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const v = new DataView(hash);
  // Bias the high bit off so the value comfortably fits in a SQLite INTEGER
  // and a JS number — and stays well below any plausible real GitHub id range.
  return v.getUint32(0) >>> 1;
}
