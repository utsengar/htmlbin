// OG (Open Graph) image. Served at /og.svg and referenced by the
// og:image / twitter:image meta tags on the landing page.
//
// 1200×630 is the canonical OG card dimension. SVG keeps the file under
// 2 KB and lets Cloudflare's edge cache it forever; modern social
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
        letter-spacing="-2.5">A home for the HTML</text>
  <text x="100" y="445"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
        font-size="84" font-weight="700"
        letter-spacing="-2.5">
    <tspan fill="#E11D2C">your agent</tspan><tspan fill="#0A0A0A"> writes.</tspan>
  </text>
  <!-- corner watermark -->
  <text x="100" y="555"
        font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
        font-size="22" fill="#737373">
    htmlbin.dev <tspan fill="#A3A3A3">— agent-native HTML hosting</tspan>
  </text>
</svg>`;
