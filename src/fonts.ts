// Self-hosted Geist + Geist Mono woff2 files.
//
// Lighthouse called out the Google Fonts CSS round-trip as ~750ms of
// render-blocking time on Slow 4G. Self-hosting moves the font fetch
// from `fonts.googleapis.com` → `fonts.gstatic.com` (DNS + TCP + TLS
// for each, on the critical path) to a single same-origin request
// against the Worker (no extra DNS, reuses the existing TLS connection).
//
// The .woff2 files live in assets/fonts/ and are bundled into the
// Worker as ArrayBuffers via wrangler's `type = "Data"` rule.
//
// Geist + Geist Mono are SIL Open Font License (OFL-1.1).

// @ts-expect-error — wrangler Data loader yields an ArrayBuffer at build time
import geist400 from "../assets/fonts/Geist-400.woff2";
// @ts-expect-error
import geist500 from "../assets/fonts/Geist-500.woff2";
// @ts-expect-error
import geist600 from "../assets/fonts/Geist-600.woff2";
// @ts-expect-error
import geist700 from "../assets/fonts/Geist-700.woff2";
// @ts-expect-error
import geistMono400 from "../assets/fonts/GeistMono-400.woff2";
// @ts-expect-error
import geistMono500 from "../assets/fonts/GeistMono-500.woff2";

export const FONTS: Record<string, ArrayBuffer> = {
  "Geist-400.woff2": geist400 as ArrayBuffer,
  "Geist-500.woff2": geist500 as ArrayBuffer,
  "Geist-600.woff2": geist600 as ArrayBuffer,
  "Geist-700.woff2": geist700 as ArrayBuffer,
  "GeistMono-400.woff2": geistMono400 as ArrayBuffer,
  "GeistMono-500.woff2": geistMono500 as ArrayBuffer,
};

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
