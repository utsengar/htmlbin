const app = document.getElementById("app");
const envEl = document.getElementById("env");
const refreshBtn = document.getElementById("refresh");

// ── tiny DOM helpers ───────────────────────────────────────────────
const el = (tag, attrs = {}, ...children) => {
  const e = tag === "svg" || tag === "rect" || tag === "text" || tag === "title"
    ? document.createElementNS("http://www.w3.org/2000/svg", tag)
    : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") e.setAttribute("class", v);
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
};

const num = (n) => Number(n ?? 0).toLocaleString();
const fmtBytes = (n) => {
  n = Number(n) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};
const fmtDate = (ms) => {
  if (!ms) return "—";
  return new Date(Number(ms)).toISOString().slice(0, 10);
};
const fmtDateTime = (ms) => {
  if (!ms) return "—";
  return new Date(Number(ms)).toISOString().replace("T", " ").slice(0, 16) + " UTC";
};
const since = (ms) => {
  if (!ms) return "—";
  const s = (Date.now() - Number(ms)) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

async function api(path) {
  const r = await fetch(path);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `${r.status}`);
  return body;
}

// ── SVG bar chart ──────────────────────────────────────────────────
function barChart(data, opts = {}) {
  const {
    width = 720, height = 120, color = "#D93025",
    label = (d) => d.bucket, value = (d) => d.value,
  } = opts;
  const max = Math.max(1, ...data.map(value));
  const n = data.length;
  const barW = Math.max(2, Math.floor(width / Math.max(n, 1)) - 2);
  const svg = el("svg", {
    class: "chart", viewBox: `0 0 ${width} ${height + 24}`,
    preserveAspectRatio: "none", width: "100%", height: height + 24,
  });
  data.forEach((d, i) => {
    const v = value(d);
    const h = v > 0 ? Math.max(1, Math.round((v / max) * height)) : 0;
    const x = i * (barW + 2);
    const y = height - h;
    const rect = el("rect", { x, y, width: barW, height: h, fill: color });
    rect.append(el("title", {}, `${label(d)}: ${v}`));
    svg.append(rect);
    if (i === 0 || i === n - 1 || (n > 6 && i === Math.floor(n / 2))) {
      svg.append(el("text", {
        x: x + barW / 2, y: height + 14,
        "text-anchor": "middle", "font-size": "10", fill: "#888",
      }, label(d)));
    }
  });
  return svg;
}

