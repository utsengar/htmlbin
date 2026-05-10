// Single source of truth for visual styles across every public page.
// Served at /style.css with a long edge cache. Touch this file → every page
// updates. Page-specific overrides are kept inline in their views, but the
// design language lives here.

export const STYLES_CSS = /* css */ `
:root {
  --bg: #FFFFFF;
  --bg-2: #FAFAFA;
  --bg-3: #F5F5F5;
  --ink: #0A0A0A;
  --ink-2: #171717;
  --ink-soft: #737373;
  --ink-softer: #A3A3A3;
  --rule: #E5E5E5;
  --rule-soft: #F0F0F0;
  --red: #E11D2C;
  --red-press: #B91624;
  --red-bg: #FEF2F3;
  --red-bg-stroke: #F4C7CB;
  --green-dot: #1F8F4A;
  --code-bg: #0A0A0A;
  --code-fg: #FAFAFA;
  --code-dim: #A3A3A3;
  --code-em: #FF6470;
  --sans: "Geist", -apple-system, "Inter", system-ui, sans-serif;
  --mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
::selection { background: var(--red); color: #fff; }
a {
  color: var(--ink);
  text-decoration: underline;
  text-decoration-color: var(--rule);
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
}
a:hover { color: var(--red); text-decoration-color: var(--red); }

/* ---------- top bar (dev-y modeline / breadcrumb) ----------
   Tells you literally where you are: <htmlbin> / VERB path · status
   No border, no fill — it floats as a header line of the same document
   so the whole page reads as one continuous artifact. */
.page-head {
  background: transparent;
}
.page-head .row {
  max-width: 720px; margin: 0 auto;
  padding: 22px 28px 0;
  display: flex; align-items: center; justify-content: space-between;
  font-family: var(--mono); font-size: 12px;
  gap: 16px;
}
.crumb {
  display: inline-flex; align-items: center; gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}
.crumb .wordmark {
  font-family: var(--mono); font-weight: 500; font-size: 13px;
  color: var(--ink); letter-spacing: -0.01em;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
  cursor: pointer;
  transition: text-decoration-color 0.12s;
}
.crumb .wordmark:hover { text-decoration-color: var(--red); color: var(--ink); }
.crumb .wordmark::before { content: "<"; color: var(--red); }
.crumb .wordmark::after  { content: ">"; color: var(--red); }
.crumb .home-arrow {
  color: var(--ink-softer);
  font-family: var(--mono);
  margin-right: 4px;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.12s;
}
.crumb .home-arrow:hover { color: var(--red); }
.crumb .slash { color: var(--ink-softer); }
.crumb .verb {
  color: var(--red); font-weight: 500;
  letter-spacing: 0.02em;
}
.crumb .path {
  color: var(--ink); font-weight: 400;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 26ch;
}
.crumb .ver {
  color: var(--ink-softer);
  margin-left: 2px;
}
.crumb .ver::before { content: "·"; padding-right: 6px; color: var(--ink-softer); }
.head-meta {
  display: flex; gap: 14px; color: var(--ink-soft);
  flex-wrap: wrap; flex-shrink: 0;
}
.head-meta a { text-decoration: none; }
.head-meta a:hover { color: var(--red); }
@media (max-width: 720px) {
  .page-head .row { padding: 10px 22px; }
  .crumb .path { max-width: 18ch; }
  .head-meta { display: none; }   /* on mobile, the breadcrumb stands alone */
}

/* ---------- main column ---------- */
main {
  max-width: 720px;
  margin: 0 auto;
  padding: 28px 28px 96px;   /* tight gap to the breadcrumb above */
}
@media (max-width: 720px) {
  .page-head .row { padding: 18px 22px 0; }
  main { padding: 22px 22px 80px; }
  .head-meta { gap: 12px; }
  html, body { font-size: 16px; }
}

/* ---------- HTTP-request memo block ----------
   Rendered as a real <details> disclosure: the request line is the
   summary (always visible), the headers + status line are collapsible.
   Default-expanded everywhere. The "▸" rotates 90° when open. */
details.req {
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.85;
  margin-bottom: 32px;
  position: relative;
}
details.req summary.reqline {
  list-style: none;
  cursor: pointer;
  user-select: none;
  color: var(--ink);
  margin-bottom: 4px;
  display: inline-block;
  padding-right: 8px;
  outline: none;
  transition: color 0.12s;
}
details.req summary.reqline::-webkit-details-marker { display: none; }
details.req summary.reqline::marker { content: ""; }
details.req summary.reqline:hover .verb { text-decoration-color: var(--red); }
details.req summary.reqline:focus-visible {
  outline: 1px dashed var(--red);
  outline-offset: 4px;
}
details.req summary.reqline .verb {
  color: var(--red); font-weight: 500;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 4px;
  transition: text-decoration-color 0.12s;
}
details.req summary.reqline .path  { color: var(--ink); }
details.req summary.reqline .proto { color: var(--ink-softer); }

/* The triangle prefix: lives on the summary so clicking it toggles the
   disclosure, exactly like clicking the request line itself.
   Rotates from ▸ (closed) to ▾ (open). */
details.req summary.reqline { position: relative; }
details.req summary.reqline::before {
  content: "▸";
  position: absolute;
  left: -22px; top: 0;
  color: var(--red);
  font-size: 12px;
  line-height: 1.85;
  transition: transform 0.15s ease-out;
  transform-origin: 30% 55%;
}
details.req[open] summary.reqline::before { transform: rotate(90deg); }
@media (max-width: 760px) { details.req summary.reqline::before { display: none; } }

details.req .rows {
  margin-top: 0;
  /* Subtle reveal animation on open. */
  animation: reqOpen 0.18s ease-out;
}
@keyframes reqOpen {
  from { opacity: 0; transform: translateY(-2px); }
  to   { opacity: 1; transform: none; }
}
details.req .row {
  display: grid;
  grid-template-columns: 78px 1fr;
  gap: 12px;
  align-items: baseline;
}
details.req .k {
  color: var(--ink-soft);
  font-size: 12.5px;
  font-weight: 400;
}
details.req .k::after { content: ":"; color: var(--ink-softer); }
details.req .v { color: var(--ink); font-weight: 500; }
details.req .v .em  { color: var(--red); }
details.req .v .dim { color: var(--ink-soft); font-weight: 400; }
details.req .resline {
  margin-top: 8px;
  color: var(--ink-soft);
}
details.req .resline .ok  { color: var(--green-dot); }
details.req .resline .bad { color: var(--red); }

/* hr.rule is intentionally invisible — the page flows by typography +
   whitespace, not by sectioning lines. We keep the class so existing
   markup doesn't break, but it adds no visual rule. */
hr.rule { display: none; }

/* ---------- prose ---------- */
.body p {
  margin: 0 0 24px;
  max-width: 64ch;
  font-size: 17px;
  line-height: 1.65;
  color: var(--ink-2);
}
.body p strong { color: var(--ink); font-weight: 600; }
.body p em { font-style: normal; color: var(--red); font-weight: 500; }

code, .mono {
  font-family: var(--mono);
  font-size: 0.86em;
}
.body p code, .body li code, p code, li code {
  background: var(--bg-2);
  border: 1px solid var(--rule);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
  font-weight: 500;
  color: var(--ink-2);
}

.lede {
  font-size: 19px; line-height: 1.5; color: var(--ink);
  margin-bottom: 24px; max-width: 56ch;
}

/* Big typographic anchor on the landing — gives the page a single focal
   moment without adding any new copy (the line is already in the prose
   below). Tight letter-spacing, near-black, with a muted subhead. */
.hero {
  margin: 32px 0 44px;
}
.hero h1 {
  font-size: clamp(38px, 5.6vw, 60px);
  line-height: 1.02;
  letter-spacing: -0.032em;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 14px;
  max-width: 18ch;
}
.hero h1 em {
  font-style: normal;
  color: var(--red);
}
.hero p {
  font-size: 20px;
  line-height: 1.4;
  color: var(--ink-soft);
  max-width: 50ch;
  margin: 0;
}
@media (max-width: 720px) {
  .hero { margin: 24px 0 36px; }
  .hero h1 { font-size: 36px; }
  .hero p  { font-size: 18px; }
}

/* ---------- prompt code block ---------- */
.prompt {
  position: relative;
  background: var(--code-bg);
  border-radius: 6px;
  margin: 30px 0 30px;
}
.prompt pre {
  font-family: var(--mono);
  font-size: 13.5px;
  line-height: 1.7;
  padding: 24px 24px 26px;
  color: var(--code-fg);
  white-space: pre-wrap;
  word-break: break-word;
}
.prompt pre .ph { color: var(--code-dim); }
.prompt pre .em { color: var(--code-em); }
.prompt .copy {
  position: absolute;
  top: 14px; right: 14px;
  display: inline-flex; align-items: center; gap: 6px;
  background: transparent;
  color: var(--code-dim);
  border: 1px solid #2A2A2A;
  padding: 5px 10px;
  font: 500 11px/1 var(--mono);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border-radius: 4px;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
}
.prompt .copy:hover {
  color: var(--bg); border-color: var(--red); background: var(--red);
}
.prompt .copy.ok { color: #6FE38B; border-color: #2A4A38; background: transparent; }
.prompt .copy svg { width: 11px; height: 11px; }

/* ---------- forms ---------- */
.form { display: flex; flex-direction: column; gap: 20px; max-width: 440px; margin-top: 8px; }
.field { display: flex; flex-direction: column; gap: 8px; }
.field .lbl {
  font-family: var(--mono); font-size: 11px; font-weight: 500;
  color: var(--ink-soft); letter-spacing: 0.08em; text-transform: uppercase;
}
.field input {
  font-family: var(--mono); font-size: 20px;
  background: transparent; border: 0;
  border-bottom: 1.5px solid var(--ink);
  padding: 10px 4px;
  letter-spacing: 0.04em;
  color: var(--ink);
  outline: none;
}
.field input:focus { border-color: var(--red); }
button.primary {
  align-self: flex-start;
  background: var(--ink); color: var(--bg);
  border: 1px solid var(--ink);
  font: 500 12px/1 var(--mono);
  letter-spacing: 0.04em; text-transform: uppercase;
  padding: 12px 20px; border-radius: 5px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
button.primary:hover { background: var(--red); border-color: var(--red); }
.fineprint {
  font-family: var(--mono); font-size: 12px;
  color: var(--ink-soft); line-height: 1.7; margin: 0;
}

.error {
  background: var(--red-bg);
  border: 1px solid var(--red-bg-stroke);
  border-left: 3px solid var(--red);
  color: #7F0E18;
  padding: 11px 14px;
  font-size: 14px; font-family: var(--mono);
  margin-bottom: 20px;
  border-radius: 4px;
}

/* ---------- signoff / footer ---------- */
.signoff {
  margin-top: 40px;
  padding-top: 22px;
  border-top: 1px solid var(--rule);
  font-family: var(--mono); font-size: 13px; color: var(--ink-soft);
  display: flex; align-items: baseline; justify-content: space-between;
  flex-wrap: wrap; gap: 14px;
}
.signoff .sig { color: var(--ink); font-weight: 500; }
.signoff .sig::before { content: "— "; color: var(--red); }
.signoff a { color: var(--ink-soft); text-decoration: none; }
.signoff a:hover { color: var(--red); }

footer.tail {
  background: transparent;
}
footer.tail .row {
  max-width: 720px; margin: 0 auto;
  padding: 8px 28px 32px;
  font-family: var(--mono); font-size: 11.5px; color: var(--ink-softer);
  display: flex; gap: 18px; flex-wrap: wrap; justify-content: space-between;
  letter-spacing: 0.02em;
}
@media (max-width: 720px) { footer.tail .row { padding: 8px 22px 32px; } }

/* ---------- manifesto-specific ---------- */
.eyebrow {
  font-family: var(--mono); font-size: 12px;
  color: var(--ink-soft); letter-spacing: 0.06em;
  text-transform: uppercase; margin-bottom: 12px;
}
h1.title {
  font-family: var(--sans);
  font-size: clamp(36px, 5vw, 52px);
  line-height: 1.05;
  letter-spacing: -0.025em;
  font-weight: 700;
  margin-bottom: 6px;
}
h1.title em { font-style: normal; color: var(--red); }
.subtitle {
  font-family: var(--mono); font-size: 13px;
  color: var(--ink-soft); letter-spacing: 0.02em;
  margin-bottom: 36px;
}
h2.section {
  font-family: var(--mono);
  font-size: 12px; letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--red);
  font-weight: 500;
  margin: 48px 0 12px;
}
.definition {
  background: var(--bg-2);
  border: 1px solid var(--rule);
  border-left: 3px solid var(--red);
  padding: 20px 24px;
  margin-bottom: 26px;
  font-size: 16px;
  border-radius: 4px;
}
.definition p { margin: 0 0 12px; max-width: none; }
.definition p:last-child { margin: 0; }
.definition .word { font-weight: 600; color: var(--red); }
.definition em { color: var(--ink-soft); font-style: italic; }

ol.principles, ol.principles li { list-style: none; padding: 0; }
ol.principles { counter-reset: p; }
ol.principles li {
  counter-increment: p;
  padding: 16px 0 16px 60px;
  border-bottom: 1px solid var(--rule-soft);
  position: relative;
}
ol.principles li:last-child { border-bottom: 0; }
ol.principles li::before {
  content: counter(p, decimal-leading-zero);
  position: absolute; left: 0; top: 18px;
  font-family: var(--mono); font-size: 13px;
  color: var(--red); font-weight: 500;
  letter-spacing: 0.04em;
}
ol.principles strong { display: block; margin-bottom: 4px; font-size: 17px; font-weight: 600; color: var(--ink); }
ol.principles span { color: var(--ink-soft); font-size: 16px; line-height: 1.55; }

table.types {
  border-collapse: collapse; width: 100%;
  font-size: 15px; margin-bottom: 22px;
}
table.types th, table.types td {
  text-align: left; padding: 12px 14px;
  border-bottom: 1px solid var(--rule-soft);
}
table.types th {
  font: 500 11px/1 var(--mono);
  color: var(--ink-soft); letter-spacing: 0.06em;
  text-transform: uppercase;
}
table.types td:first-child {
  font-family: var(--mono); font-size: 13.5px;
  color: var(--red); white-space: nowrap; width: 100px;
}
table.types td:last-child { color: var(--ink-2); }

pre.lifecycle {
  font-family: var(--mono); font-size: 12.5px;
  line-height: 1.8;
  background: var(--code-bg);
  color: var(--code-fg);
  border-radius: 6px;
  padding: 22px 24px;
  overflow-x: auto;
  margin-bottom: 24px;
  white-space: pre;
}

.foot-back {
  margin-top: 56px; padding-top: 24px;
  border-top: 1px solid var(--rule);
  font-family: var(--mono); font-size: 13px;
}
.foot-back a { color: var(--ink-soft); text-decoration: none; }
.foot-back a:hover { color: var(--red); }

/* ---------- 404 ---------- */
.notfound {
  display: flex; flex-direction: column; gap: 6px;
}
.notfound .stamp {
  font-family: var(--mono); font-size: 12px;
  color: var(--red); letter-spacing: 0.16em; text-transform: uppercase;
  margin-bottom: 6px;
}
.notfound h1 {
  font-size: clamp(48px, 9vw, 80px); line-height: 1.05;
  letter-spacing: -0.025em; font-weight: 700;
  margin-bottom: 12px;
}
.notfound p {
  color: var(--ink-soft); font-size: 18px; max-width: 50ch;
}

/* ---------- viewer bar ---------- */
.viewer-bar {
  display: flex; align-items: center; gap: 14px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--rule);
  background: var(--bg-2);
  flex-wrap: wrap;
  font-size: 13px;
  font-family: var(--sans);
}
.viewer-bar .sep { color: var(--ink-softer); font-family: var(--mono); }
.viewer-bar .title {
  font-weight: 600; font-size: 14px; color: var(--ink);
  max-width: 36vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.viewer-bar .desc {
  font-size: 13px; color: var(--ink-soft);
  max-width: 38vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.viewer-bar .right {
  margin-left: auto;
  display: flex; align-items: center; gap: 14px;
  font-family: var(--mono); font-size: 12px; color: var(--ink-soft);
}
.viewer-bar .right a { color: inherit; }
.viewer-bar .right a:hover { color: var(--red); }
.lock-pill {
  background: var(--ink); color: var(--bg);
  padding: 3px 9px; border-radius: 999px;
  font: 500 10.5px/1 var(--mono);
  letter-spacing: 0.04em; text-transform: uppercase;
}
iframe.canvas { border: 0; width: 100%; background: #fff; flex: 1; }

/* ---------- locked drop gate ---------- */
.gate-lede { font-size: 19px; line-height: 1.5; color: var(--ink); margin-bottom: 22px; max-width: 56ch; }
`;
