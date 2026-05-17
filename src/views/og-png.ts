// Dynamic PNG og:image rendering for htmlbin.
//
// Why PNG and not SVG? Slack, Twitter, iMessage, and Facebook do not
// render SVG og:images. Discord and a couple of others do. To get a
// working preview thumbnail across the platforms people actually share
// links on, og:image has to be PNG/JPEG.
//
// Pipeline:
//   1. satori     — turn an AST tree into an SVG string
//   2. resvg-wasm — rasterise the SVG into a PNG byte array
//
// We build satori's AST directly (no `satori-html`) because that parser
// does not decode HTML entities — &lt; / &gt; render as literal four-char
// strings, breaking the <htmlbin> wordmark. Going straight to the AST
// also keeps the angle brackets as plain text characters, avoiding any
// HTML-escape contortions.
//
// All three steps run inside the Worker. WASM is initialised once per
// isolate; fonts are fetched once and reused. Routes that call this
// module should KV-cache the resulting PNG per slug+version so we render
// each unique drop's OG card once per version, not once per Slack /
// Twitter / iMessage preview bot.

// Use the `standalone` entry so we control when/how Yoga is instantiated.
// The default `satori` entry auto-loads `yoga.wasm` via WebAssembly.compile,
// which Workers blocks. With `standalone` + a precompiled WebAssembly.Module,
// the runtime path is WebAssembly.instantiate(module, imports) — allowed.
import satori, { init as initSatori } from "satori/standalone";
// @ts-expect-error — wrangler [[rules]] CompiledWasm gives a Module instance.
import yogaWasmModule from "satori/yoga.wasm";
// @ts-expect-error — same; precompiled WebAssembly.Module from wrangler.
import resvgWasmModule from "@resvg/resvg-wasm/index_bg.wasm";
import { Resvg, initWasm as initResvgWasm } from "@resvg/resvg-wasm";

import type { Bindings } from "../types";

// ----- one-time setup, cached across requests in the same isolate ---

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = Promise.all([
      initSatori(yogaWasmModule as WebAssembly.Module),
      initResvgWasm(resvgWasmModule as WebAssembly.Module),
    ]).then(() => undefined);
  }
  return wasmReady;
}

type FontSet = Array<{
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600 | 700;
  style: "normal";
}>;

let fontsCache: FontSet | null = null;

// Geist + Geist Mono from the @fontsource CDN (jsDelivr). One file per
// weight/family. Geist 500 matches the wordmark and headline weight;
// Geist Mono 400 / 500 cover meta rows and HTTP-style code.
const FONT_URLS = {
  geist500:
    "https://cdn.jsdelivr.net/npm/@fontsource/geist@5.1.0/files/geist-latin-500-normal.woff",
  geistMono400:
    "https://cdn.jsdelivr.net/npm/@fontsource/geist-mono@5.1.0/files/geist-mono-latin-400-normal.woff",
  geistMono500:
    "https://cdn.jsdelivr.net/npm/@fontsource/geist-mono@5.1.0/files/geist-mono-latin-500-normal.woff",
};

const KV_KEY = "og-fonts:v1";

async function ensureFonts(env: Bindings): Promise<FontSet> {
  if (fontsCache) return fontsCache;

  // Try KV first — survives cold starts of new isolates.
  const cached = await env.DROPS_KV.get(KV_KEY, { type: "arrayBuffer" });
  if (cached) {
    fontsCache = unpackFontBundle(cached);
    return fontsCache;
  }

  // Cold path: fetch all three font files in parallel, pack into a single
  // KV blob so the next isolate cold-start needs only one KV read.
  const [geist500, geistMono400, geistMono500] = await Promise.all([
    fetch(FONT_URLS.geist500).then(failOnNotOk).then((r) => r.arrayBuffer()),
    fetch(FONT_URLS.geistMono400).then(failOnNotOk).then((r) => r.arrayBuffer()),
    fetch(FONT_URLS.geistMono500).then(failOnNotOk).then((r) => r.arrayBuffer()),
  ]);

  fontsCache = [
    { name: "Geist", data: geist500, weight: 500, style: "normal" },
    { name: "Geist Mono", data: geistMono400, weight: 400, style: "normal" },
    { name: "Geist Mono", data: geistMono500, weight: 500, style: "normal" },
  ];

  // Cache the bundle in KV. Long TTL — fonts don't change often.
  // We don't await this; it's fine to miss once if the put errors.
  const bundle = packFontBundle(fontsCache);
  env.DROPS_KV.put(KV_KEY, bundle, { expirationTtl: 60 * 60 * 24 * 30 }).catch(
    () => {}
  );

  return fontsCache;
}

