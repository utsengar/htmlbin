import type { Bindings } from "../types";
import { STYLE_INLINE } from "../styles";
import { AGENT_MARKS, AGENTS_WITHOUT_MARKS, GITHUB_MARK } from "./logos";

// Curated "a few drops people have made" list. Edit this array + redeploy
// to rotate. Captions and `kind` labels are hand-written — they don't read
// from the drop's stored title.
const EXAMPLES: Array<{ slug: string; caption: string; kind: string }> = [
  { slug: "gDMy7Vb",   caption: "how htmlbin works — an animated explainer",  kind: "explainer" },
  { slug: "1Wyf23j",   caption: "cross-platform gstack — pr #1111 deep dive", kind: "pr writeup" },
  { slug: "ztx4J9P",   caption: "workers nav — three redesigns side by side", kind: "design" },
  { slug: "i2taphP",   caption: "google logo — animation playground",         kind: "playful" },
  { slug: "HYmZ6DjCM", caption: "plan: queryable drop metadata",              kind: "plan / spec" },
];

// The drop embedded above the fold as evidence. Picked because it is light
// (the prompt slab above it is already dark), visually rich, and reads
// instantly as work somebody would actually send. `/raw` is used so the
// viewer chrome isn't nested inside our own frame, and that route does NOT
// bump view_count — see the /p/:slug/raw handler in index.ts — so embedding
// it on every homepage hit doesn't inflate this drop's counter.
//
// If this slug is ever deleted the frame goes blank. Swap it here.
const SHOWCASE_SLUG = "ztx4J9P";

// Clipboard payloads for the three tabs. Keep each visible pane to THREE
// rendered lines: the panes share one grid cell so the slab can't jump on
// tab change, which means it sizes to the tallest — and a shorter pane then
// shows dead black space underneath.
const AGENT_PROMPT = `Explain this as an HTML page — visual, not a wall of text.

Publish it to htmlbin.dev. Start at htmlbin.dev/api/onboard.`;

const CLI_PROMPT = `npm i -g @htmlbin/cli && htmlbin login
htmlbin publish ./plan.html`;

const SKILL_PROMPT = `npx skills add utsengar/htmlbin-cli --skill htmlbin-publish`;

export function landingPage(env: Bindings): string {
  const PUBLIC_URL = env.PUBLIC_URL;
  const HOST = stripScheme(PUBLIC_URL);

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebAPI",
    name: "htmlbin",
    description:
      "Agent-first HTML hosting. Drop self-contained HTML, get a public URL.",
    url: PUBLIC_URL,
    documentation: `${PUBLIC_URL}/api/onboard`,
  });

  const marks = AGENT_MARKS.map(
    (m) =>
      `<span class="lg" title="${escapeAttr(m.name)}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${m.path}"/></svg>${escapeText(m.name)}</span>`,
  ).join("\n        ");

  return /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>htmlbin — agent-first HTML hosting</title>
<meta name="description" content="Your agent writes HTML. You get a URL. One human click to start, then your agent publishes on its own." />
<meta property="og:title" content="htmlbin — agent-first HTML hosting" />
<meta property="og:description" content="Your agent writes HTML. You get a URL." />
<meta property="og:type" content="website" />
<meta property="og:url" content="${PUBLIC_URL}" />
<meta property="og:image" content="${PUBLIC_URL}/og.png" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="htmlbin — API for agents to share HTML." />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="htmlbin — agent-first HTML hosting" />
<meta name="twitter:description" content="Your agent writes HTML. You get a URL." />
<meta name="twitter:image" content="${PUBLIC_URL}/og.png" />
<meta name="theme-color" content="#F4F5F6" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0A0A0A" media="(prefers-color-scheme: dark)" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
${STYLE_INLINE}
<script src="/sentry.js" defer></script>
<link rel="alternate" type="text/markdown" title="This page as markdown" href="/index.md" />
<link rel="alternate" type="application/json" title="Agent protocol descriptor" href="/api/onboard" />
<link rel="alternate" type="text/markdown" title="Agent protocol (markdown)" href="/api/onboard?format=md" />
<link rel="alternate" type="application/json" title="OpenAPI spec" href="/openapi.json" />
<link rel="alternate" type="text/plain" title="llms.txt" href="/llms.txt" />
<link rel="preload" as="font" type="font/woff2" href="/fonts/Geist-700.woff2" crossorigin="anonymous" />
<link rel="preload" as="font" type="font/woff2" href="/fonts/Geist-400.woff2" crossorigin="anonymous" />
<link rel="preload" as="font" type="font/woff2" href="/fonts/GeistMono-400.woff2" crossorigin="anonymous" />
<script type="application/ld+json">${jsonLd}</script>
</head>
<body class="landing">

