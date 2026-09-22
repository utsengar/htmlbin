-- Collect the user's verified primary email from GitHub.
--
-- OAuth scope expands from `read:user` to `read:user user:email`. On every
-- sign-in the callback fetches /user/emails, picks the primary+verified
-- entry, and stores it. Optional — sign-in still succeeds with email NULL
-- (user denied scope, has no verified email, or the lookup failed).
--
-- No UNIQUE constraint: two distinct GitHub accounts can legitimately
-- share an email (work + personal sharing user@gmail.com). github_user_id
-- remains the identity; email is contact metadata only.
--
-- Apply locally:  npm run db:migrate:local
-- Apply to prod:  npm run db:migrate:remote

ALTER TABLE users ADD COLUMN email TEXT;