async function failOnNotOk(r: Response): Promise<Response> {
  if (!r.ok) throw new Error(`font fetch failed: ${r.status} ${r.url}`);
  return r;
}

// Tiny binary container: [count:u8] [(nameLen:u8 name:utf8 weight:u16 dataLen:u32 data)*]
function packFontBundle(fonts: FontSet): ArrayBuffer {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  parts.push(new Uint8Array([fonts.length]));
  for (const f of fonts) {
    const nameBytes = enc.encode(f.name);
    parts.push(new Uint8Array([nameBytes.length]));
    parts.push(nameBytes);
    parts.push(u16(f.weight));
    parts.push(u32(f.data.byteLength));
    parts.push(new Uint8Array(f.data));
  }
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out.buffer;
}

function unpackFontBundle(buf: ArrayBuffer): FontSet {
  const dec = new TextDecoder();
  const v = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let off = 0;
  const count = v.getUint8(off);
  off += 1;
  const out: FontSet = [];
  for (let i = 0; i < count; i++) {
    const nameLen = v.getUint8(off);
    off += 1;
    const name = dec.decode(u8.subarray(off, off + nameLen));
    off += nameLen;
    const weight = v.getUint16(off, false) as 400 | 500 | 600 | 700;
    off += 2;
    const dataLen = v.getUint32(off, false);
    off += 4;
    const data = buf.slice(off, off + dataLen);
    off += dataLen;
    out.push({ name, data, weight, style: "normal" });
  }
  return out;
}

function u16(n: number): Uint8Array {
  const a = new Uint8Array(2);
  new DataView(a.buffer).setUint16(0, n, false);
  return a;
}
function u32(n: number): Uint8Array {
  const a = new Uint8Array(4);
  new DataView(a.buffer).setUint32(0, n, false);
  return a;
}

// ----- AST helpers --------------------------------------------------
//
// Satori's tree is plain `{ type, props: { style, children } }` objects.
// Building it directly (instead of going through satori-html) keeps every
// character literal — angle brackets, em-dashes, ellipses — exactly as
// written, with no entity-decoding step.

type Style = Record<string, string | number>;
type Node = { type: string; props: { style?: Style; children?: any } };

function el(type: string, style: Style, children?: any): Node {
  return { type, props: { style, children } };
}
const div = (style: Style, children?: any) => el("div", style, children);
const span = (style: Style, children?: any) => el("span", style, children);

// ----- public renderers ---------------------------------------------

export type DropOgProps = {
  slug: string;
  title: string;
  isLocked: boolean;
  latestVersion: number;
  updatedAt: number; // unix ms
  publicUrl: string;
};

