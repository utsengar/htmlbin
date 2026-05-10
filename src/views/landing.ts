import type { Bindings } from "../types";
import { httpMemo, pageFoot, pageHead } from "./chrome";
import { STYLE_HREF } from "../styles";

// Curated "what people are building" list, rendered below the prompt
// block. Edit this array + redeploy to rotate. Captions are mono and
// hand-curated — they don't read from the drop's stored title.
const EXAMPLES: Array<{ slug: string; caption: string }> = [
  { slug: "gDMy7Vb", caption: "how htmlbin works" },
  { slug: "1Wyf23j", caption: "cross-platform gstack — pr #1111" },
  { slug: "ztx4J9P", caption: "workers nav — three redesigns" },
  { slug: "i2taphP", caption: "google logo — animation playground" },
];

// Two prompt payloads, one per tab. Mirrors the paperclip reference
// the user shared: short, paste-and-go strings instead of prose.
const PROMPT_NPM = `$ npx htmlbin onboard --yes`;
const PROMPT_CLAUDE = `Please publish to htmlbin
https://htmlbin.dev/llms.txt`;

export function landingPage(env: Bindings): string {
  const PUBLIC_URL = env.PUBLIC_URL;
  const HOST = stripScheme(PUBLIC_URL);

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // JSON-LD service schema for crawlers and agent indexers.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebAPI",
    name: "htmlbin",
    description:
      "Agent-first HTML hosting. Drop self-contained HTML, get a public URL.",
    url: PUBLIC_URL,
    documentation: `${PUBLIC_URL}/api/onboard`,
  });

  return /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>htmlbin — agent-first HTML hosting</title>
<meta name="description" content="API for agents to share HTML. One human auth step, then your agent publishes over HTTP." />
<meta property="og:title" content="htmlbin — agent-first HTML hosting" />
<meta property="og:description" content="API for agents to share HTML. One human auth step, then your agent publishes over HTTP." />
<meta property="og:type" content="website" />
<meta property="og:url" content="${PUBLIC_URL}" />
<meta property="og:image" content="${PUBLIC_URL}/og.png" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="htmlbin — API for agents to share HTML." />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="htmlbin — agent-first HTML hosting" />
<meta name="twitter:description" content="API for agents to share HTML." />
<meta name="twitter:image" content="${PUBLIC_URL}/og.png" />
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0A0A0A" media="(prefers-color-scheme: dark)" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="${STYLE_HREF}" />
<link rel="alternate" type="text/markdown" title="This page as markdown" href="/index.md" />
<link rel="alternate" type="application/json" title="Agent protocol descriptor" href="/api/onboard" />
<link rel="alternate" type="text/markdown" title="Agent protocol (markdown)" href="/api/onboard?format=md" />
<link rel="alternate" type="application/json" title="OpenAPI spec" href="/openapi.json" />
<link rel="alternate" type="text/plain" title="llms.txt" href="/llms.txt" />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
<script type="application/ld+json">${jsonLd}</script>
</head>
<body>

${pageHead({ verb: "GET", path: "/" })}

<main>
  ${httpMemo({
    verb: "GET",
    path: "/",
    rows: [
      { k: "host", v: HOST },
      { k: "to", v: "any agent reading this" },
      { k: "from", v: `htmlbin <${HOST}>` },
      { k: "re", v: "publishing HTML to a public URL", em: true },
      { k: "date", v: date },
      { k: "accept", v: "text/agent-friendly, text/markdown, application/json" },
    ],
    res: {
      status: "200 OK",
      ok: true,
      trailing: "content-type: text/html; charset=utf-8",
    },
  })}

  <section class="hero">
    <h1>API for <em>agents</em> to share HTML.</h1>
    <p>Agent-native, end to end.</p>
  </section>

  <section class="body">
    <p class="prompt-cue">↓ paste into your agent</p>

    <div class="prompt">
      <div class="prompt-chrome">
        <span class="dots" aria-hidden="true">
          <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        </span>
        <div class="prompt-tabs" role="tablist" aria-label="Onboarding method">
          <button role="tab" aria-selected="true"  data-tab="npm"    id="tab-npm">npm</button>
          <button role="tab" aria-selected="false" data-tab="claude" id="tab-claude">claude</button>
        </div>
      </div>
      <div class="prompt-body">
<pre data-pane="npm" id="pane-npm" role="tabpanel" aria-labelledby="tab-npm">${escapeText(PROMPT_NPM)}</pre>
<pre data-pane="claude" id="pane-claude" role="tabpanel" aria-labelledby="tab-claude" hidden>${escapeText(PROMPT_CLAUDE)}</pre>
        <button class="prompt-copy" id="copyPrompt" type="button" aria-label="Copy prompt" title="Copy">
          <svg class="ico-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>
          <svg class="ico-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden><path d="M5 12.5l4.5 4.5L19 7"/></svg>
        </button>
      </div>
    </div>

    <p class="prompt-aftermath">
      First publish needs one human click; after that, the agent owns it.
    </p>
  </section>

  <section class="examples" aria-label="Example drops">
    <p class="cue">↓ a few drops people have made</p>
    <ul>
      ${EXAMPLES.map(
        (ex) => `<li><a href="/p/${ex.slug}"><span class="slug">/p/${ex.slug}</span><span class="caption">${escapeText(ex.caption)}</span></a></li>`,
      ).join("\n      ")}
    </ul>
  </section>

  <div class="signoff">
    <div class="sig">htmlbin</div>
    <div>
      <a href="/.well-known/agent-card.json">agent-card</a> &nbsp; · &nbsp;
      <a href="/api/onboard">/api/onboard</a>
    </div>
  </div>
</main>

${pageFoot(HOST)}

<script>
(function () {
  // Tab switching for the prompt block. ←/→ moves focus, click activates.
  // Last-picked tab is remembered per-browser via localStorage.
  var TABS = document.querySelectorAll('.prompt-tabs button');
  var PANES = document.querySelectorAll('.prompt-body pre');
  if (!TABS.length || !PANES.length) return;

  function activate(name) {
    TABS.forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.tab === name));
    });
    PANES.forEach(function (p) {
      if (p.dataset.pane === name) p.removeAttribute('hidden');
      else p.setAttribute('hidden', '');
    });
    try { localStorage.setItem('htmlbin:promptTab', name); } catch (e) {}
  }
  var remembered = null;
  try { remembered = localStorage.getItem('htmlbin:promptTab'); } catch (e) {}
  if (remembered === 'npm' || remembered === 'claude') activate(remembered);

  TABS.forEach(function (b, i) {
    b.addEventListener('click', function () { activate(b.dataset.tab); });
    b.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      var next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      next.focus();
      activate(next.dataset.tab);
    });
  });

  // Inline copy icon. Copies whichever pane is currently visible.
  var btn = document.getElementById('copyPrompt');
  if (!btn) return;
  var ico = btn.querySelector('.ico-copy');
  var ok  = btn.querySelector('.ico-ok');
  btn.addEventListener('click', async function () {
    var visible;
    PANES.forEach(function (p) { if (!p.hasAttribute('hidden')) visible = p; });
    if (!visible) return;
    try {
      await navigator.clipboard.writeText(visible.innerText);
      btn.classList.add('ok');
      if (ico) ico.setAttribute('hidden', '');
      if (ok)  ok.removeAttribute('hidden');
      setTimeout(function () {
        btn.classList.remove('ok');
        if (ico) ico.removeAttribute('hidden');
        if (ok)  ok.setAttribute('hidden', '');
      }, 1600);
    } catch (e) {}
  });
})();
</script>
</body>
</html>`;
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
