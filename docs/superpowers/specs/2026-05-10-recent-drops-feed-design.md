# Plan — subtle "recent drops" feed on the homepage

> Drafted 2026-05-10 during launch sprint. Tabled for post-launch revisit.

## Context

The landing page currently shows one curated `EXAMPLES` array (4 hand-picked drops, in `src/views/landing.ts:8`) with hand-written captions. That section stays — it's the "best of" shelf.

The ask: add a **second, smaller signal** — top 10 drops sorted by `created_at DESC`, so the homepage feels alive without becoming a feed-y noise wall. Constraints:

- **Cost:** don't hammer D1 on every homepage hit. The homepage is the highest-volume route on the site (humans, agents, social unfurlers, indexers).
- **UX:** quiet, mono, not loud. No animations, no "live now" pulse. Just text.
- **Keep `EXAMPLES`:** curated section stays primary.

## The design

### Caching strategy: single-tier KV with 5-min TTL

Same pattern the codebase already uses (`md:landing` → 1h, `og-png:landing:v2` → no TTL). Reuses `c.env.DROPS_KV`. KV is globally consistent, predictable, and free at our launch scale.

- KV key: `feed:recent:v1`
- TTL: 300s (5 min)
- Cache-miss cost: 1 D1 query (~50–150 ms)
- Cache-hit cost: 1 KV read (~5–20 ms)
- Steady-state D1 hits: ≤288/day max regardless of homepage traffic

**Why not Cache API?** Per-PoP, so different regions would see slightly different lists. KV gives one global feed — matches the curated section's behavior. Easy upgrade path later: stack edge cache on top of KV if traffic warrants.

**Why not a separate `GET /api/recent` endpoint with client-side fetch?** Landing page is fully SSR today. JS dependency for one list is overkill; KV cache keeps render fast enough.

### Query

```sql
SELECT slug, title, created_at
FROM drops
WHERE title != ''
  AND password_hash IS NULL
  AND created_at >= ?           -- last 30 days
ORDER BY created_at DESC
LIMIT 10;
```

