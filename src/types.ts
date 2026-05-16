import type { Hono } from "hono";

// Cloudflare Workers AI binding. Specifically the toMarkdown helper for
// converting any HTML/PDF/document blob into Markdown for agent
// consumption. See https://blog.cloudflare.com/markdown-for-agents/
export type WorkersAI = {
  toMarkdown(
    inputs: Array<{ name: string; blob: Blob }>
  ): Promise<
    Array<{
      name: string;
      mimeType: string;
      format: string;
      tokens: number;
      data: string;
    }>
  >;
};

export type Bindings = {
  DB: D1Database;
  DROPS_KV: KVNamespace;
  AI: WorkersAI;
  PUBLIC_URL: string;
  TOKEN_PEPPER: string;
  // GitHub OAuth — single human identity check on /verify. The dev
  // setup uses the sentinel "dev-mock" for both values to short-circuit
  // the round-trip to github.com (see src/github-oauth.ts).
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  // Sentry observability. Optional — when unset, both the Worker
  // wrapper and the browser /sentry.js route no-op. DSN is public by
  // design (Sentry expects it in client code).
  SENTRY_DSN?: string;
};

export type Variables = {
  user: { id: string; tokenHash: string };
};

export type App = Hono<{ Bindings: Bindings; Variables: Variables }>;

export type User = {
  id: string;
  display_name: string | null;
  created_at: number;
  github_user_id: number | null;
  github_login: string | null;
};

export type Drop = {
  slug: string;
  user_id: string;
  title: string;
  description: string;
  password_hash: string | null;
  password_salt: string | null;
  latest_version: number;
  view_count: number;
  created_at: number;
  updated_at: number;
};

export type Version = {
  slug: string;
  version: number;
  size_bytes: number;
  context: string | null;
  created_at: number;
};
