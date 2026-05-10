import { Hono } from "hono";
import type { Bindings, Variables } from "./types";
import { authRoutes } from "./auth";
import { apiRoutes } from "./prototypes";
import { buildOnboardText } from "./onboard";
import { landingPage } from "./views/landing";
import { verifyPage } from "./views/verify";
import { viewerPage, passwordGatePage } from "./views/viewer";
import { FAVICON_SVG } from "./views/favicon";
import { OG_SVG } from "./views/og-image";
import {
  agentCard,
  linkHeader,
  llmsTxt,
  openApiSpec,
  robotsTxt,
  sitemapXml,
} from "./discoverability";
import { STYLES_CSS } from "./styles";
import {
  hashToken,
  newApiToken,
  newUserId,
  signUnlockToken,
  verifyPassword,
  verifyUnlockToken,
} from "./crypto";
import {
  bumpViewCount,
  createUser,
  getPrototype,
  insertToken,
  listVersions,
} from "./db";
import { isValidSlug } from "./slug";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ----- Public landing -----------------------------------------------------
app.get("/", async (c) => {
  // Content-negotiation: agents asking for Markdown get the landing as
  // Markdown via Workers AI's toMarkdown. Same idea as Cloudflare's
  // "Markdown for Agents" pattern. Humans still get the regular HTML.
  const accept = c.req.header("Accept") ?? "";
  if (acceptsMarkdown(accept) || c.req.query("format") === "md") {
    return landingAsMarkdown(c);
  }
  c.header("Link", linkHeader(c.env.PUBLIC_URL));
  return c.html(landingPage(c.env));
});

// Explicit URL form for the markdown view of the landing — easy to
// discover, easy to link to from /api/onboard or llms.txt.
app.get("/index.md", (c) => landingAsMarkdown(c));

async function landingAsMarkdown(c: any): Promise<Response> {
  const cacheKey = `md:landing`;
  const cached = await c.env.PROTOTYPES_KV.get(cacheKey);
  if (cached) {
    return new Response(cached, { headers: mdHeaders() });
  }

  const html = landingPage(c.env);
  let markdown = "";
  try {
    const results = await c.env.AI.toMarkdown([
      { name: "index.html", blob: new Blob([html], { type: "text/html" }) },
    ]);
    markdown = results?.[0]?.data ?? "";
  } catch (e) {
    return c.json(
      {
        error: "markdown_unavailable",
        detail:
          "Markdown conversion requires Workers AI. Available in production; in `wrangler dev` use --remote.",
      },
      503
    );
  }

  // Landing copy changes rarely — cache 1 hour at the edge.
  c.executionCtx.waitUntil(
    c.env.PROTOTYPES_KV.put(cacheKey, markdown, { expirationTtl: 3600 })
  );
  return new Response(markdown, { headers: mdHeaders() });
}

function acceptsMarkdown(accept: string): boolean {
  // Look for text/markdown explicitly (and beat a wildcard text/* with HTML).
  const a = accept.toLowerCase();
  if (!a.includes("text/markdown")) return false;
  // If the client also accepts HTML at higher-or-equal weight, prefer HTML.
  // Quick heuristic: if the markdown token comes before text/html in the
  // Accept string, agent is asking for markdown first.
  const md = a.indexOf("text/markdown");
  const html = a.indexOf("text/html");
  return html === -1 || md < html;
}

// ----- Global stylesheet (single source of truth across pages) -----------
app.get("/style.css", (c) => {
  return new Response(STYLES_CSS, {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=86400",
    },
  });
});

// ----- Favicon (single SVG, light + dark adaptive) -----------------------
app.get("/favicon.svg", () => {
  return new Response(FAVICON_SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
    },
  });
});
// Browsers still hit /favicon.ico unconditionally — point them at the SVG
// (browsers handle the mime type; we send a 301 to keep things tidy).
app.get("/favicon.ico", (c) => c.redirect("/favicon.svg", 301));

// ----- Open Graph image (single SVG, edge-cached) -------------------
app.get("/og.svg", () => {
  return new Response(OG_SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=2592000",
    },
  });
});

