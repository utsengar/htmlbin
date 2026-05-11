import type { Bindings, Drop } from "../types";
import { httpMemo, pageHead } from "./chrome";
import { STYLE_HREF } from "../styles";

type VersionItem = {
  version: number;
  size_bytes: number;
  has_context: boolean;
  context: string | null;
  created_at: number;
};

export function viewerPage(
  env: Bindings,
  drop: Drop,
  state: {
    unlocked: boolean;
    locked: boolean;
    versions: VersionItem[];
    viewVersion: number;
  }
): string {
  const title = escapeHtml(drop.title);
  const description = escapeHtml(drop.description);
  const slug = escapeHtml(drop.slug);
  const updated = new Date(drop.updated_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  if (state.locked && !state.unlocked) {
    return passcodeGatePage(env, drop, { error: false });
  }

  const total = drop.latest_version;
  const current = state.viewVersion;
  const isLatest = current === total;

  // Title format: <title trimmed to 15 words> - <slug> - htmlbin.dev.
  // Used for both the HTML <title> and og:title so social unfurls show
  // the human-meaningful name first, the slug for disambiguation, and
  // the brand last.
  const titleShort = escapeHtml(truncateWords(drop.title, 15));
  const HOST = stripScheme(env.PUBLIC_URL);
  const pageTitle = `${titleShort} - ${slug} - ${HOST}`;
  const currentVersionRow = state.versions.find((v) => v.version === current);
  const contextText = currentVersionRow?.context ?? null;
  const versionsJson = JSON.stringify(
    state.versions.map((v) => ({
      version: v.version,
      created_at: v.created_at,
      has_context: v.has_context,
    }))
  );

  // The version pill is intentionally subtle — small mono chip in the
  // viewer-bar. Click reveals the picker. Context disclosure sits beside it.
  return /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${pageTitle}</title>
<meta name="description" content="${description || `htmlbin drop: ${title}`}" />
<meta name="robots" content="noindex" />
<!-- Open Graph: per-drop card. Slug + version + date in the SVG; title/description here. -->
<meta property="og:type" content="article" />
<meta property="og:title" content="${pageTitle}" />
<meta property="og:description" content="${description || `htmlbin drop · v${total} · updated ${updated}`}" />
<meta property="og:url" content="${escapeHtml(env.PUBLIC_URL)}/p/${slug}" />
<meta property="og:image" content="${escapeHtml(env.PUBLIC_URL)}/p/${slug}/og.png" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="htmlbin drop /p/${slug}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${pageTitle}" />
<meta name="twitter:description" content="${description || `htmlbin drop · v${total} · updated ${updated}`}" />
<meta name="twitter:image" content="${escapeHtml(env.PUBLIC_URL)}/p/${slug}/og.png" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="${STYLE_HREF}" />
<!-- Self-hosted Geist + Geist Mono. @font-face in /style.css. -->
<link rel="preload" as="font" type="font/woff2" href="/fonts/Geist-600.woff2" crossorigin="anonymous" />
<link rel="preload" as="font" type="font/woff2" href="/fonts/GeistMono-500.woff2" crossorigin="anonymous" />
<style>
  /* viewer is full-bleed; override the default body */
  html, body { height: 100%; }
  body { display: flex; flex-direction: column; }

  .viewer-bar { position: relative; z-index: 5; }
  .vchip {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--bg-2); border: 1px solid var(--rule);
    border-radius: 4px;
    padding: 3px 8px;
    font: 500 11.5px/1 var(--mono);
    color: var(--ink-2);
    cursor: pointer;
    transition: border-color 0.12s, color 0.12s;
  }
  .vchip:hover { border-color: var(--red); color: var(--red); }
  .vchip .of { color: var(--ink-softer); margin: 0 1px; }
  .vchip.latest::after { content: ""; }
  .vchip:not(.latest)::after {
    content: "⚠"; color: var(--red); margin-left: 2px;
  }
  .ctx-toggle {
    background: transparent; border: 1px solid var(--rule);
    color: var(--ink-soft);
    padding: 3px 8px; border-radius: 4px;
    font: 500 11.5px/1 var(--mono);
    cursor: pointer;
    text-decoration: none;
    transition: border-color 0.12s, color 0.12s;
  }
  .ctx-toggle:hover { border-color: var(--red); color: var(--red); }
  .ctx-toggle[hidden] { display: none; }

  .vmenu {
    position: absolute; top: calc(100% + 4px); right: 14px;
    background: var(--bg);
    border: 1px solid var(--rule);
    border-radius: 6px;
    box-shadow: 0 8px 24px -8px #00000018;
    min-width: 280px; max-height: 60vh; overflow: auto;
    padding: 6px;
    display: none;
  }
  .vmenu.open { display: block; }
  .vmenu .v-item {
    display: block;
    padding: 8px 10px;
    border-radius: 4px;
    text-decoration: none;
    font-family: var(--mono); font-size: 12px;
    color: var(--ink-2);
  }
  .vmenu .v-item:hover { background: var(--bg-2); }
  .vmenu .v-item.current { background: var(--bg-2); color: var(--ink); }
  .vmenu .v-item .num { color: var(--red); font-weight: 500; margin-right: 8px; }
  .vmenu .v-item .when { color: var(--ink-softer); }
  .vmenu .v-item .latest-tag {
    margin-left: 6px; padding: 1px 6px;
    background: var(--ink); color: var(--bg);
    border-radius: 3px; font-size: 9.5px; letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .vmenu .v-item .ctx-tag {
    margin-left: 6px; padding: 1px 6px;
    background: var(--bg-3); color: var(--ink-soft);
    border-radius: 3px; font-size: 9.5px;
  }

  .ctx-panel {
    background: var(--bg-2); border-bottom: 1px solid var(--rule);
    padding: 14px 18px;
    font: 13px/1.6 var(--mono);
    color: var(--ink-2);
    white-space: pre-wrap; word-wrap: break-word;
    max-height: 240px; overflow: auto;
    display: none;
  }
  .ctx-panel.open { display: block; }
  .ctx-panel .ctx-label {
    display: block;
    font: 500 10.5px/1 var(--mono);
    color: var(--ink-soft);
    letter-spacing: 0.08em; text-transform: uppercase;
    margin-bottom: 8px;
  }

  .stale-banner {
    background: #FEF7E5; border-bottom: 1px solid #F0DDA8;
    color: #6B4F0A;
    padding: 6px 18px;
    font: 500 12px/1.4 var(--mono);
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px;
  }
  .stale-banner a { color: #6B4F0A; text-decoration: underline; }
  .stale-banner a:hover { color: var(--red); }

  /* UGC note — reinforces htmlbin is the host, not the author. Visible
     but quiet; sits between the viewer-bar and the iframe. */
  .ugc-note {
    padding: 4px 18px;
    background: var(--bg);
    border-bottom: 1px solid var(--rule);
    font: 11.5px/1.4 var(--mono);
    color: var(--ink-softer);
    letter-spacing: 0.01em;
  }
  .ugc-note a {
    color: var(--ink-soft);
    text-decoration: underline;
    text-decoration-color: var(--rule);
    text-underline-offset: 2px;
  }
  .ugc-note a:hover { color: var(--red); text-decoration-color: var(--red); }
</style>
</head>
<body>
${
  isLatest
    ? ""
    : /* html */ `<div class="stale-banner">
    <span>Viewing v${current} · not the latest version (v${total})</span>
    <a href="/p/${slug}">view latest →</a>
  </div>`
}
<header class="viewer-bar">
  <a href="/" class="wordmark" title="htmlbin home">htmlbin</a>
  <span class="sep">/</span>
  <div class="title">${title}</div>
  ${description ? `<span class="sep desc-sep">·</span><div class="desc">${description}</div>` : ""}
  <div class="right">
    ${state.locked ? `<form method="POST" action="/p/${slug}/lock" class="lock-form"><button type="submit" class="lock-pill" aria-label="re-lock this drop"><span class="lock-state">unlocked</span><span class="lock-action">lock</span></button></form>` : ""}
    <span>${updated}</span>
    <button class="vchip ${isLatest ? "latest" : ""}" id="vchip" aria-haspopup="true">
      v${current}<span class="of">/</span>${total}
    </button>
    <button class="ctx-toggle" id="ctxToggle" ${
      contextText ? "" : "hidden"
    } title="Show the context this version was built with">context</button>
    <a href="/p/${slug}/raw${isLatest ? "" : `?v=${current}`}" target="_blank" rel="noreferrer">raw →</a>
  </div>
  <div class="vmenu" id="vmenu" role="listbox"></div>
</header>
<div class="ugc-note" title="htmlbin hosts user-authored HTML. Content is published by an agent, not by htmlbin.">
  hosted by <a href="/">htmlbin</a> — content authored by the agent that uploaded it.
</div>
${
  contextText
    ? /* html */ `<div class="ctx-panel" id="ctxPanel">
    <span class="ctx-label">Context for v${current}</span>${escapeHtml(contextText)}</div>`
    : ""
}
<iframe class="canvas"
        src="/p/${slug}/raw${isLatest ? "" : `?v=${current}`}"
        title="${title}"
        sandbox="allow-scripts allow-forms allow-modals allow-downloads"
        loading="lazy"></iframe>

<script>
(function () {
  const versions = ${versionsJson};
  const slug = ${JSON.stringify(slug)};
  const viewing = ${current};

  // --- version picker ---
  const chip = document.getElementById('vchip');
  const menu = document.getElementById('vmenu');
  if (chip && menu) {
    versions.forEach(v => {
      const a = document.createElement('a');
      a.href = '/p/' + slug + (v.version === ${total} ? '' : '?v=' + v.version);
      a.className = 'v-item' + (v.version === viewing ? ' current' : '');
      const when = new Date(v.created_at).toLocaleString();
      a.innerHTML =
        '<span class="num">v' + v.version + '</span>' +
        '<span class="when">' + when + '</span>' +
        (v.version === ${total} ? '<span class="latest-tag">latest</span>' : '') +
        (v.has_context ? '<span class="ctx-tag">+ ctx</span>' : '');
      menu.appendChild(a);
    });
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) menu.classList.remove('open');
    });
  }

  // --- context disclosure ---
  const tog = document.getElementById('ctxToggle');
  const pan = document.getElementById('ctxPanel');
  if (tog && pan) {
    tog.addEventListener('click', () => {
      pan.classList.toggle('open');
      tog.classList.toggle('open');
    });
  }

})();
</script>
</body>
</html>`;
}

export function passcodeGatePage(
  env: Bindings,
  drop: Drop,
  state: { error: boolean }
): string {
  const slug = escapeHtml(drop.slug);
  const title = escapeHtml(drop.title);
  return /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${title} · locked · htmlbin</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="${STYLE_HREF}" />
<link rel="preload" as="font" type="font/woff2" href="/fonts/Geist-700.woff2" crossorigin="anonymous" />
<link rel="preload" as="font" type="font/woff2" href="/fonts/GeistMono-500.woff2" crossorigin="anonymous" />
</head>
<body>
${pageHead({ verb: "GET", path: `/p/${slug}` })}
<main>
  ${httpMemo({
    verb: "GET",
    path: `/p/${slug}`,
    rows: [{ k: "re", v: "locked drop", em: true }],
    res: { status: "401 Unauthorized", ok: false, trailing: "www-authenticate: passcode" },
  })}
  <section class="gate">
    <h2 class="gate-title">${title}</h2>
    <p class="gate-sub">locked</p>
    <form method="POST" action="/p/${slug}/unlock" class="gate-form" autocomplete="off">
      <div class="gate-row">
        <input
          type="text"
          id="passcode-input"
          name="passcode"
          class="gate-input"
          placeholder="passcode"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          inputmode="text"
          autofocus
          required
        />
        <button type="button" id="passcode-toggle" class="gate-show" aria-label="show passcode">show</button>
      </div>
      <button type="submit" class="gate-submit">unlock</button>
      ${state.error ? `<p class="gate-error">incorrect passcode</p>` : ""}
    </form>
    <p class="gate-fine">soft gate · not encryption</p>
  </section>
</main>
<script>
(function(){
  var input = document.getElementById('passcode-input');
  var toggle = document.getElementById('passcode-toggle');
  if (!input || !toggle) return;
  toggle.addEventListener('click', function(){
    var showing = input.dataset.show === '1';
    input.dataset.show = showing ? '0' : '1';
    input.style.webkitTextSecurity = showing ? 'disc' : 'none';
    input.style.textSecurity       = showing ? 'disc' : 'none';
    input.style.letterSpacing      = showing ? '0.18em' : '0.04em';
    toggle.textContent             = showing ? 'show' : 'hide';
    toggle.setAttribute('aria-label', showing ? 'show passcode' : 'hide passcode');
  });
})();
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

// Trim a string to the first N words. If we cut anything, append "…".
// Whitespace is collapsed so titles with line breaks render cleanly in
// social previews.
function truncateWords(s: string, n: number): string {
  const words = (s ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= n) return words.join(" ");
  return words.slice(0, n).join(" ") + "…";
}