Filters out:
- Untitled drops (mostly tests, drafts, throwaway agent runs)
- Password-protected drops (creator explicitly didn't want public visibility)
- Drops older than 30 days (keeps the feed actually fresh; otherwise launch-day drops dominate forever)

Curated slugs in `EXAMPLES` are filtered out **at render time** so the curated and recent sections don't show the same row twice.

### Schema

Add one supporting index (drops table has `(user_id, created_at DESC)` already, but no global `created_at` index):

```sql
CREATE INDEX IF NOT EXISTS idx_drops_created_at
  ON drops(created_at DESC);
```

**No new columns.** Privacy posture for MVP: any titled, non-locked drop becomes eligible for the feed. The user already chose to publish — putting it on a public URL is, by definition, public. If a real-world surprise happens (someone gives a sensitive drop a real title), we add an `unlisted` boolean opt-out later. Call out before implementing if a stricter posture is wanted.

### UX

Below the curated examples section, before the signoff:

```
↓ a few drops people have made          ← existing (curated)
/p/gDMy7Vb     how htmlbin works
/p/1Wyf23j     cross-platform gstack — pr #1111
/p/ztx4J9P     workers nav — three redesigns
/p/i2taphP     google logo — animation playground

↓ fresh                                  ← new (recent)
/p/aB3xK7g     A bayesian intuition pump          3m
/p/q9mN2vJ     Why DNS feels slow                 1h
/p/zP4ynRk     Animated prime sieve               4h
…
```

- Same grid (`13ch 1fr`) as `.examples`, plus an extra column for the relative-time chip.
- Mono everywhere, no icons.
- Curated section's title stays in `--ink`; recent section's title in `--ink-2` (slightly dimmer) so curated reads as primary.
- Relative time in `--ink-softer`, terse format: `3m`, `1h`, `4h`, `2d`. No "ago" suffix.
- Truncate titles to ~50 chars with `…` suffix.
- Section heading: `↓ fresh` — short, matches the existing arrow-cue style.
- If zero eligible recent drops: hide the section entirely (don't render an empty `<section>`).

### Implementation

**New helper** in `src/db.ts`:

```ts
export async function listRecentPublicDrops(
  db: D1Database,
  limit: number,
  sinceMs: number,
): Promise<Pick<Drop, "slug" | "title" | "created_at">[]>
```

Returns plain rows from the SQL above. Stays close to the existing `listDropsByUser` / `getDrop` style.

**New cache wrapper** — colocate with the helper or in `src/views/landing.ts`. Probably belongs in a tiny `src/recent.ts` since it's homepage-specific:

```ts
export async function getRecentDropsCached(env: Bindings): Promise<RecentDrop[]>
```

KV-first, D1 fallthrough on miss, `expirationTtl: 300` on the write. Graceful degradation: if KV or D1 errors, return `[]` so the homepage still renders (just without the recent section).

**Landing page** (`src/views/landing.ts`):

- Change `landingPage(env)` → `landingPage(env, recentDrops)`. Caller in `src/index.ts` pre-fetches via `getRecentDropsCached(c.env)` and passes through.
- Filter out any slug already in `EXAMPLES` before rendering.
- Render new `<section class="recent">` only if `recentDrops.length > 0`.

**Styles** (`src/styles.ts`):

- New `.recent` block, reusing the `.examples` mono grid but with three columns: `13ch 1fr 4ch` (slug, title, time).
- `.recent .when { color: var(--ink-softer); text-align: right; }`
- The CSS hash in `STYLE_HREF` auto-bumps on this edit → edge cache busts on deploy.

**Time formatting** — small helper in `src/views/landing.ts` (server-side render, no JS):

```ts
function relativeTime(thenMs: number, nowMs: number): string {
  // "<1m", "3m", "1h", "4h", "2d"
}
```

## Critical files

- `src/db.ts` — add `listRecentPublicDrops()`
- `src/recent.ts` *(new)* — KV-cached read-through
- `src/views/landing.ts` — accept `recentDrops`, render new section, time helper
- `src/index.ts` — pre-fetch + pass to `landingPage()`
- `src/styles.ts` — `.recent` grid, dim relative time
- `schema.sql` — add `idx_drops_created_at` index
- `CLAUDE.md` — note the cache key + TTL convention for the recent feed

## Cost / scale check

| Path | Per request | Daily max |
|---|---|---|
| KV hit (steady-state) | 1 KV read | ~unbounded, within free 100k/day until ~10k landing hits/hr |
| KV miss → D1 | 1 KV read + 1 D1 query + 1 KV write | ≤288/day (12/hr at 5-min TTL) |
| D1 query cost | ~1 read on indexed scan of 10 rows | tiny |
| KV write cost | 1 KV write/5min | 288/day; well under 1k/day free |

Workers Cache API isn't needed at launch volumes. Easy to layer in later if KV reads start to bite.

## Privacy / opt-out (callout)

MVP filters only on `title != ''` and `password_hash IS NULL`. Any titled, non-locked drop is eligible. **No new column, no opt-out field** — keeping schema/API surface minimal for launch.

If opt-out is wanted from day one, the addition is small:
- Schema: `ALTER TABLE drops ADD COLUMN unlisted INTEGER NOT NULL DEFAULT 0`
- API: accept `unlisted: boolean` on POST/PUT/PATCH; surface in `serializeDrop`
- Query: `AND unlisted = 0`

## Verification

After implementation, on the preview URL:

1. Hit `/` cold — confirm a recent-drops section renders below the curated examples.
2. Hit `/` again within 5 min — confirm same order (KV hit).
3. Publish a new titled drop via the API → wait <5 min → reload `/` → new drop appears at the top of the recent section.
4. Publish a password-protected drop → never appears in the recent section.
5. Publish an untitled drop → never appears.
6. Curated slugs (the 4 in `EXAMPLES`) never appear in the recent section even if they fall into the last-30-days window.
7. With zero recent eligible drops (e.g. fresh dev DB): recent section is fully hidden.
8. Lighthouse on `/`: no regression on LCP (recent feed is rendered inline, no extra round trip).
9. Mobile viewport: time column doesn't push the title off the row.