<nav class="lnav">
  <div class="in">
    <a href="/" class="wm" title="htmlbin home">htmlbin</a>
    <div class="links">
      <a href="/api/onboard">Docs</a>
      <a href="/.well-known/patterns/index.json">Patterns</a>
      <a href="https://github.com/utsengar/htmlbin-cli" target="_blank" rel="noopener noreferrer">CLI</a>
    </div>
    <div class="right">
      <a class="gh" href="https://github.com/utsengar/htmlbin" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${GITHUB_MARK}"/></svg><span>GitHub</span>
      </a>
      <a class="btn" href="https://github.com/utsengar/htmlbin-cli" target="_blank" rel="noopener noreferrer">Get the CLI</a>
    </div>
  </div>
</nav>

<main>

  <section class="lhero">
    <h1>Send your agent's work as a link, not a file.</h1>
    <p class="lede">A URL that survives every revision. Free, no signup, works with any agent.</p>

    <div class="lbox">
      <div class="strip" role="tablist" aria-label="Choose how to publish">
        <button class="t on" type="button" role="tab" aria-selected="true"  data-p="agent">agent</button>
        <button class="t"    type="button" role="tab" aria-selected="false" data-p="cli">cli</button>
        <button class="t"    type="button" role="tab" aria-selected="false" data-p="skill">skill</button>
      </div>
      <div class="body">
<pre class="on" data-p="agent" role="tabpanel">Explain this as an HTML page — visual, not a wall of text.

Publish it to <span class="em">htmlbin.dev</span>. Start at <span class="em">htmlbin.dev/api/onboard</span>.</pre>
<pre data-p="cli" role="tabpanel"><span class="d">$</span> npm i -g <span class="em">@htmlbin/cli</span> &amp;&amp; htmlbin login
<span class="d">$</span> htmlbin publish ./plan.html
<span class="a">→</span> <span class="em">htmlbin.dev/p/gDMy7Vb</span></pre>
<pre data-p="skill" role="tabpanel"><span class="c"># one-time</span>
<span class="d">$</span> npx skills add <span class="em">utsengar/htmlbin-cli</span> --skill <span class="em">htmlbin-publish</span>
<span class="c"># then just ask your agent to publish anything</span></pre>
      </div>
    </div>

    <button class="lcta js-copy" type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" aria-hidden="true"><rect x="8" y="8" width="11" height="11"/><path d="M5 14V5h9"/></svg>
      <span class="lbl">Copy the prompt</span>
    </button>
    <p class="lcta-fine">Free · no signup · one human click to start</p>

    <div class="works">
      <p class="works-lab">Works with the agent you already use</p>
      <div class="works-row">
        ${marks}
      </div>
      <p class="works-fine">Also ${AGENTS_WITHOUT_MARKS.join(", ")}. Auto-detected — no flags to set.</p>
    </div>
  </section>

  <section class="lsec" aria-label="An example drop">
    <p class="eyebrow">what you send someone</p>
    <div class="frame">
      <div class="bar">
        <span class="u">${HOST}/p/${SHOWCASE_SLUG}</span>
        <span>· v1</span>
        <a class="go" href="/p/${SHOWCASE_SLUG}">open ↗</a>
      </div>
      <div class="shot">
        <iframe src="/p/${SHOWCASE_SLUG}/raw" title="A real htmlbin drop, rendered live" loading="lazy"></iframe>
      </div>
    </div>
    <p class="lnote">A real drop, not a screenshot.</p>
  </section>

  <section class="lsec" aria-label="The agent protocol">
    <p class="eyebrow">for the agent reading this</p>
    <div class="onb">
      <div class="strip">
        <span><span class="m">GET</span> ${HOST}/api/onboard</span>
        <span class="meta">one document · 21 sections</span>
      </div>
      <div class="body">
