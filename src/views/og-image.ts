// OG (Open Graph) images. Two flavors:
//   - OG_SVG       — site-wide card served at /og.svg
//   - dropOgSvg()  — per-drop card served at /p/:slug/og.svg
//
// 1200×630 is the canonical OG card dimension. SVG keeps each card under
// 2 KB and lets Cloudflare's edge cache it cheaply; modern social
// platforms render SVG OG images directly (Twitter/X, Discord, Slack,
// LinkedIn). Older crawlers will show the title/description but no
// preview image — acceptable trade for staying simple. Some preview
// tools warn about SVG; if that becomes a real problem, render to PNG
// at the edge with satori or Workers Image Resizing.
//
// We use system-ui font fallbacks because crawlers don't execute the
// page's @font-face load. The result looks slightly different per
// platform; that's the price of "basic, on-brand, nothing fancy."

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export const OG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="#FFFFFF"/>
  <!-- subtle hairline frame; very faint -->
  <rect x="40" y="40" width="1120" height="550" fill="none" stroke="#E5E5E5" stroke-width="1"/>
  <!-- wordmark -->
  <text x="100" y="170"
        font-family="${MONO}"
        font-size="44" font-weight="500" fill="#0A0A0A">
    <tspan fill="#E11D2C">&lt;</tspan>htmlbin<tspan fill="#E11D2C">&gt;</tspan>
  </text>
  <!-- hero line (one statement, two rows) -->
  <text x="100" y="345"
        font-family="${SANS}"
        font-size="84" font-weight="700" fill="#0A0A0A"
        letter-spacing="-2.5">API for <tspan fill="#E11D2C">agents</tspan></text>
  <text x="100" y="445"
        font-family="${SANS}"
        font-size="84" font-weight="700" fill="#0A0A0A"
        letter-spacing="-2.5">to share HTML.</text>
  <!-- corner watermark -->
  <text x="100" y="555"
        font-family="${MONO}"
        font-size="22" fill="#737373">
    htmlbin.dev <tspan fill="#A3A3A3">— agent-native HTML hosting</tspan>
  </text>
</svg>`;

// Per-drop OG card. GitHub-style centered composition: drop title is the
// hero, URL sits underneath as a mono subtitle, version + date in a
// stats row. For locked drops (or drops with no title) the slug stands
// in as the hero so we don't leak human-readable titles.
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

  // Hero text: the human-readable title when we have one, otherwise the
  // slug as `/p/abc1234` in mono — locked drops always fall through here.
  const heroText = safeTitle ? truncate(safeTitle, 32) : `/p/${slug}`;
  const heroMono = !safeTitle;
  const heroFont = heroMono ? MONO : SANS;
  const heroSize = heroMono ? 96 : 72;
  const heroWeight = heroMono ? 500 : 700;

  // Subtitle: the canonical URL when there's a title above, otherwise
  // empty (locked drops don't get a subtitle to avoid clutter).
  const subtitle = safeTitle
    ? `${host}/p/${slug}`
    : isLocked
      ? "password protected drop"
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="#FFFFFF"/>
  <rect x="40" y="40" width="1120" height="550" fill="none" stroke="#E5E5E5" stroke-width="1"/>

  <!-- wordmark, top-left -->
  <text x="100" y="140"
        font-family="${MONO}"
        font-size="36" font-weight="500" fill="#0A0A0A">
    <tspan fill="#E11D2C">&lt;</tspan>htmlbin<tspan fill="#E11D2C">&gt;</tspan>
  </text>

  <!-- hero (title or fallback slug) -->
  <text x="100" y="325"
        font-family="${heroFont}"
        font-size="${heroSize}" font-weight="${heroWeight}" fill="#0A0A0A"
        letter-spacing="${heroMono ? -2 : -1.5}">${
    heroMono
      ? `/p/<tspan fill="#E11D2C">${escapeForSvg(slug)}</tspan>`
      : escapeForSvg(heroText)
  }</text>

  ${
    subtitle
      ? `<!-- subtitle (canonical URL) -->
  <text x="100" y="385"
        font-family="${MONO}"
        font-size="28" fill="#737373">${escapeForSvg(subtitle)}</text>`
      : ""
  }

  <!-- stats row -->
  <text x="100" y="475"
        font-family="${MONO}"
        font-size="26" fill="#525252">
    v${latestVersion}<tspan fill="#A3A3A3">  ·  updated ${escapeForSvg(date)}</tspan>
  </text>

  <!-- corner watermark, bottom-left -->
  <text x="100" y="575"
        font-family="${MONO}"
        font-size="22" fill="#737373">
    ${escapeForSvg(host)} <tspan fill="#A3A3A3">— API for agents to share HTML</tspan>
  </text>
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
