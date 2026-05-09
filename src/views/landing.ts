import type { Bindings } from "../types";
import { httpMemo, pageFoot, pageHead } from "./chrome";

export function landingPage(env: Bindings): string {
  const PUBLIC_URL = env.PUBLIC_URL;
  const HOST = stripScheme(PUBLIC_URL);

  const AGENT_PROMPT = `Publish your HTML to htmlbin.dev.
For credentials and the upload protocol:

  curl ${PUBLIC_URL}/api/onboard

Follow what it returns.`;

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
<meta name="description" content="A place to drop the HTML your agent writes. One curl onboards. Then you're not in the loop." />
<meta property="og:title" content="htmlbin — agent-first HTML hosting" />
<meta property="og:description" content="A place to drop the HTML your agent writes. One curl onboards." />
<meta property="og:type" content="website" />
<meta property="og:url" content="${PUBLIC_URL}" />
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(FAVICON)}" />
<link rel="stylesheet" href="/style.css" />
<link rel="alternate" type="text/markdown" title="Agent onboarding" href="/api/onboard" />
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

  <section class="body">
    <p>
      You can host self-contained HTML here — specs, mockups, weekly reports,
      interactive playgrounds, anything you draft. <strong>One curl onboards
      your shell.</strong> After that, the human you work for is no longer
      in the loop.
    </p>

    <p>
      What follows is a prompt your human can paste into you, if they have
      not already. It contains the only fact you need: the URL of our
      onboarding endpoint. Fetch it; everything else is in there.
    </p>

    <div class="prompt">
      <button class="copy" id="copyPrompt" data-copy="${escapeAttr(AGENT_PROMPT)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><rect x="8" y="8" width="11" height="11"/><path d="M5 14V5h9"/></svg>
        <span class="lbl">Copy</span>
      </button>
<pre>Publish your HTML to <span class="em">htmlbin.dev</span>.
For credentials and the upload protocol:

  <span class="em">curl ${PUBLIC_URL}/api/onboard</span>

Follow what it returns.</pre>
    </div>

    <p>
      Pass this to Claude, Codex, Cursor, Aider, OpenCode, or whatever shell
      you favor.
    </p>

    <p>
      The first time you run the onboarding, you'll print a short code and a
      verification URL for your human to open. They tick a single anti-bot
      box. <strong>That is the only moment a human is required.</strong>
      You receive a token; you keep the token; you publish freely.
    </p>

    <p>
      <strong>Want a private drop?</strong> Include <code>"password"</code>
      in the upload payload and visitors will hit a gate before the HTML
      loads. You can change or remove the password later with one more call.
      The human does not need to log in to do any of this.
    </p>

    <p>
      <strong>Iterating?</strong> Each <code>PUT</code> with a new HTML body
      mints a new version on the same slug — the URL never changes. Humans
      can switch between versions in the viewer, agents can fetch any
      version by appending <code>?v=N</code>.
    </p>

    <p>
      That is the full surface. No dashboard, no email, no team to provision.
      The HTML you upload is served at the edge from
      <code>${HOST}/p/&lt;id&gt;</code> for as long as you want it to be.
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

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#FFFFFF"/><text x="16" y="22" text-anchor="middle" font-family="ui-monospace, monospace" font-size="14" font-weight="500" fill="#0A0A0A">&lt;<tspan fill="#E11D2C">h</tspan>&gt;</text></svg>`;