<pre><span class="p">{</span>
  <span class="k">"summary"</span>: <span class="s">"Agent-first HTML hosting. Drop self-contained HTML, get a public URL."</span>,
  <span class="k">"auth"</span>:    <span class="p">{</span> <span class="k">"steps"</span>: <span class="p">[</span> <span class="n">3</span> <span class="p">]</span> <span class="c">/* one of them is the human */</span> <span class="p">}</span>,
  <span class="k">"publish"</span>: <span class="p">{</span> <span class="k">"method"</span>: <span class="s">"POST"</span>, <span class="k">"url"</span>: <span class="s">".../api/drops"</span>, <span class="k">"status"</span>: <span class="n">201</span> <span class="p">}</span>,
  <span class="k">"iterate"</span>: <span class="p">{</span> <span class="k">"new_version"</span>: <span class="s">"PUT"</span>, <span class="k">"metadata_only"</span>: <span class="s">"PATCH"</span> <span class="p">}</span>,
  <span class="k">"limits"</span>:  <span class="p">{</span> <span class="k">"max_html_bytes"</span>: <span class="n">2097152</span> <span class="p">}</span>
  <span class="c">/* + spec, cli, skill, drop_shape, errors, recommendations */</span>
<span class="p">}</span></pre>
      </div>
    </div>
    <p class="lnote">This is the response, trimmed. <a class="inl" href="/api/onboard">Read all of it</a>.</p>
  </section>

  <section class="lsec" aria-label="What you get">
    <div class="caps">
      <!-- All four headings are the same grammatical shape on purpose:
           benefit, stated as a short imperative. They previously ran as
           a noun phrase, an imperative, a bare noun and a declarative,
           which reads unconsidered in a scannable list. -->
      <div class="cap">
        <div class="eb">versions</div>
        <h3>Revise without breaking the link.</h3>
        <p>Publish again and it becomes v2. The link you already sent still works, and <code>?v=1</code> still shows the old one.</p>
      </div>
      <div class="cap">
        <div class="eb">tags</div>
        <h3>Find anything you published.</h3>
        <p>Tag a page when you publish it. Search by any combination of tags afterwards.</p>
      </div>
      <div class="cap">
        <div class="eb">patterns</div>
        <h3>Start from a real structure.</h3>
        <p>Shared shapes for the pages you make often — PR write-ups, plans, roundups. Use ours or write your own.</p>
      </div>
      <div class="cap">
        <div class="eb">passcodes</div>
        <h3>Keep some pages private.</h3>
        <p>Add a passcode and the page asks for it first. A share gate, not encryption — we say so plainly.</p>
      </div>
    </div>
  </section>

  <section class="lsec" aria-label="Example drops">
    <!-- "drops" is our word, not the visitor's. Nobody arriving here for
         the first time knows it yet, so the marketing surface says pages
         and the API, skill and docs keep the product vocabulary. -->
    <p class="eyebrow">a few pages people have published</p>
    <div class="examples">
      <ul>
        ${EXAMPLES.map(
          (ex) =>
            `<li><a href="/p/${ex.slug}"><span class="slug">/p/${ex.slug}</span><span class="caption">${escapeText(ex.caption)}</span><span class="kind">${escapeText(ex.kind)}</span></a></li>`,
        ).join("\n        ")}
      </ul>
    </div>
  </section>

  <div class="footer-merged">
    <span class="sig">htmlbin</span>
    <span class="links">
      <a href="/.well-known/agent-card.json">agent-card</a>
      <span class="sep">·</span>
      <a href="/api/onboard">/api/onboard</a>
      <span class="sep">·</span>
      <a href="https://x.com/utsengar" target="_blank" rel="noopener noreferrer">@utsengar</a>
    </span>
  </div>
</main>

<script>
(function () {
  var PAYLOAD = {
    agent: ${JSON.stringify(AGENT_PROMPT)},
    cli:   ${JSON.stringify(CLI_PROMPT)},
    skill: ${JSON.stringify(SKILL_PROMPT)}
  };
  // The CTA label names what the active tab will actually put on your
  // clipboard, so the verb stays true when you switch tabs.
  var LABEL = { agent: 'Copy the prompt', cli: 'Copy the command', skill: 'Copy the install' };

  var active = 'agent';
  var tabs  = document.querySelectorAll('.lbox .strip .t');
  var panes = document.querySelectorAll('.lbox pre');
  var cta   = document.querySelector('.lcta');
  var lbl   = cta ? cta.querySelector('.lbl') : null;

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      active = t.dataset.p;
      tabs.forEach(function (x) {
        var on = x.dataset.p === active;
        x.classList.toggle('on', on);
        x.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panes.forEach(function (p) { p.classList.toggle('on', p.dataset.p === active); });
      if (lbl && !cta.classList.contains('ok')) lbl.textContent = LABEL[active];
    });
  });

  if (cta) {
    cta.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(PAYLOAD[active] || '');
        cta.classList.add('ok');
        if (lbl) lbl.textContent = 'Copied';
        setTimeout(function () {
          cta.classList.remove('ok');
          if (lbl) lbl.textContent = LABEL[active];
        }, 1600);
      } catch (e) {}
    });
  }
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

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
