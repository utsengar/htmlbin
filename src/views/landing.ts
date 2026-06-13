import type { Bindings } from "../types";
import { httpMemo, pageHead } from "./chrome";
import { STYLE_INLINE } from "../styles";

// Curated "what people are building" list, rendered below the tool
// section. Edit this array + redeploy to rotate. Captions and `kind`
// labels are hand-curated — they don't read from the drop's stored
// title. The `kind` column on the right gives the list a visible range
// (explainer / pr writeup / design / playful / plan-spec) so it reads
// as proof-of-breadth, not just "four random links."
const EXAMPLES: Array<{ slug: string; caption: string; kind: string }> = [
  {
    slug: "gDMy7Vb",
    caption: "how htmlbin works — an animated explainer",
    kind: "explainer",
  },
  {
    slug: "1Wyf23j",
    caption: "cross-platform gstack — pr #1111 deep dive",
    kind: "pr writeup",
  },
  {
    slug: "ztx4J9P",
    caption: "workers nav — three redesigns side by side",
    kind: "design",
  },
  {
    slug: "i2taphP",
    caption: "google logo — animation playground",
    kind: "playful",
  },
  {
    slug: "HYmZ6DjCM",
    caption: "plan: queryable drop metadata",
    kind: "plan / spec",
  },
];

// The two prompt-tab payloads. We deliberately serve two — "one thing
// to copy" is preserved because at any moment exactly one tab is
// active, and the copy buttons read whichever one is selected. Plain
// strings here are the clipboard payloads; the visible HTML below
// hand-wires the same content with <span class="em"> accents for color.
//
// Keep these in sync with the prompt-body HTML further down — if you
// edit one, edit the other.
const AGENT_PROMPT = `Make a delightful HTML page to explain a concept or a problem — show me what HTML can do that markdown or a flat file can't. Something visual, interactive, alive.

Publish to htmlbin.dev. Credentials and API at htmlbin.dev/api/onboard.`;

// Clipboard form — paste-and-run. The visible CLI panel keeps the `$ `
// prompt prefix and the `→ URL` result line as visual signposts, but
// neither belongs in what we copy: `$` is the shell prompt indicator,
// and `→ https://…` is example output, not a command. The echo line
// creates a tiny sample file so the publish actually succeeds — without
// it, `publish out.html` would fail with file-not-found. Comments stay:
// bash ignores `#` lines, so they're harmless on paste and useful for
// context.
const CLI_PROMPT = `# one-time — GitHub device-code, ~30s
npx @htmlbin/cli login

# create a sample page and publish it
echo '<h1>hello from htmlbin</h1>' > out.html
npx @htmlbin/cli publish out.html`;

// "skill" tab — installs the official htmlbin-publish agent skill via
// skills.sh. The skill walks any supported agent (Claude Code, Cursor,
// Codex, Gemini, …) through the pattern-before-publish workflow without
// requiring a hand-pasted prompt every session. One install, ambient
// for the lifetime of the agent. Lives in the htmlbin-cli repo —
// skills.sh resolves the subdirectory automatically.
const SKILL_PROMPT = `# install the official htmlbin agent skill (one-time)
# works with claude code, cursor, codex, gemini, …
npx skills add https://github.com/utsengar/htmlbin-cli --skill htmlbin-publish`;

// Tool-section copy button. Same shape as CLI_PROMPT but the global
// install path (npm i -g, then bare `htmlbin`). End-to-end paste-and-run.
const TOOL_SETUP = `npm i -g @htmlbin/cli
htmlbin login
echo '<h1>hello from htmlbin</h1>' > out.html
htmlbin publish out.html`;

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
${STYLE_INLINE}
<script src="/sentry.js" defer></script>
<link rel="alternate" type="text/markdown" title="This page as markdown" href="/index.md" />
<link rel="alternate" type="application/json" title="Agent protocol descriptor" href="/api/onboard" />
<link rel="alternate" type="text/markdown" title="Agent protocol (markdown)" href="/api/onboard?format=md" />
<link rel="alternate" type="application/json" title="OpenAPI spec" href="/openapi.json" />
<link rel="alternate" type="text/plain" title="llms.txt" href="/llms.txt" />
<!-- Self-hosted Geist + Geist Mono. @font-face declarations are in
     /style.css; we preload the weights that the hero + memo render
     in so the LCP element isn't waiting on a font fetch. -->