// ── routing ────────────────────────────────────────────────────────
const routes = [
  { re: /^#\/?$/, view: viewOverview },
  { re: /^#\/u\/([A-Za-z0-9_-]+)$/, view: viewUser },
  { re: /^#\/d\/([A-Za-z0-9]+)$/, view: viewDrop },
];

async function route() {
  const hash = location.hash || "#/";
  for (const r of routes) {
    const m = hash.match(r.re);
    if (!m) continue;
    app.innerHTML = "";
    app.append(el("div", { class: "loading" }, "loading…"));
    try {
      const node = await r.view(...m.slice(1));
      app.innerHTML = "";
      app.append(node);
      window.scrollTo(0, 0);
    } catch (e) {
      app.innerHTML = "";
      app.append(el("div", { class: "error" }, `error: ${e.message}`));
    }
    return;
  }
  app.innerHTML = "";
  app.append(el("div", { class: "error" }, "route not found"));
}

window.addEventListener("hashchange", route);
refreshBtn.addEventListener("click", () => route());

// ── shared widgets ─────────────────────────────────────────────────
function summaryCard(title, items) {
  return el("div", { class: "card" },
    el("h3", {}, title),
    el("div", { class: "card-rows" }, ...items.map((it) =>
      el("div", { class: "card-row" },
        el("span", { class: "card-label" }, it.label),
        el("span", { class: `card-value${it.accent ? " accent-" + it.accent : ""}` }, it.value),
      ),
    )),
  );
}

function link(href, text) {
  return el("a", { href, class: "link" }, text);
}

function userLinkFromRow(x) {
  const id = x.user_id ?? x.id;
  return x.github_login
    ? link(`#/u/${id}`, `@${x.github_login}`)
    : link(`#/u/${id}`, `user_${String(id).slice(0, 8)}`);
}

function table(cols, rows) {
  if (!rows || rows.length === 0) return el("div", { class: "empty" }, "no data");
  return el("table", { class: "tbl" },
    el("thead", {},
      el("tr", {}, ...cols.map((c) => el("th", { class: c.align === "right" ? "r" : "" }, c.head))),
    ),
    el("tbody", {}, ...rows.map((row) =>
      el("tr", {}, ...cols.map((c) =>
        el("td", { class: c.align === "right" ? "r" : "" }, c.get(row)),
      )),
    )),
  );
}

// ── overview ───────────────────────────────────────────────────────
async function viewOverview() {
  const params = new URLSearchParams(location.search);
  const win = params.get("window") || "day";
  const buckets = params.get("buckets") || (win === "day" ? 14 : 12);
  const data = await api(`/api/overview?window=${win}&buckets=${buckets}`);
  envEl.textContent = `env: ${data.env}`;

  const s = data.summary;
  const conv = s.verify.started > 0
    ? Math.round((Number(s.verify.completed) / Number(s.verify.started)) * 100)
    : 0;

  const winSel = el("select", {
    onchange: (e) => { location.search = `?window=${e.target.value}`; },
  }, ...["day", "week", "month"].map((w) =>
    el("option", { value: w, ...(w === data.window ? { selected: "" } : {}) }, w),
  ));

  return el("div", { class: "page" },
    el("section", { class: "cards" },
      summaryCard("drops", [
        { label: "total", value: num(s.drops.total) },
        { label: "24h", value: num(s.drops.d24h) },
        { label: "7d", value: num(s.drops.d7d) },
      ]),
      summaryCard("users", [
        { label: "total", value: num(s.users.total) },
        { label: "24h", value: num(s.users.d24h) },
        { label: "7d", value: num(s.users.d7d) },
      ]),
      summaryCard("tokens", [
        { label: "active 7d", value: num(s.tokens.active_7d) },
      ]),
      summaryCard("verify (24h)", [
        { label: "started", value: num(s.verify.started) },
        { label: "completed", value: num(s.verify.completed) },
        { label: "conv", value: `${conv}%`, accent: conv >= 70 ? "green" : conv >= 40 ? "yellow" : "red" },
      ]),
    ),

    el("section", { class: "section" },
      el("div", { class: "section-head" },
        el("h2", {}, `timeseries — ${data.window}, last ${data.timeseries.length} ${data.window}s`),
        winSel,
      ),
      el("div", { class: "chart-pair" },
        el("div", { class: "chart-box" },
          el("h3", {}, "drops"),
          barChart(data.timeseries, { value: (d) => d.drops, color: "#D93025" }),
        ),
        el("div", { class: "chart-box" },
          el("h3", {}, "users"),
          barChart(data.timeseries, { value: (d) => d.users, color: "#333" }),
        ),
      ),
    ),

    el("section", { class: "section" },
      el("h2", {}, "top drops by views"),
      table([
        { head: "slug", get: (d) => link(`#/d/${d.slug}`, `/p/${d.slug}`) },
        { head: "title", get: (d) => d.title || "—" },
        { head: "owner", get: (d) => userLinkFromRow(d) },
        { head: "views", get: (d) => num(d.view_count), align: "right" },
      ], data.top_drops),
    ),

    el("section", { class: "section" },
      el("h2", {}, "top users by drops"),
      table([
        { head: "user", get: (u) => userLinkFromRow(u) },
        { head: "joined", get: (u) => fmtDate(u.created_at) },
        { head: "drops", get: (u) => num(u.drops), align: "right" },
        { head: "views", get: (u) => num(u.views), align: "right" },
      ], data.top_users),
    ),

    renderRisk(data.risk, s, conv),

    el("div", { class: "meta" }, `generated ${fmtDateTime(data.generated_at)}`),
  );
}

function renderRisk(r, s, conv) {
  const rows = [];
  for (const x of r.burst) rows.push({
    severity: "heavy", label: "burst writes",
    body: [userLinkFromRow(x), " created ", el("strong", {}, num(x.n)), " drops in last 24h"],
  });
  for (const x of r.zero) rows.push({
    severity: "heavy", label: "zero-view aging",
    body: [userLinkFromRow(x), " has ", el("strong", {}, num(x.n)), " drops >24h old with 0 views"],
  });
  for (const x of r.rate_limit) rows.push({
    severity: "heavy", label: "rate-limit hits",
    body: [`bucket ${x.bucket} at `, el("strong", {}, num(x.c)), " hits"],
  });
  if (s.verify.started >= 10 && conv < 50) rows.push({
    severity: "heavy", label: "verify drop-off",
    body: [`24h conversion `, el("strong", {}, `${conv}%`), ` (${num(s.verify.completed)}/${num(s.verify.started)})`],
  });
  for (const x of r.storage) {
    if (Number(x.bytes) === 0) continue;
    rows.push({
      severity: "soft", label: "storage outlier",
      body: [userLinkFromRow(x), " ", el("strong", {}, fmtBytes(x.bytes)), ` across ${num(x.drops)} drops`],
    });
  }
  for (const x of r.edit_spam) rows.push({
    severity: "soft", label: "edit-spam",
    body: [link(`#/d/${x.slug}`, `/p/${x.slug}`), " at ", el("strong", {}, `v${x.latest_version}`), " of 200"],
  });
  for (const x of r.lock) rows.push({
    severity: "soft", label: "lock-heavy",
    body: [userLinkFromRow(x), " ", el("strong", {}, `${Math.round(Number(x.r) * 100)}%`), ` password-locked across ${num(x.n)} drops`],
  });

  return el("section", { class: "section" },
    el("h2", {}, "risk signals"),
    rows.length === 0
      ? el("div", { class: "empty" }, "none")
      : el("div", { class: "risk-list" }, ...rows.map((row) =>
          el("div", { class: `risk-row risk-${row.severity}` },
            el("span", { class: "risk-dot" }, "●"),
            el("span", { class: "risk-label" }, row.label),
            el("span", {}, ...row.body),
          ),
        )),
  );
}

// ── user detail ────────────────────────────────────────────────────
async function viewUser(userId) {
  const data = await api(`/api/user/${encodeURIComponent(userId)}`);
  const u = data.user;
  const handle = u.github_login ? `@${u.github_login}` : `user_${String(u.id).slice(0, 8)}`;

  const totals = {
    drops: data.drops.length,
    views: data.drops.reduce((a, d) => a + Number(d.view_count || 0), 0),
    storage: data.drops.reduce((a, d) => a + Number(d.bytes || 0), 0),
    locked: data.drops.filter((d) => Number(d.locked) === 1).length,
  };
  const activeTokens = data.tokens.filter((t) => !t.revoked_at).length;
  const revokedTokens = data.tokens.length - activeTokens;

  return el("div", { class: "page" },
    el("nav", { class: "crumbs" }, link("#/", "← overview")),

    el("section", { class: "section user-head" },
      u.github_login
        ? el("img", { class: "avatar", src: `https://github.com/${u.github_login}.png?size=80`, alt: "" })
        : el("div", { class: "avatar avatar-placeholder" }),
      el("div", {},
        el("h2", { class: "user-title" }, handle),
        el("div", { class: "meta" },
          `id: ${u.id} · joined ${fmtDate(u.created_at)} (${since(u.created_at)})`,
          u.github_login
            ? el("span", {}, " · ", el("a", { href: `https://github.com/${u.github_login}`, target: "_blank", rel: "noopener", class: "link" }, "github →"))
            : null,
        ),
      ),
    ),

    el("section", { class: "cards" },
      summaryCard("totals", [
        { label: "drops", value: num(totals.drops) },
        { label: "views", value: num(totals.views) },
        { label: "storage", value: fmtBytes(totals.storage) },
        { label: "locked", value: num(totals.locked) },
      ]),
      summaryCard("tokens", [
        { label: "active", value: num(activeTokens) },
        { label: "revoked", value: num(revokedTokens) },
      ]),
    ),

    el("section", { class: "section" },
      el("h2", {}, "drops over time (last 30 days)"),
      el("div", { class: "chart-box" },
        barChart(data.timeseries, { value: (d) => d.drops }),
      ),
    ),

    el("section", { class: "section" },
      el("h2", {}, `drops (${data.drops.length})`),
      table([
        { head: "slug", get: (d) => link(`#/d/${d.slug}`, `/p/${d.slug}`) },
        { head: "title", get: (d) => d.title || "—" },
        { head: "created", get: (d) => fmtDate(d.created_at) },
        { head: "updated", get: (d) => since(d.updated_at) },
        { head: "v", get: (d) => num(d.latest_version), align: "right" },
        { head: "size", get: (d) => fmtBytes(d.bytes), align: "right" },
        { head: "views", get: (d) => num(d.view_count), align: "right" },
        { head: "lock", get: (d) => Number(d.locked) === 1 ? "🔒" : "" },
      ], data.drops),
    ),

    el("section", { class: "section" },
      el("h2", {}, `tokens (${data.tokens.length})`),
      table([
        { head: "label", get: (t) => t.label || "—" },
        { head: "created", get: (t) => fmtDate(t.created_at) },
        { head: "last used", get: (t) => t.last_used_at ? since(t.last_used_at) : "—" },
        { head: "revoked", get: (t) => t.revoked_at ? fmtDate(t.revoked_at) : "" },
      ], data.tokens),
    ),

    data.verifications.length > 0
      ? el("section", { class: "section" },
          el("h2", {}, `recent verifications (${data.verifications.length})`),
          table([
            { head: "code", get: (v) => v.code },
            { head: "status", get: (v) => v.status },
            { head: "label", get: (v) => v.label || "—" },
            { head: "created", get: (v) => fmtDateTime(v.created_at) },
          ], data.verifications),
        )
      : null,
  );
}

// ── drop detail ────────────────────────────────────────────────────
async function viewDrop(slug) {
  const data = await api(`/api/drop/${encodeURIComponent(slug)}`);
  const d = data.drop;
  const totalBytes = data.versions.reduce((a, v) => a + Number(v.size_bytes || 0), 0);

  return el("div", { class: "page" },
    el("nav", { class: "crumbs" }, link("#/", "← overview")),

    el("section", { class: "section" },
      el("h2", {}, d.title || "(no title)"),
      el("div", { class: "meta" },
        `/p/${d.slug} · created ${fmtDate(d.created_at)} · ${num(d.view_count)} views · v${d.latest_version}`,
        Number(d.locked) === 1 ? " · 🔒 locked" : "",
      ),
      d.description ? el("p", { class: "desc" }, d.description) : null,
      el("div", { class: "links" },
        el("a", { href: `https://htmlbin.dev/p/${d.slug}`, target: "_blank", rel: "noopener", class: "link" }, "open live →"),
        " · ",
        el("a", { href: `https://htmlbin.dev/p/${d.slug}/raw`, target: "_blank", rel: "noopener", class: "link" }, "raw →"),
      ),
    ),

    data.owner
      ? el("section", { class: "section" },
          el("h2", {}, "owner"),
          el("div", {},
            userLinkFromRow({ user_id: data.owner.id, github_login: data.owner.github_login }),
            ` · joined ${fmtDate(data.owner.created_at)}`,
          ),
        )
      : null,

    el("section", { class: "cards" },
      summaryCard("totals", [
        { label: "versions", value: num(data.versions.length) },
        { label: "storage", value: fmtBytes(totalBytes) },
        { label: "views", value: num(d.view_count) },
      ]),
    ),

    el("section", { class: "section" },
      el("h2", {}, `versions (${data.versions.length})`),
      table([
        { head: "v", get: (v) => num(v.version), align: "right" },
        { head: "size", get: (v) => fmtBytes(v.size_bytes), align: "right" },
        { head: "created", get: (v) => fmtDateTime(v.created_at) },
        { head: "context", get: (v) => Number(v.has_context) === 1 ? "✓" : "" },
        { head: "url", get: (v) => el("a", { href: `https://htmlbin.dev/p/${d.slug}?v=${v.version}`, target: "_blank", rel: "noopener", class: "link" }, `?v=${v.version}`) },
      ], data.versions),
    ),
  );
}

route();
