// Cloud (htmlbin.dev) auth: token resolution + device-code login.
//
// Token storage precedence (matches the /api/onboard descriptor — the
// agent protocol contract. Do not diverge without also updating
// src/onboard.ts on the Worker side):
//   1. ./.htmlbin/token         — project-local (cwd-relative)
//   2. $HTMLBIN_TOKEN           — env var
//   3. ~/.config/htmlbin/token  — machine-global fallback

import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { CliError } from "../errors.js";
import { request } from "undici";

const TOKEN_REGEX = /^hb_[A-Za-z0-9_-]{16,}$/;

export interface TokenSource {
  token: string;
  source: "project" | "env" | "home";
  path?: string;
}

export async function resolveToken(cwd = process.cwd()): Promise<TokenSource | null> {
  const projectPath = resolve(cwd, ".htmlbin/token");
  const projectTok = await readToken(projectPath);
  if (projectTok) return { token: projectTok, source: "project", path: projectPath };

  const envTok = process.env.HTMLBIN_TOKEN?.trim();
  if (envTok) return { token: envTok, source: "env" };

  const homePath = join(homedir(), ".config/htmlbin/token");
  const homeTok = await readToken(homePath);
  if (homeTok) return { token: homeTok, source: "home", path: homePath };

  return null;
}

export async function requireToken(cwd?: string): Promise<TokenSource> {
  const t = await resolveToken(cwd);
  if (!t) {
    throw new CliError(
      "auth_required",
      "No htmlbin token found.",
      {
        hint: "Run `htmlbin login` to mint one. Looked in ./.htmlbin/token, $HTMLBIN_TOKEN, ~/.config/htmlbin/token.",
      }
    );
  }
  if (!TOKEN_REGEX.test(t.token)) {
    throw new CliError(
      "invalid_token",
      `Token from ${t.source}${t.path ? ` (${t.path})` : ""} is malformed.`,
      { hint: "Tokens start with `hb_`. Run `htmlbin login` to mint a fresh one." }
    );
  }
  return t;
}

async function readToken(path: string): Promise<string | null> {
  try {
    const raw = await readFile(path, "utf8");
    return raw.trim() || null;
  } catch {
    return null;
  }
}

export async function storeProjectToken(token: string, cwd = process.cwd()): Promise<string> {
  const path = resolve(cwd, ".htmlbin/token");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, token + "\n", "utf8");
  try {
    await chmod(path, 0o600);
  } catch {
    // best effort; Windows may not support
  }
  return path;
}

// Device-code login flow against the htmlbin.dev /api/auth/* endpoints.
// Prints code + URL, polls until the human verifies via GitHub, then
// writes the token to ./.htmlbin/token.
export interface LoginOpts {
  apiUrl?: string;
  label?: string;
  cwd?: string;
  openBrowser?: boolean;
  writer?: (line: string) => void;
}

export async function deviceCodeLogin(opts: LoginOpts = {}): Promise<{ token: string; path: string }> {
  const apiUrl = (opts.apiUrl ?? "https://htmlbin.dev").replace(/\/$/, "");
  const writer = opts.writer ?? ((line) => process.stderr.write(line + "\n"));

  const start = await jsonRequest<{
    code: string;
    verification_url: string;
    poll_token: string;
    expires_in: number;
    poll_interval: number;
  }>("POST", `${apiUrl}/api/auth/start`, { label: opts.label ?? "@htmlbin/cli" });

  writer("");
  writer("  Open this URL in your browser and sign in with GitHub:");
  writer("    " + start.verification_url);
  writer("");
  writer("  Verification code: " + start.code);
  writer("");
  writer("  Waiting for verification…");

  if (opts.openBrowser !== false) {
    void tryOpenBrowser(start.verification_url);
  }

  const deadline = Date.now() + start.expires_in * 1000;
  const interval = Math.max(1, start.poll_interval) * 1000;

  while (Date.now() < deadline) {
    await sleep(interval);
    const poll = await jsonRequest<{
      status: "pending" | "verified" | "expired" | "claimed" | "not_found";
      api_token?: string;
      user_id?: string;
    }>("GET", `${apiUrl}/api/auth/poll?token=${encodeURIComponent(start.poll_token)}`);

    if (poll.status === "pending") continue;
    if (poll.status === "verified" && poll.api_token) {
      const path = await storeProjectToken(poll.api_token, opts.cwd);
      writer("");
      writer("  ✓ Verified. Token stored at " + path);
      return { token: poll.api_token, path };
    }
    throw new CliError(
      "auth_required",
      `Device-code flow ended with status: ${poll.status}.`,
      { hint: "Re-run `htmlbin login` to start a new flow." }
    );
  }
  throw new CliError("auth_required", "Verification timed out before the human signed in.", {
    hint: "Re-run `htmlbin login`.",
  });
}

async function jsonRequest<T>(
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const res = await request(url, {
    method: method as "POST" | "GET",
    headers: {
      "user-agent": "@htmlbin/cli (login)",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.body.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    throw new CliError("network_error", `Non-JSON response from ${url} (${res.statusCode})`, {
      details: { body: text.slice(0, 500) },
    });
  }
  if (res.statusCode >= 400) {
    const err = (parsed as { error?: { code?: string; message?: string } } | undefined)?.error;
    throw new CliError(
      (err?.code as never) ?? "network_error",
      err?.message ?? `Request failed with status ${res.statusCode}`,
      { details: { status: res.statusCode } }
    );
  }
  return parsed as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function tryOpenBrowser(url: string): Promise<void> {
  const { exec } = await import("node:child_process");
  const cmd =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
      ? `start "" "${url}"`
      : `xdg-open "${url}"`;
  exec(cmd, () => {
    // best effort, ignore errors
  });
}
