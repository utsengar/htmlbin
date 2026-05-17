// OG (Open Graph) images. Two flavors:
//   - OG_SVG       — site-wide card served at /og.svg
//   - dropOgSvg()  — per-drop card served at /p/:slug/og.svg
//
// 1200×630 is the canonical OG card dimension. SVG keeps each card under
// 2 KB and lets Cloudflare's edge cache it cheaply; Discord renders SVG
// OG images directly, and the SVG is also the fall-back path when the
// satori → resvg PNG pipeline errors at request time.
//
// Composition follows the same shape as the PNG renderer: title block
// top-left with a small wordmark above and generous whitespace below,
// then a thin meta row anchored at the bottom. The previous centered-
// shouting headline made the cards feel like marketing posters; this
// shape reads more like an engineering doc.
//
// We use system-ui font fallbacks because crawlers don't execute the
// page's @font-face load. The result looks slightly different per
// platform; that's the price of "basic, on-brand, nothing fancy."

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export const OG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="#FFFFFF"/>

  <!-- wordmark, top-left -->
  <text x="80" y="138"
        font-family="${MONO}"
        font-size="26" font-weight="500" fill="#0A0A0A">
    <tspan fill="#D93025">&lt;</tspan>htmlbin<tspan fill="#D93025">&gt;</tspan>
  </text>

  <!-- headline (two lines, top-left, comfortable size) -->
  <text x="80" y="232"
        font-family="${SANS}"
        font-size="60" font-weight="600" fill="#0A0A0A"
        letter-spacing="-1.4">A home for the HTML</text>
  <text x="80" y="300"
        font-family="${SANS}"
        font-size="60" font-weight="600" fill="#0A0A0A"
        letter-spacing="-1.4"><tspan fill="#D93025">your agent</tspan> writes.</text>

  <!-- subtitle, lighter, sits just under the headline -->
  <text x="80" y="346"
        font-family="${SANS}"
        font-size="22" font-weight="400" fill="#737373">
    Agent-native, end to end.
  </text>

  <!-- bottom host watermark, right-aligned -->
  <text x="1120" y="572"
        font-family="${MONO}"
        font-size="20" fill="#A3A3A3"
        text-anchor="end">htmlbin.dev</text>
</svg>`;

// Per-drop OG card. Title block top-left, meta row at the bottom.
// Locked drops fall through to a mono `/p/<slug>` hero so we don't leak
// human-readable titles in social previews.
export function dropOgSvg(opts: {
  slug: string;
  title: string;
  isLocked: boolean;
  latestVersion: number;
  updatedAt: number;
  publicUrl: string;
}): string {
  const { slug, title, isLocked, latestVersion, updatedAt, publicUrl } = opts;

  const date = new Date(updatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const host = publicUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const safeTitle =
    !isLocked && title && title.trim().length > 0 ? title.trim() : null;

  // SVG <text> doesn't auto-wrap, so titles have to fit on one line at
  // the chosen font-size. At 52px sans, ~40 chars is the safe budget for
  // a 1040px-wide content area. (The PNG version flex-wraps and tolerates
  // longer titles.)
  const heroText = safeTitle ? truncate(safeTitle, 40) : `/p/${slug}`;
  const heroMono = !safeTitle;
  const heroFont = heroMono ? MONO : SANS;
  const heroSize = heroMono ? 56 : 52;
  const heroWeight = heroMono ? 500 : 600;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="#FFFFFF"/>

  <!-- breadcrumb: wordmark / slug -->
  <text x="80" y="138"
        font-family="${MONO}"
        font-size="24" font-weight="500" fill="#0A0A0A">
    <tspan fill="#D93025">&lt;</tspan>htmlbin<tspan fill="#D93025">&gt;</tspan><tspan fill="#E5E5E5"> / </tspan><tspan fill="#737373">/p/${escapeForSvg(slug)}</tspan>
  </text>

  <!-- hero (title, or locked-fallback slug) -->
  <text x="80" y="240"
        font-family="${heroFont}"
        font-size="${heroSize}" font-weight="${heroWeight}" fill="#0A0A0A"
        letter-spacing="${heroMono ? -1.2 : -1.2}">${
    heroMono
      ? `/p/<tspan fill="#D93025">${escapeForSvg(slug)}</tspan>`
      : escapeForSvg(heroText)
  }</text>

  <!-- meta row, bottom-left -->
  <text x="80" y="572"
        font-family="${MONO}"
        font-size="20" fill="#737373">
    v${latestVersion}<tspan fill="#E5E5E5">  ·  </tspan>${escapeForSvg(date)}${
    isLocked
      ? `<tspan fill="#E5E5E5">  ·  </tspan><tspan fill="#0A0A0A">LOCKED</tspan>`
      : ""
  }
  </text>

  <!-- host watermark, bottom-right -->
  <text x="1120" y="572"
        font-family="${MONO}"
        font-size="20" fill="#A3A3A3"
        text-anchor="end">${escapeForSvg(host)}</text>
</svg>`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function escapeForSvg(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