<link rel="preload" as="font" type="font/woff2" href="/fonts/Geist-700.woff2" crossorigin="anonymous" />
<link rel="preload" as="font" type="font/woff2" href="/fonts/Geist-400.woff2" crossorigin="anonymous" />
<link rel="preload" as="font" type="font/woff2" href="/fonts/GeistMono-500.woff2" crossorigin="anonymous" />
<script type="application/ld+json">${jsonLd}</script>
</head>
<body class="landing">

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
    <h1><span class="wf" style="--i:0">API</span> <span class="wf" style="--i:1">for</span> <span class="wf" style="--i:2"><em>agents</em></span> <span class="wf" style="--i:3">to</span> <span class="wf" style="--i:4">share</span> <span class="wf" style="--i:5">HTML.</span></h1>
    <p class="hero-sub">Agent-native, end to end.</p>
  </section>

  <section class="body">
    <p class="prompt-cue">↓ paste into your agent — pop open a terminal — or install the skill</p>

    <div class="prompt">
      <div class="prompt-chrome">
        <span class="dots" aria-hidden="true">
          <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        </span>
        <div class="prompt-chrome-right">
          <div class="tabs" role="tablist" aria-label="Choose how to publish">
            <button
              class="tab active"
              type="button"
              role="tab"
              data-tab="agent"
              aria-selected="true"
            >agent</button>
            <button
              class="tab"
              type="button"
              role="tab"
              data-tab="cli"
              aria-selected="false"
            >cli</button>
            <button
              class="tab"
              type="button"
              role="tab"
              data-tab="skill"
              aria-selected="false"
            >skill</button>
          </div>
          <button
            class="prompt-mark js-copy-prompt"
            type="button"
            data-copy="${escapeAttr(AGENT_PROMPT)}"
            aria-label="Copy the prompt to your clipboard"
          >
            <svg class="prompt-mark-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" aria-hidden="true"><rect x="8" y="8" width="11" height="11"/><path d="M5 14V5h9"/></svg>
            <svg class="prompt-mark-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>
            <span class="lbl">copy</span>
          </button>
        </div>
      </div>
      <div class="prompt-body">
        <div class="tab-panel active" data-panel="agent" role="tabpanel">
<pre>Make a delightful HTML page to explain a concept or a problem — show me what HTML can do that markdown or a flat file can't. Something visual, interactive, alive.

Publish to <span class="em">htmlbin.dev</span>. Credentials and API at <span class="em">htmlbin.dev/api/onboard</span>.</pre>
        </div>
        <div class="tab-panel" data-panel="cli" role="tabpanel">
<pre><span class="cmt"># one-time — GitHub device-code, ~30s</span>
$ npx <span class="em">@htmlbin/cli</span> login

<span class="cmt"># create a sample page and publish it</span>
$ echo '<span class="em">&lt;h1&gt;hello from htmlbin&lt;/h1&gt;</span>' &gt; out.html
$ npx <span class="em">@htmlbin/cli</span> publish out.html
<span class="arr">→</span> <span class="em">https://htmlbin.dev/p/aB3xK7g</span></pre>
        </div>
        <div class="tab-panel" data-panel="skill" role="tabpanel">
<pre><span class="cmt"># install the official htmlbin agent skill (one-time)</span>
<span class="cmt"># works with claude code, cursor, codex, gemini, …</span>
$ npx <span class="em">skills add</span> https://github.com/utsengar/htmlbin-cli \
    --skill <span class="em">htmlbin-publish</span>

<span class="cmt"># then just ask the agent</span>
&gt; <span class="em">publish a drop to htmlbin explaining this PR</span></pre>
        </div>
      </div>
    </div>

    <button class="copy-cta js-copy-prompt" type="button" data-copy="${escapeAttr(AGENT_PROMPT)}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" aria-hidden="true"><rect x="8" y="8" width="11" height="11"/><path d="M5 14V5h9"/></svg>
      <span class="lbl">Copy prompt</span>
    </button>

    <p class="prompt-aftermath">
      First publish needs one human click; after that, the agent owns it.
    </p>
  </section>

  <section class="tool" aria-label="The CLI">
    <p class="tool-eyebrow">tool /</p>
    <p class="term-lede">Or pop open a terminal.</p>
    <p class="term-sub">The CLI is your one-verb shortcut to the API — versioning, tags, patterns, passcodes, all in one binary.</p>

    <div class="term-block">
      <button
        class="term-copy js-term-copy"
        type="button"
        data-copy="${escapeAttr(TOOL_SETUP)}"
        aria-label="Copy the install, login, and publish commands"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" aria-hidden="true"><rect x="8" y="8" width="11" height="11"/><path d="M5 14V5h9"/></svg>
        <span class="lbl">copy</span>
      </button>
<span class="ln"><span class="cmt"># install</span></span>
<span class="ln">$ npm i -g <span class="pkg">@htmlbin/cli</span></span>
<span class="ln"></span>
<span class="ln"><span class="cmt"># one-time — GitHub device-code, ~30s</span></span>
<span class="ln">$ htmlbin <span class="key">login</span></span>
<span class="ln"></span>
<span class="ln"><span class="cmt"># create a sample page and publish it</span></span>
<span class="ln">$ echo '<span class="em">&lt;h1&gt;hello from htmlbin&lt;/h1&gt;</span>' &gt; out.html</span>
<span class="ln">$ htmlbin <span class="key">publish</span> out.html</span>
<span class="ln"><span class="arr">→</span> <span class="em">https://htmlbin.dev/p/aB3xK7g</span></span>
    </div>

    <p class="caps-cue">— and there's more under the hood</p>

    <div class="caps">

      <div class="cap">
        <div class="eb">versions</div>
        <h3>Iterate. Slug stays put.</h3>
        <p>Every publish mints a new version of the same drop. Pin any past one with <code>?v=N</code>.</p>