export async function renderDropOgPng(
  env: Bindings,
  p: DropOgProps
): Promise<Uint8Array> {
  await ensureWasm();
  const fonts = await ensureFonts(env);

  const date = new Date(p.updatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const titleShort = truncateChars(p.title, 90);
  const host = stripScheme(p.publicUrl);

  const RED = "#D93025";
  const RULE = "#E5E5E5";
  const INK = "#0A0A0A";
  const SOFT = "#737373";
  const SOFTER = "#A3A3A3";

  // Layout: title block sits at the top-left with generous whitespace
  // below it; metadata row anchors the bottom. The card stops shouting
  // when the headline is given air instead of stretched to fill.
  const tree = div(
    {
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      width: "1200px",
      height: "630px",
      background: "#FFFFFF",
      padding: "80px",
      fontFamily: "Geist",
      color: INK,
    },
    [
      // TOP — breadcrumb + title, grouped tight
      div(
        { display: "flex", flexDirection: "column" },
        [
          // small breadcrumb
          div(
            {
              display: "flex",
              alignItems: "center",
              fontFamily: "Geist Mono",
              fontSize: 24,
              fontWeight: 500,
              marginBottom: "40px",
            },
            [
              span({ color: RED }, "<"),
              span({ color: INK }, "htmlbin"),
              span({ color: RED }, ">"),
              span({ margin: "0 14px", color: RULE }, "/"),
              span({ color: SOFT }, `/p/${p.slug}`),
            ]
          ),
          // title — top-left, sized for two lines of breathing room
          div(
            {
              display: "flex",
              fontSize: 56,
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: INK,
            },
            titleShort
          ),
        ]
      ),

      // BOTTOM — meta on the left, host on the right
      div(
        {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "Geist Mono",
          fontSize: 20,
          fontWeight: 400,
          color: SOFT,
        },
        [
          div(
            { display: "flex", alignItems: "center", gap: "20px" },
            [
              span({}, `v${p.latestVersion}`),
              span({ color: RULE }, "·"),
              span({}, date),
              ...(p.isLocked
                ? [
                    span({ color: RULE }, "·"),
                    span(
                      {
                        display: "flex",
                        alignItems: "center",
                        background: INK,
                        color: "#FFFFFF",
                        borderRadius: 999,
                        padding: "3px 12px",
                        fontSize: 14,
                        fontWeight: 500,
                        letterSpacing: "0.04em",
                      },
                      "LOCKED"
                    ),
                  ]
                : []),
            ]
          ),
          div({ display: "flex", color: SOFTER }, host),
        ]
      ),
    ]
  );

  const svg = await satori(tree as any, {
    width: 1200,
    height: 630,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

export type LandingOgProps = {
  publicUrl: string;
};

export async function renderLandingOgPng(
  env: Bindings,
  p: LandingOgProps
): Promise<Uint8Array> {
  await ensureWasm();
  const fonts = await ensureFonts(env);

  const RED = "#D93025";
  const INK = "#0A0A0A";
  const SOFT = "#737373";
  const SOFTER = "#A3A3A3";
  const host = stripScheme(p.publicUrl);

  // Layout mirrors the per-drop card: wordmark + title + subtitle grouped
  // top-left with a tight rhythm, then generous whitespace, then a thin
  // host watermark at the bottom-right.
  const tree = div(
    {
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      width: "1200px",
      height: "630px",
      background: "#FFFFFF",
      padding: "80px",
      fontFamily: "Geist",
      color: INK,
    },
    [
      // TOP — wordmark + headline + subtitle stacked tight
      div(
        { display: "flex", flexDirection: "column" },
        [
          // wordmark
          div(
            {
              display: "flex",
              alignItems: "center",
              fontFamily: "Geist Mono",
              fontSize: 26,
              fontWeight: 500,
              marginBottom: "40px",
            },
            [
              span({ color: RED }, "<"),
              span({ color: INK }, "htmlbin"),
              span({ color: RED }, ">"),
            ]
          ),

          // headline — top-left, two tight lines, single red accent
          div(
            {
              display: "flex",
              flexDirection: "column",
              fontSize: 64,
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: INK,
              marginBottom: "24px",
            },
            [
              div({ display: "flex" }, "A home for the HTML"),
              div({ display: "flex" }, [
                span({ color: RED }, "your agent"),
                span({ marginLeft: "18px" }, "writes."),
              ]),
            ]
          ),

          // subtitle — clearly subordinate to the headline
          div(
            {
              display: "flex",
              fontSize: 24,
              fontWeight: 400,
              color: SOFT,
            },
            "Agent-native, end to end."
          ),
        ]
      ),

      // BOTTOM — host watermark on the right
      div(
        {
          display: "flex",
          justifyContent: "flex-end",
          fontFamily: "Geist Mono",
          fontSize: 20,
          color: SOFTER,
        },
        host
      ),
    ]
  );

  const svg = await satori(tree as any, {
    width: 1200,
    height: 630,
    fonts,
  });
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

function truncateChars(s: string, n: number): string {
  const t = (s ?? "").trim().replace(/\s+/g, " ");
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + "…";
}
