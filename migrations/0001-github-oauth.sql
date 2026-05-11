-- Bind every user to a GitHub identity.
--
-- New accounts: github_user_id is required and UNIQUE. The OAuth callback
-- looks up existing users by github_user_id, so the same human signing in
-- on a new device reuses the same user_id (replaces the old "paste an
-- existing token" UX).
--
-- Existing pre-OAuth users: column starts NULL. Their existing tokens
-- continue to work, but no new tokens can be minted via the new flow
-- without a GitHub login. We intentionally don't backfill or sunset.
--
-- Apply locally:  npm run db:migrate:local
-- Apply to prod:  npm run db:migrate:remote

ALTER TABLE users ADD COLUMN github_user_id INTEGER;
ALTER TABLE users ADD COLUMN github_login TEXT;

-- UNIQUE INDEX with WHERE clause: only enforces uniqueness on rows that
-- actually have a github_user_id, so the NULL legacy rows don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_user_id
  ON users(github_user_id) WHERE github_user_id IS NOT NULL;
