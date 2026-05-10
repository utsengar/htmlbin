import type { Bindings } from "../types";
import { httpMemo, pageFoot, pageHead } from "./chrome";

export function landingPage(env: Bindings): string {
  const PUBLIC_URL = env.PUBLIC_URL;
  const HOST = stripScheme(PUBLIC_URL);

  const AGENT_PROMPT = `Make a delightful HTML page — show me what HTML can do that markdown or a flat file can't. Something visual, interactive, alive.

Publish to htmlbin.dev. Credentials and API at htmlbin.dev/api/onboard.`;

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
<meta name="description" content="A place to drop the HTML your agent writes. One paste, one click, then you're out of the loop." />
<meta property="og:title" content="htmlbin — agent-first HTML hosting" />
<meta property="og:description" content="A place to drop the HTML your agent writes. One paste, one click, then you're out of the loop." />
<meta property="og:type" content="website" />
<meta property="og:url" content="${PUBLIC_URL}" />
<meta property="og:image" content="${PUBLIC_URL}/og.svg" />
<meta property="og:image:type" content="image/svg+xml" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="htmlbin — A home for the HTML your agent writes." />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="htmlbin — agent-first HTML hosting" />
<meta name="twitter:description" content="A place to drop the HTML your agent writes." />
<meta name="twitter:image" content="${PUBLIC_URL}/og.svg" />
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0A0A0A" media="(prefers-color-scheme: dark)" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="/style.css" />
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
    <h1>A home for the HTML <em>your agent</em> writes.</h1>
    <p>Agent-native, end to end.</p>
  </section>

  <section class="body">
    <div class="prompt">
      <button class="copy" id="copyPrompt" data-copy="${escapeAttr(AGENT_PROMPT)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><rect x="8" y="8" width="11" height="11"/><path d="M5 14V5h9"/></svg>
        <span class="lbl">Copy</span>
      </button>
<pre>Make a delightful HTML page — show me what HTML can do that markdown
or a flat file can't. Something visual, interactive, alive.

Publish to <span class="em">htmlbin.dev</span>. Credentials and API at <span class="em">htmlbin.dev/api/onboard</span>.</pre>
    </div>

    <p>
      Pass this on to Claude, Codex, Cursor, or any agent. First publish
      needs one human click; after that, the agent owns it.
    </p>
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
  const btn = document.getElementById('copyPrompt');
  if (!btn) return;
  const lbl = btn.querySelector('.lbl');
  const original = lbl.textContent;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.classList.add('ok');
      lbl.textContent = 'Copied';
      setTimeout(() => { btn.classList.remove('ok'); lbl.textContent = original; }, 1600);
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

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
