import { Hono } from "hono";
import type { Bindings, Variables } from "./types";
import { hashToken, newPollToken, randomHumanCode } from "./crypto";
import { getUserByTokenHash, rateLimit, touchToken } from "./db";

const VERIFY_TTL_MS = 10 * 60 * 1000; // 10 minutes
const POLL_MIN_INTERVAL_S = 2;

export const authRoutes = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// ----- Public: agent kicks off the device-code flow -----------------------
authRoutes.post("/auth/start", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const ok = await rateLimit(c.env.DB, `auth:start:${ip}`, 10, 60_000);
  if (!ok) return c.json({ error: "rate_limited" }, 429);

  let label: string | null = null;
  try {
    const body = (await c.req.json()) as { label?: string };
    if (body?.label && typeof body.label === "string") {
      label = body.label.slice(0, 64);
    }
  } catch {
    // body is optional
  }

  const code = randomHumanCode();
  const pollToken = newPollToken();
  const now = Date.now();
  const expiresAt = now + VERIFY_TTL_MS;

  await c.env.DB.prepare(
    `INSERT INTO verifications (code, poll_token, status, label, created_at, expires_at)
     VALUES (?, ?, 'pending', ?, ?, ?)`
  )
    .bind(code, pollToken, label, now, expiresAt)
    .run();

  const verifyUrl = `${c.env.PUBLIC_URL}/verify?code=${encodeURIComponent(code)}`;

  return c.json({
    code,
    verification_url: verifyUrl,
    poll_token: pollToken,
    expires_in: Math.floor(VERIFY_TTL_MS / 1000),
    poll_interval: POLL_MIN_INTERVAL_S,
    instructions:
      `Print this message to the human in your terminal:\n\n` +
      `  Open ${verifyUrl}\n` +
      `  Verify the code: ${code}\n\n` +
      `Then poll GET /api/auth/poll?token=${pollToken} every ${POLL_MIN_INTERVAL_S}s ` +
      `until status === "verified". The api_token is shown exactly once — store it.`,
  });
});

// ----- Public: agent polls for completion ---------------------------------
authRoutes.get("/auth/poll", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "token required" }, 400);

  const row = await c.env.DB.prepare(
    `SELECT code, status, user_id, api_token, expires_at
       FROM verifications WHERE poll_token = ?`
  )
    .bind(token)
    .first<{
      code: string;
      status: string;
      user_id: string | null;
      api_token: string | null;
      expires_at: number;
    }>();

  if (!row) return c.json({ status: "not_found" }, 404);

  if (row.status === "pending" && row.expires_at < Date.now()) {
    await c.env.DB.prepare(
      `UPDATE verifications SET status = 'expired' WHERE poll_token = ?`
    )
      .bind(token)
      .run();
    return c.json({ status: "expired" });
  }

  if (row.status === "verified" && row.api_token) {
    // One-time read: clear the token and mark claimed.
    await c.env.DB.prepare(
      `UPDATE verifications SET api_token = NULL, status = 'claimed' WHERE poll_token = ?`
    )
      .bind(token)
      .run();
    return c.json({
      status: "verified",
      api_token: row.api_token,
      user_id: row.user_id,
    });
  }

  if (row.status === "claimed") return c.json({ status: "claimed" });
  if (row.status === "expired") return c.json({ status: "expired" });
  return c.json({ status: "pending" });
});

// ----- Auth middleware (used by /api/prototypes) --------------------------
export async function authMiddleware(c: any, next: any) {
  const header = c.req.header("Authorization") ?? "";
  const m = /^Bearer\s+(hb_[A-Za-z0-9]+)$/.exec(header);
  const token = m?.[1];
  if (!token) return c.json({ error: "unauthorized" }, 401);

  const tokenHash = await hashToken(token, c.env.TOKEN_PEPPER);
  const user = await getUserByTokenHash(c.env.DB, tokenHash);
  if (!user) return c.json({ error: "invalid_token" }, 401);

  c.set("user", { id: user.id, tokenHash });
  // Fire-and-forget; not awaited to keep the hot path fast.
  c.executionCtx.waitUntil(touchToken(c.env.DB, tokenHash));
  await next();
}

