import type { Bindings } from "../types";
import { httpMemo, pageHead } from "./chrome";
import { STYLE_HREF } from "../styles";

export function verifyPage(
  env: Bindings,
  state: {
    code: string;
    error?: string;
    success?: boolean;
    linked?: boolean;
    label?: string | null;
  }
): string {
  const code = escapeHtml(state.code);
  const HOST = stripScheme(env.PUBLIC_URL);

  if (state.success) {
    return wrapPage(
      env,
      "verified · htmlbin",
      "verification complete",
      "POST",
      "/verify",
      /* html */ `
      <p class="lede">
        The token has been delivered to the agent that started this flow.
        Nobody else can claim it.
      </p>
      ${
        state.linked
          ? /* html */ `<p>
        <strong>Linked to your existing identity.</strong> This new device
        can manage the same drops you've created elsewhere — same
        <code>user_id</code>, fresh token.
      </p>`
          : /* html */ `<p>
        From now on, that agent can publish HTML to <code>${HOST}</code> on
        its own. <strong>You are out of the loop, by design.</strong>
      </p>
      <p>
        Want this token to manage drops you created from another machine?
        Run the verify flow again on that other machine and paste the
        existing token in the optional field — it'll link both devices
        to the same identity.
      </p>`
      }
      <div class="signoff">
        <div class="sig">htmlbin</div>
        <div><a href="/">← back to ${HOST}</a></div>
      </div>
    `
    );
  }

  const errorBlock = state.error
    ? /* html */ `<div class="error">${escapeHtml(state.error)}</div>`
    : "";

  return wrapPage(
    env,
    "verify · htmlbin",
    "one human moment",
    "GET",
    "/verify",
    /* html */ `
    <p class="lede">
      Your agent is asking us to mint a token. We need to confirm a human is
      here. One click on the <strong>Cloudflare Turnstile</strong> checkbox below —
      the same anti-bot widget you've seen on countless other sites — and
      we're done.
    </p>

    ${errorBlock}

    <form method="POST" action="/verify" class="form">
      <label class="field">
        <span class="lbl">verification code</span>
        <input type="text" name="code" value="${code}"
               autocomplete="off" autocapitalize="characters"
               spellcheck="false" pattern="[-A-Za-z0-9]+"
               maxlength="9" required />
      </label>

      <div class="cf-turnstile"
           data-sitekey="${escapeAttr(env.TURNSTILE_SITE_KEY)}"
           data-theme="light"></div>

      <details class="extra">
        <summary>I already have a token from another machine →</summary>
        <label class="field">
          <span class="lbl">existing token (optional)</span>
          <input type="password" name="existing_token"
                 placeholder="hb_…"
                 autocomplete="off" spellcheck="false" />
          <span class="hint">
            Paste an existing <code>hb_…</code> token to link this device
            to the same identity. Leave empty to create a fresh one.
          </span>
        </label>
      </details>

      <button type="submit" class="primary">verify and mint</button>

      <p class="fineprint">
        The code is single-use and expires ten minutes after your agent
        requested it. You can run this flow again any time you need a
        fresh token.
      </p>
    </form>
    <style>
      details.extra { margin: -4px 0 4px; }
      details.extra summary {
        font: 500 12px/1 var(--mono);
        color: var(--ink-soft);
        cursor: pointer;
        padding: 6px 0;
        list-style: none;
      }
      details.extra summary::-webkit-details-marker { display: none; }
      details.extra summary:hover { color: var(--red); }
      details.extra[open] summary { color: var(--ink); }
      details.extra .field { margin-top: 10px; gap: 6px; }
      details.extra input { font-size: 14px; }
      details.extra .hint {
        font: 12px/1.55 var(--mono);
        color: var(--ink-soft);
        max-width: 56ch;
      }
      details.extra .hint code {
        background: var(--bg-2); border: 1px solid var(--rule);
        padding: 0 4px; border-radius: 3px;
      }
    </style>

    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  `
  );
}

function wrapPage(
  env: Bindings,
  title: string,
  re: string,
  verb: string,
  path: string,
  body: string
): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const HOST = stripScheme(env.PUBLIC_URL);
  const memo = httpMemo({
    verb,
    path,
    rows: [
      { k: "host", v: HOST },
      { k: "re", v: re, em: true },
      { k: "date", v: date },
    ],
  });
  return /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${escapeHtml(title)}</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="${STYLE_HREF}" />
<link rel="preload" as="font" type="font/woff2" href="/fonts/Geist-700.woff2" crossorigin="anonymous" />
<link rel="preload" as="font" type="font/woff2" href="/fonts/GeistMono-500.woff2" crossorigin="anonymous" />
</head>
<body>
${pageHead({ verb, path })}
<main>
  ${memo}
  <hr class="rule" />
  <section class="body">${body}</section>
</main>
</body>
</html>`;
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "");
}
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}
