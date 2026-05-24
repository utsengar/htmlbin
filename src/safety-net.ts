// Mobile safety net injected into every served drop at /p/:slug/raw.
//
// Why this exists: the most common failure mode for agent-authored drops is
// horizontal scroll on mobile — wide <pre> blocks, unbreakable strings, fixed
// pixel widths, tables setting page width. The SKILL.md mobile floor tells
// agents not to ship that, but the floor is advisory. This is the guard.
//
// We modify user HTML by appending ~250 bytes of CSS at the tail of <head>
// and (if missing) a viewport meta. That's a small, defensible deviation
// from "we don't touch the user's content" — no drop wants horizontal scroll
// on <body>; this only ever clamps a broken layout.
//
// Trade-offs deliberately accepted:
//   - We don't try to detect or repair specific patterns (wide tables, etc.).
//     The injected style is small and universal; agents that want tighter
//     control already follow the SKILL.md prescription.
//   - We don't offer an opt-out. If a drop ever legitimately wants horizontal
//     scrolling on <body>, it can wrap content in an inner container with
//     `overflow-x: auto`. The floor stays on.
//
// Hot path: this runs on every raw view. Keep it allocation-light — a couple
// of regex tests + at most two single-replace calls per response.

// Compact rule set. `overflow-x: clip` over `hidden` so we don't create a
// scroll container (would break position: sticky descendants).
const SAFETY_STYLE =
  '<style data-htmlbin-safety>' +
  'html,body{max-width:100vw;overflow-x:clip}' +
  'img,svg{max-width:100%;height:auto}' +
  'video,iframe{max-width:100%}' +
  'pre,table{max-width:100%}' +
  'pre{overflow-x:auto}' +
  '</style>';

const VIEWPORT_META =
  '<meta name="viewport" content="width=device-width, initial-scale=1">';

const VIEWPORT_RE = /<meta\s+[^>]*name\s*=\s*["']?viewport["']?/i;
const HEAD_OPEN_RE = /<head\b[^>]*>/i;
const HEAD_CLOSE_RE = /<\/head\s*>/i;
const HTML_OPEN_RE = /<html\b[^>]*>/i;
const BODY_OPEN_RE = /<body\b[^>]*>/i;

export function injectMobileSafetyNet(html: string): string {
  let out = html;

  if (!VIEWPORT_RE.test(out)) {
    if (HEAD_OPEN_RE.test(out)) {
      out = out.replace(HEAD_OPEN_RE, (m) => `${m}${VIEWPORT_META}`);
    } else if (HTML_OPEN_RE.test(out)) {
      out = out.replace(HTML_OPEN_RE, (m) => `${m}${VIEWPORT_META}`);
    } else {
      out = `${VIEWPORT_META}${out}`;
    }
  }

  if (HEAD_CLOSE_RE.test(out)) {
    out = out.replace(HEAD_CLOSE_RE, `${SAFETY_STYLE}</head>`);
  } else if (BODY_OPEN_RE.test(out)) {
    out = out.replace(BODY_OPEN_RE, (m) => `${SAFETY_STYLE}${m}`);
  } else {
    out = `${SAFETY_STYLE}${out}`;
  }

  return out;
}
