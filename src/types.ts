import type { Hono } from "hono";

export type Bindings = {
  DB: D1Database;
  PROTOTYPES_KV: KVNamespace;
  PUBLIC_URL: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  TOKEN_PEPPER: string;
};

export type Variables = {
  user: { id: string; tokenHash: string };
};

export type App = Hono<{ Bindings: Bindings; Variables: Variables }>;

export type User = {
  id: string;
  display_name: string | null;
  created_at: number;
};

export type Prototype = {
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
