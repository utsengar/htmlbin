// Shared header chrome — used by every public page so the modeline-style
// breadcrumb stays identical everywhere. Touch this file → every page
// updates its top bar.

export function pageHead(args: { verb: string; path: string }): string {
  const verb = escapeHtml(args.verb);
  const path = escapeHtml(args.path);
  // When we're not on root, prepend a small ← arrow so home is unambiguously
  // a click target. The wordmark itself is also a hover-underlined link.
  const isHome = args.path === "/";
  const backArrow = isHome
    ? ""
    : /* html */ `<a href="/" class="home-arrow" title="back to htmlbin home">←</a>`;
  return /* html */ `
<header class="page-head">
  <div class="row">
    <div class="crumb">
      ${backArrow}<a href="/" class="wordmark" title="htmlbin home">htmlbin</a>
      <span class="slash">/</span>
      <span class="verb">${verb}</span>
      <span class="path">${path}</span>
    </div>
    <div class="head-meta">
      <a href="/api/onboard">/api/onboard</a>
    </div>
  </div>
</header>`;
}

export function pageFoot(host: string): string {
  return /* html */ `
<footer class="tail">
  <div class="row">
    <span>${escapeHtml(host)}</span>
  </div>
</footer>`;
}

// HTTP-request memo card. Renders as a <details> element so users can
// collapse the headers + status line. Default-expanded. The summary is
// the request line ("GET / HTTP/1.1") with a rotating ▸ triangle prefix.
export type MemoRow = {
  k: string;
  v: string;
  em?: boolean;
  dim?: boolean;
};
export type MemoRes = {
  status: string;
  ok?: boolean;
  trailing?: string;
};

export function httpMemo(args: {
  verb: string;
  path: string;
  proto?: string;
  rows: MemoRow[];
  res?: MemoRes;
  open?: boolean;
}): string {
  const verb = escapeHtml(args.verb);
  const path = escapeHtml(args.path);
  const proto = escapeHtml(args.proto ?? "HTTP/1.1");
  // Default-collapsed everywhere — agents and humans get the page contents
  // first; the request-line chrome stays tucked unless you want it.
  const open = args.open === true;

  const rows = args.rows
    .map((r) => {
      const v = r.em
        ? `<span class="em">${escapeHtml(r.v)}</span>`
        : r.dim
          ? `<span class="dim">${escapeHtml(r.v)}</span>`
          : escapeHtml(r.v);
      return /* html */ `<div class="row"><span class="k">${escapeHtml(
        r.k
      )}</span><span class="v">${v}</span></div>`;
    })
    .join("\n      ");

  const resLine = args.res
    ? /* html */ `<div class="resline"><span class="${
        args.res.ok === false ? "bad" : "ok"
      }">${escapeHtml(args.res.status)}</span>${
        args.res.trailing ? ` &nbsp; ${escapeHtml(args.res.trailing)}` : ""
      }</div>`
    : "";

  return /* html */ `
<details class="req"${open ? " open" : ""} aria-label="memo">
  <summary class="reqline" title="${
    open ? "click to collapse" : "click to expand"
  }"><span class="verb">${verb}</span> <span class="path">${path}</span> <span class="proto">${proto}</span></summary>
  <div class="rows">
      ${rows}
      ${resLine}
  </div>
</details>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