// ----- Agent-ready discoverability ---------------------------------------
app.get("/robots.txt", (c) => {
  return new Response(robotsTxt(c.env.PUBLIC_URL), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
});
app.get("/llms.txt", (c) => {
  return new Response(llmsTxt(c.env.PUBLIC_URL), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});
app.get("/sitemap.xml", (c) => {
  return new Response(sitemapXml(c.env.PUBLIC_URL), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
app.get("/.well-known/agent-card.json", (c) => {
  return c.json(agentCard(c.env.PUBLIC_URL));
});
app.get("/openapi.json", (c) => {
  return c.json(openApiSpec(c.env.PUBLIC_URL));
});

// ----- Agent onboarding ---------------------------------------------------
app.get("/api/onboard", (c) => {
  const accept = c.req.header("Accept") ?? "";
  const text = buildOnboardText(c.env.PUBLIC_URL);
  if (accept.includes("application/json")) {
    return c.json({ instructions: text, public_url: c.env.PUBLIC_URL });
  }
  return new Response(text, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
});

// ----- Auth + API ---------------------------------------------------------
app.route("/api", authRoutes);
app.route("/api", apiRoutes);

// ----- Human verification page -------------------------------------------
app.get("/verify", (c) => {
  const code = c.req.query("code") ?? "";
  return c.html(verifyPage(c.env, { code }));
});

app.post("/verify", async (c) => {
  const form = await c.req.formData();
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const turnstileToken = String(form.get("cf-turnstile-response") ?? "");
  const existingToken = String(form.get("existing_token") ?? "").trim();
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";

  if (!code) {
    return c.html(
      verifyPage(c.env, { code: "", error: "Code is required." })
    );
  }
  if (!turnstileToken) {
    return c.html(
      verifyPage(c.env, {
        code,
        error: "Anti-bot challenge missing. Please tick the box and retry.",
      })
    );
  }

  // Verify Turnstile against Cloudflare. Skip the network round-trip when
  // using a Cloudflare-published test secret (always passes / always fails).
  const tsOk = await verifyTurnstile(
    turnstileToken,
    c.env.TURNSTILE_SECRET_KEY,
    ip
  );
  if (!tsOk) {
    return c.html(
      verifyPage(c.env, {
        code,
        error: "Anti-bot check didn't verify. Reload and try again.",
      })
    );
  }

  // Look up the verification.
  const row = await c.env.DB.prepare(
    `SELECT code, status, label, expires_at FROM verifications WHERE code = ?`
  )
    .bind(code)
    .first<{
      code: string;
      status: string;
      label: string | null;
      expires_at: number;
    }>();
  if (!row) {
    return c.html(
      verifyPage(c.env, {
        code,
        error: `No pending request for "${code}". Did the agent print a different code?`,
      })
    );
  }
  if (row.expires_at < Date.now()) {
    return c.html(
      verifyPage(c.env, {
        code,
        error: "This code has expired. Ask your agent to start a new flow.",
      })
    );
  }
  if (row.status !== "pending") {
    return c.html(
      verifyPage(c.env, {
        code,
        error: `This code is already ${row.status}.`,
      })
    );
  }

  // Optional: link to an existing identity. If the human pasted a valid
  // existing token, the new device joins that user_id instead of creating
  // a fresh one. This is how the same human runs multiple agents / machines.
  let userId: string;
  let linked = false;
  if (existingToken && /^hb_[A-Za-z0-9]+$/.test(existingToken)) {
    const existingHash = await hashToken(existingToken, c.env.TOKEN_PEPPER);
    const existing = await c.env.DB.prepare(
      `SELECT user_id FROM tokens WHERE token_hash = ? AND revoked_at IS NULL`
    )
      .bind(existingHash)
      .first<{ user_id: string }>();
    if (existing) {
      userId = existing.user_id;
      linked = true;
    } else {
      return c.html(
        verifyPage(c.env, {
          code,
          error:
            "The 'existing token' you pasted didn't match a known identity. " +
            "Leave that field empty to create a fresh identity instead.",
        })
      );
    }
  } else {
    userId = newUserId();
    await createUser(c.env.DB, userId, null);
  }

  const apiToken = newApiToken();
  const tokenHash = await hashToken(apiToken, c.env.TOKEN_PEPPER);
  await insertToken(c.env.DB, tokenHash, userId, row.label);

  await c.env.DB.prepare(
    `UPDATE verifications SET status = 'verified', user_id = ?, api_token = ? WHERE code = ?`
  )
    .bind(userId, apiToken, code)
    .run();

  return c.html(verifyPage(c.env, { code, success: true, linked }));
});

// ----- Public prototype viewer ------------------------------------------
app.get("/p/:slug", async (c) => {
  const slug = c.req.param("slug");
  if (!isValidSlug(slug)) return c.notFound();

  const proto = await getPrototype(c.env.DB, slug);
  if (!proto) return c.notFound();

  const locked = !!proto.password_hash;
  let unlocked = !locked;
  if (locked) {
    const cookie = getCookie(c.req.header("Cookie") ?? "", `wu_${slug}`);
    if (cookie) {
      unlocked = await verifyUnlockToken(cookie, slug, c.env.TOKEN_PEPPER);
    }
  }

  // Optional ?v=N pins to a specific version; default = latest.
  const versionParam = c.req.query("v");
  let viewVersion = proto.latest_version;
  if (versionParam) {
    const n = parseInt(versionParam, 10);
    if (
      Number.isFinite(n) &&
      n >= 1 &&
      n <= proto.latest_version
    ) {
      viewVersion = n;
    }
  }

  const versions = await listVersions(c.env.DB, slug);

  c.executionCtx.waitUntil(bumpViewCount(c.env.DB, slug));

  return c.html(
    viewerPage(c.env, proto, {
      locked,
      unlocked,
      versions: versions.map((v) => ({
        version: v.version,
        size_bytes: v.size_bytes,
        has_context: !!v.context,
        context: v.context,
        created_at: v.created_at,
      })),
      viewVersion,
    })
  );
});

app.post("/p/:slug/unlock", async (c) => {
  const slug = c.req.param("slug");
  if (!isValidSlug(slug)) return c.notFound();
  const proto = await getPrototype(c.env.DB, slug);
  if (!proto) return c.notFound();
  if (!proto.password_hash || !proto.password_salt) {
    return c.redirect(`/p/${slug}`, 302);
  }

  const form = await c.req.formData();
  const password = String(form.get("password") ?? "");
  const ok = await verifyPassword(
    password,
    proto.password_salt,
    proto.password_hash
  );
  if (!ok) {
    return c.html(passwordGatePage(c.env, proto, { error: true }));
  }

  // 24-hour signed unlock cookie, scoped to this slug.
  const exp = Date.now() + 24 * 3600 * 1000;
  const value = await signUnlockToken(slug, exp, c.env.TOKEN_PEPPER);
  const cookie = `wu_${slug}=${value}; Path=/p/${slug}; HttpOnly; Secure; SameSite=Lax; Max-Age=${24 * 3600}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/p/${slug}`,
      "Set-Cookie": cookie,
    },
  });
});

app.get("/p/:slug/raw", async (c) => {
  const slug = c.req.param("slug");
  if (!isValidSlug(slug)) return c.notFound();

  const proto = await getPrototype(c.env.DB, slug);
  if (!proto) return c.notFound();

  if (proto.password_hash) {
    const cookie = getCookie(c.req.header("Cookie") ?? "", `wu_${slug}`);
    const ok =
      !!cookie &&
      (await verifyUnlockToken(cookie, slug, c.env.TOKEN_PEPPER));
    if (!ok) {
      // Don't expose locked HTML — redirect to the gate.
      return c.redirect(`/p/${slug}`, 302);
    }
  }

  // ?v=N selects a specific version; default = latest.
  let v = proto.latest_version;
  const vp = c.req.query("v");
  if (vp) {
    const n = parseInt(vp, 10);
    if (Number.isFinite(n) && n >= 1 && n <= proto.latest_version) v = n;
  }

  const html = await c.env.PROTOTYPES_KV.get(`html:${slug}:v${v}`);
  if (!html) return c.notFound();

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": proto.password_hash
        ? "private, no-store"
        : "public, max-age=60, s-maxage=300",
      "X-Robots-Tag": "noindex",
      // Defense-in-depth for the served HTML:
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      // CSP: allow inline scripts/styles (drops are user-authored), but block
      // top-level navigation hijacking and disallow being framed by other origins.
      "Content-Security-Policy":
        "frame-ancestors 'self'; base-uri 'none'; form-action 'self' https:",
    },
  });
});