<div class="mini"><span class="cmt"># republish — same slug, v2 lands</span>
$ htmlbin <span class="key">publish</span> ./out.html
<span class="arr">→</span> <span class="em">/p/aB3xK7g</span> (v2)</div>
      </div>

      <div class="cap">
        <div class="eb">tags &amp; queries</div>
        <h3>Find drops by anything.</h3>
        <p>Attach any string tag at publish; query your library by any combination, anytime.</p>
<div class="mini"><span class="cmt"># tag and query — any string keys</span>
$ htmlbin <span class="key">publish</span> ./out.html --tag <span class="em">kind=plan</span>
$ htmlbin <span class="key">list</span> --filter <span class="em">kind=plan</span></div>
      </div>

      <div class="cap">
        <div class="eb">patterns</div>
        <h3>Pluggable templates.</h3>
        <p>Pre-shaped drop kinds for recurring use cases. Install the catalog or write your own.</p>
<div class="mini"><span class="cmt"># grab the official catalog</span>
$ htmlbin <span class="key">patterns</span> init
$ htmlbin <span class="key">patterns</span> add <span class="em">pr-explainer</span></div>
      </div>

      <div class="cap">
        <div class="eb">passcodes</div>
        <h3>Share-gate any drop.</h3>
        <p>Public by default. Drop a passcode in front of the viewer when it shouldn't be open.</p>
<div class="mini"><span class="cmt"># gate a drop</span>
$ htmlbin <span class="key">publish</span> ./out.html \\
   --passcode <span class="em">hunter2</span></div>
      </div>

    </div>

    <div class="term-foot">
      <a href="https://github.com/utsengar/htmlbin-cli" target="_blank" rel="noopener noreferrer">@htmlbin/cli on github</a>
      <span class="sep">·</span>
      <a href="https://github.com/utsengar/htmlbin-cli#readme" target="_blank" rel="noopener noreferrer">readme</a>
      <span class="sep">·</span>
      <span>node 20+</span>
    </div>
  </section>

  <section class="examples" aria-label="Example drops">
    <p class="cue">↓ a few drops people have made</p>
    <ul>
      ${EXAMPLES.map(
        (ex) =>
          `<li><a href="/p/${ex.slug}"><span class="slug">/p/${ex.slug}</span><span class="caption">${escapeText(ex.caption)}</span><span class="kind">${escapeText(ex.kind)}</span></a></li>`,
      ).join("\n      ")}
    </ul>
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
  // ----- prompt tab switcher (agent / cli) -----
  // Plain strings — what gets written to the clipboard when each tab is
  // active. Visible HTML is hand-wired in markup above; keep both in sync.
  var PROMPTS = {
    agent: ${JSON.stringify(AGENT_PROMPT)},
    cli:   ${JSON.stringify(CLI_PROMPT)},
    skill: ${JSON.stringify(SKILL_PROMPT)}
  };
  var tabs = document.querySelectorAll('.tab');
  var panels = document.querySelectorAll('.tab-panel');
  var copyBtns = document.querySelectorAll('.js-copy-prompt');
  var ctaLbl = document.querySelector('.copy-cta .lbl');

  function setActive(name) {
    tabs.forEach(function (t) {
      var on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(function (p) {
      p.classList.toggle('active', p.dataset.panel === name);
    });
    copyBtns.forEach(function (b) { b.dataset.copy = PROMPTS[name] || ''; });
    if (ctaLbl) {
      ctaLbl.textContent =
        name === 'cli'   ? 'Copy command' :
        name === 'skill' ? 'Copy install' :
                           'Copy prompt';
    }
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { setActive(t.dataset.tab); });
  });

  // ----- copy buttons (prompt-mark in chrome + big red copy-cta below) -----
  copyBtns.forEach(function (btn) {
    var lbl = btn.querySelector('.lbl');
    var original = lbl ? lbl.textContent : '';
    var doneLabel = btn.classList.contains('prompt-mark') ? 'copied' : 'Copied';
    btn.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy || '');
        btn.classList.add('ok');
        if (lbl) lbl.textContent = doneLabel;
        setTimeout(function () {
          btn.classList.remove('ok');
          if (lbl) lbl.textContent = original;
        }, 1600);
      } catch (e) {}
    });
  });

  // ----- tool-section copy button (install + login + publish setup) -----
  document.querySelectorAll('.js-term-copy').forEach(function (btn) {
    var lbl = btn.querySelector('.lbl');
    var original = lbl ? lbl.textContent : 'copy';
    btn.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy || '');
        btn.classList.add('ok');
        if (lbl) lbl.textContent = 'copied';
        setTimeout(function () {
          btn.classList.remove('ok');
          if (lbl) lbl.textContent = original;
        }, 1600);
      } catch (e) {}
    });
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

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
