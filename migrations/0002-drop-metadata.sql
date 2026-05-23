-- Owner-facing tag bag on drops.
--
-- A flat JSON object (string → string) attached to each drop. The CLI uses
-- it for stable PR-preview URLs: tag a drop with {repo, pr}, look it up
-- later by the same tags, PUT to update — no slug bookkeeping on the
-- client side. Filterable via GET /api/drops?metadata.k=v.
--
-- Stored as TEXT validated by JSON1. Drop-level (NOT versioned); like
-- title, only the current value is kept. Public viewer doesn't see it.
--
-- Apply locally:  npm run db:migrate:local
-- Apply to prod:  npm run db:migrate:remote

ALTER TABLE drops ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}';
