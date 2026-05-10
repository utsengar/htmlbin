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

// The single prompt payload. We deliberately don't show alternative
// "tabs" — an `npx htmlbin` command would advertise a CLI we don't
// ship, and a `curl …` line gets flagged as unsafe by careful agents.
// One real, end-to-end path is better than two cosmetic ones — this
// prompt produces a visible artifact the human can paste, run, and
// click through.
const AGENT_PROMPT = `Make a delightful HTML page — show me what HTML can do that markdown or a flat file can't. Something visual, interactive, alive.

Publish to htmlbin.dev. Credentials and API at htmlbin.dev/api/onboard.`;

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
        <span class="prompt-mark" aria-hidden="true">claude</span>
      </div>
      <div class="prompt-body">
<pre>Make a delightful HTML page — show me what HTML can do that markdown or a flat file can't. Something visual, interactive, alive.

Publish to <span class="em">htmlbin.dev</span>. Credentials and API at <span class="em">htmlbin.dev/api/onboard</span>.</pre>
      </div>
    </div>

    <button class="copy-cta" id="copyPrompt" type="button" data-copy="${escapeAttr(AGENT_PROMPT)}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" aria-hidden="true"><rect x="8" y="8" width="11" height="11"/><path d="M5 14V5h9"/></svg>
      <span class="lbl">Copy prompt</span>
    </button>

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
  var btn = document.getElementById('copyPrompt');
  if (!btn) return;
  var lbl = btn.querySelector('.lbl');
  var original = lbl ? lbl.textContent : 'Copy prompt';
  btn.addEventListener('click', async function () {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy || '');
      btn.classList.add('ok');
      if (lbl) lbl.textContent = 'Copied';
      setTimeout(function () {
        btn.classList.remove('ok');
        if (lbl) lbl.textContent = original;
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

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
