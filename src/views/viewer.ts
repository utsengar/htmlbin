import type { Bindings, Drop } from "../types";
import { httpMemo, pageHead } from "./chrome";

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
    return passwordGatePage(env, drop, { error: false });
  }

  const total = drop.latest_version;
  const current = state.viewVersion;
  const isLatest = current === total;
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
<title>${title} · htmlbin</title>
<meta name="description" content="${description || `htmlbin drop: ${title}`}" />
<meta name="robots" content="noindex" />
<!-- Open Graph: per-drop card. Slug + version + date in the SVG; title/description here. -->
<meta property="og:type" content="article" />
<meta property="og:title" content="/p/${slug} · htmlbin" />
<meta property="og:description" content="${description || `htmlbin drop · v${total} · updated ${updated}`}" />
<meta property="og:url" content="${escapeHtml(env.PUBLIC_URL)}/p/${slug}" />
<meta property="og:image" content="${escapeHtml(env.PUBLIC_URL)}/p/${slug}/og.svg" />
<meta property="og:image:type" content="image/svg+xml" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="htmlbin drop /p/${slug}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="/p/${slug} · htmlbin" />
<meta name="twitter:description" content="${description || `htmlbin drop · v${total} · updated ${updated}`}" />
<meta name="twitter:image" content="${escapeHtml(env.PUBLIC_URL)}/p/${slug}/og.svg" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="/style.css" />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
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
  ${description ? `<span class="sep">·</span><div class="desc">${description}</div>` : ""}
  <div class="right">
    ${state.locked ? `<span class="lock-pill">unlocked</span>` : ""}
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
${
  contextText
    ? /* html */ `<div class="ctx-panel" id="ctxPanel">
    <span class="ctx-label">Context for v${current}</span>${escapeHtml(contextText)}</div>`
    : ""
}
<iframe class="canvas"
        src="/p/${slug}/raw${isLatest ? "" : `?v=${current}`}"
        title="${title}"
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
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

export function passwordGatePage(
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
<link rel="stylesheet" href="/style.css" />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
</head>
<body>
${pageHead({ verb: "GET", path: `/p/${slug}` })}
<main>
  ${httpMemo({
    verb: "GET",
    path: `/p/${slug}`,
    rows: [{ k: "re", v: "locked drop", em: true }],
    res: { status: "401 Unauthorized", ok: false, trailing: "www-authenticate: password" },
  })}
  <p class="lede">This drop is locked. <strong>${title}</strong> needs a password.</p>
  <p>Ask whoever shared the link — or your agent — for it.</p>
  ${state.error ? `<div class="error">incorrect password</div>` : ""}
  <form method="POST" action="/p/${slug}/unlock" class="form">
    <div class="field">
      <span class="lbl">password</span>
      <input type="password" name="password" autofocus required />
    </div>
    <button type="submit" class="primary">unlock</button>
  </form>
</main>
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
