// Self-hosted Geist + Geist Mono woff2 files.
//
// Lighthouse called out the Google Fonts CSS round-trip as ~750ms of
// render-blocking time on Slow 4G. Self-hosting moves the font fetch
// from `fonts.googleapis.com` → `fonts.gstatic.com` (DNS + TCP + TLS
// for each, on the critical path) to a single same-origin request
// against the Worker (no extra DNS, reuses the existing TLS connection).
//
// The .woff2 bytes are base64-inlined in src/fonts-data.ts (generated
// from assets/fonts/*.woff2 by scripts/build-fonts.mjs). Wrangler's
// [[rules]] type="Data" loader does not honor imports outside src/
// with ES module Workers, so base64 is the reliable path.
//
// Geist + Geist Mono are SIL Open Font License (OFL-1.1).

import { FONTS_BASE64 } from "./fonts-data";

function decodeBase64(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Decode once at module init (cold-start cost only). Each entry is a
// fresh ArrayBuffer ready to ship as a Response body.
export const FONTS: Record<string, ArrayBuffer> = Object.fromEntries(
  Object.entries(FONTS_BASE64).map(([name, b64]) => [name, decodeBase64(b64)])
);

// Standard @font-face CSS for the local fonts. Inlined into the global
// stylesheet so there is no extra request for the @font-face declarations.
// `font-display: swap` lets the page render in system font immediately
// and swap when Geist arrives — text appears in <100ms even on cold,
// slow connections, instead of waiting for the font to download.
export const FONT_FACE_CSS = `
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/Geist-400.woff2') format('woff2');
}
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/fonts/Geist-500.woff2') format('woff2');
}
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/fonts/Geist-600.woff2') format('woff2');
}
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/Geist-700.woff2') format('woff2');
}
@font-face {
  font-family: 'Geist Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/GeistMono-400.woff2') format('woff2');
}
@font-face {
  font-family: 'Geist Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/fonts/GeistMono-500.woff2') format('woff2');
}
`;
