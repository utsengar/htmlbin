-- htmlbin schema
-- Apply locally: npm run db:apply:local
-- Apply to prod: npm run db:apply:remote

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  display_name  TEXT,
  created_at    INTEGER NOT NULL
);

-- API tokens. We store only the SHA-256 hash; plaintext is shown to the agent
-- exactly once after verification. A single user_id can have many tokens
-- (one per machine / agent install) so the same human can manage drops
-- across devices.
CREATE TABLE IF NOT EXISTS tokens (
  token_hash    TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  label         TEXT,
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER,
  revoked_at    INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_tokens_user ON tokens(user_id);

-- Drop record (one row per slug). HTML bodies live in KV, keyed by
-- `html:<slug>:v<n>`. Each new PUT becomes a new version (v2, v3, …) so the
-- public URL never changes even as the HTML evolves.
CREATE TABLE IF NOT EXISTS prototypes (
  slug            TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  password_hash   TEXT,
  password_salt   TEXT,
  latest_version  INTEGER NOT NULL DEFAULT 1,
  view_count      INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_prototypes_user_created
  ON prototypes(user_id, created_at DESC);

-- One row per version. Each version can carry its own optional `context`
-- — free-form text the agent may include to explain its thinking, prompt,
-- or reasoning trace. Context is opt-in per version because it can be
-- sensitive; humans must request it explicitly to view.
CREATE TABLE IF NOT EXISTS versions (
  slug        TEXT NOT NULL,
  version     INTEGER NOT NULL,
  size_bytes  INTEGER NOT NULL,
  context     TEXT,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (slug, version),
  FOREIGN KEY (slug) REFERENCES prototypes(slug)
);

CREATE INDEX IF NOT EXISTS idx_versions_slug_version
  ON versions(slug, version DESC);

-- Pending device-code verification attempts.
-- code         is the short human-typeable code (shown on verify page).
-- poll_token   is the long secret the agent polls with.
-- api_token    is set on success and read once, then cleared.
-- existing_user_id (optional) lets a verifying human "transfer" their
-- existing identity to a new device by typing an existing token at the
-- verify page.
CREATE TABLE IF NOT EXISTS verifications (
  code              TEXT PRIMARY KEY,
  poll_token        TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'pending', -- pending | verified | claimed | expired
  label             TEXT,
  user_id           TEXT,
  api_token         TEXT,
  existing_user_id  TEXT,
  created_at        INTEGER NOT NULL,
  expires_at        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verifications_poll
  ON verifications(poll_token);
CREATE INDEX IF NOT EXISTS idx_verifications_expires
  ON verifications(expires_at);

-- Abuse reports filed by visitors. ip_hash is salted with TOKEN_PEPPER
-- so we can rate-limit per source without storing raw IPs.
CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL,
  reason      TEXT NOT NULL,
  detail      TEXT,
  ip_hash     TEXT,
  created_at  INTEGER NOT NULL,
  reviewed    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_reports_slug ON reports(slug);
CREATE INDEX IF NOT EXISTS idx_reports_unreviewed ON reports(reviewed, created_at DESC);

-- Tiny rate limiter: count writes per token / IP per minute window.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket        TEXT PRIMARY KEY,
  count         INTEGER NOT NULL,
  window_start  INTEGER NOT NULL
);