// ----- 404 ----------------------------------------------------------------
app.notFound((c) => {
  return c.html(notFoundHtml(c.env.PUBLIC_URL), 404);
});

// ----- Helpers ------------------------------------------------------------

// Cloudflare's published test secrets — always passes / always fails.
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TURNSTILE_TEST_PASS = "1x0000000000000000000000000000000AA";
const TURNSTILE_TEST_FAIL = "2x0000000000000000000000000000000AA";

async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string
): Promise<boolean> {
  if (secret === TURNSTILE_TEST_PASS) return true;
  if (secret === TURNSTILE_TEST_FAIL) return false;
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      }
    );
    const json = (await res.json()) as { success: boolean };
    return !!json.success;
  } catch {
    return false;
  }
}

function mdHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=3600",
    "Vary": "Accept",
  };
}

function getCookie(header: string, name: string): string | null {
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

function notFoundHtml(publicUrl: string): string {
  const host = publicUrl.replace(/^https?:\/\//, "");
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return /* html */ `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>404 · htmlbin</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="/style.css" />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
</head>
<body>
<header class="page-head">
  <div class="row">
    <div class="crumb">
      <a href="/" class="wordmark">htmlbin</a>
      <span class="slash">/</span>
      <span class="verb">GET</span>
      <span class="path">/p/&lt;unknown&gt;</span>
      <span class="ver">v1</span>
    </div>
    <div class="head-meta">
      <a href="/htmlbin">/htmlbin</a>
      <a href="/api/onboard">/api/onboard</a>
    </div>
  </div>
</header>
<main>
  <details class="req" aria-label="memo">
    <summary class="reqline"><span class="verb">GET</span> <span class="path">/p/&lt;unknown&gt;</span> <span class="proto">HTTP/1.1</span></summary>
    <div class="rows">
      <div class="row"><span class="k">host</span><span class="v">${host}</span></div>
      <div class="row"><span class="k">date</span><span class="v">${date}</span></div>
      <div class="resline"><span class="bad">404 Not Found</span> &nbsp; content-type: text/plain</div>
    </div>
  </details>
  <hr class="rule" />
  <div class="notfound">
    <div class="stamp">return to sender</div>
    <h1>This drop doesn't exist.</h1>
    <p>The slug you opened was either never created, or has since been deleted by the agent that owned it. <a href="${publicUrl}">Back to htmlbin</a>.</p>
  </div>
</main>
</body></html>`;
}

export default app;
