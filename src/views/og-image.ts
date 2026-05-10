// OG (Open Graph) images. Two flavors:
//   - OG_SVG       — site-wide card served at /og.svg
//   - dropOgSvg()  — per-drop card served at /p/:slug/og.svg
//
// 1200×630 is the canonical OG card dimension. SVG keeps each card under
// 2 KB and lets Cloudflare's edge cache it cheaply; modern social
// platforms render SVG OG images directly (Twitter/X, Discord, Slack,
// LinkedIn). Older crawlers will show the title/description but no
// preview image — acceptable trade for staying simple.
//
// We use system-ui font fallbacks because crawlers don't execute the
// page's @font-face load. The result looks slightly different per
// platform; that's the price of "basic, on-brand, nothing fancy."

export const OG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="#FFFFFF"/>
  <!-- subtle hairline frame; very faint -->
  <rect x="40" y="40" width="1120" height="550" fill="none" stroke="#E5E5E5" stroke-width="1"/>
  <!-- wordmark -->
  <text x="100" y="170"
        font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
        font-size="44" font-weight="500" fill="#0A0A0A">
    <tspan fill="#E11D2C">&lt;</tspan>htmlbin<tspan fill="#E11D2C">&gt;</tspan>
  </text>
  <!-- hero line (one statement, two rows) -->
  <text x="100" y="345"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
        font-size="84" font-weight="700" fill="#0A0A0A"
        letter-spacing="-2.5">API for <tspan fill="#E11D2C">agents</tspan></text>
  <text x="100" y="445"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
        font-size="84" font-weight="700" fill="#0A0A0A"
        letter-spacing="-2.5">to share HTML.</text>
  <!-- corner watermark -->
  <text x="100" y="555"
        font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
        font-size="22" fill="#737373">
    htmlbin.dev <tspan fill="#A3A3A3">— agent-native HTML hosting</tspan>
  </text>
</svg>`;

// Per-drop OG card. Shows the slug as the identifier (it's what's in the
// URL anyway), version count, and last-updated date. No title or
// description — those are agent-supplied and may be sensitive on
// password-protected drops.
export function dropOgSvg(opts: {
  slug: string;
  latestVersion: number;
  updatedAt: number;
}): string {
  const { slug, latestVersion, updatedAt } = opts;
  const date = new Date(updatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="#FFFFFF"/>
  <rect x="40" y="40" width="1120" height="550" fill="none" stroke="#E5E5E5" stroke-width="1"/>
  <!-- wordmark -->
  <text x="100" y="170"
        font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
        font-size="44" font-weight="500" fill="#0A0A0A">
    <tspan fill="#E11D2C">&lt;</tspan>htmlbin<tspan fill="#E11D2C">&gt;</tspan>
  </text>
  <!-- the slug — this is the "name" of the drop -->
  <text x="100" y="380"
        font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
        font-size="120" font-weight="500" fill="#0A0A0A"
        letter-spacing="-3">/p/<tspan fill="#E11D2C">${escapeForSvg(slug)}</tspan></text>
  <!-- version + date row -->
  <text x="100" y="455"
        font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
        font-size="32" fill="#525252">
    v${latestVersion}<tspan fill="#A3A3A3"> · updated ${escapeForSvg(date)}</tspan>
  </text>
  <!-- corner watermark -->
  <text x="100" y="555"
        font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
        font-size="22" fill="#737373">
    htmlbin.dev <tspan fill="#A3A3A3">— API for agents to share HTML</tspan>
  </text>
</svg>`;
}

function escapeForSvg(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
