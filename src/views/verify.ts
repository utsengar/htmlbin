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
    githubLogin?: string;
    label?: string | null;
  }
): string {
  const code = escapeHtml(state.code);
  const HOST = stripScheme(env.PUBLIC_URL);

  if (state.success) {
    const who = state.githubLogin
      ? /* html */ `<p>
          Signed in as <strong>@${escapeHtml(state.githubLogin)}</strong>.
          The token has been delivered to the agent that started this flow.
          Nobody else can claim it.
        </p>`
      : /* html */ `<p class="lede">
          The token has been delivered to the agent that started this flow.
          Nobody else can claim it.
        </p>`;
    return wrapPage(
      env,
      "verified · htmlbin",
      "verification complete",
      "POST",
      "/auth/github/callback",
      /* html */ `
      ${who}
      ${
        state.linked
          ? /* html */ `<p>
        <strong>Linked to your existing htmlbin identity.</strong> This new
        device can manage the same drops you've created elsewhere — same
        <code>user_id</code>, fresh token.
      </p>`
          : /* html */ `<p>
        From now on, that agent can publish HTML to <code>${HOST}</code> on
        its own. <strong>You are out of the loop, by design.</strong>
      </p>
      <p>
        Want this token to manage drops you created from another machine?
        Run the verify flow again on that other machine and sign in with
        the same GitHub account — both devices will end up bound to the
        same identity.
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

  // The verification code is part of the link to /auth/github/start —
  // we don't expose it as an editable field anymore (no human ever
  // needs to retype it; the URL the agent printed already includes it).
  const ghStartUrl = `/auth/github/start?code=${encodeURIComponent(state.code)}`;

  return wrapPage(
    env,
    "verify · htmlbin",
    "one human moment",
    "GET",
    "/verify",
    /* html */ `
    <p class="lede">
      Your agent is asking us to mint a token. We need to know which
      human is here — sign in with GitHub, then your agent gets its
      token. We only read your public username and id.
    </p>

    ${errorBlock}

    <div class="form">
      <div class="field readonly">
        <span class="lbl">verification code</span>
        <code class="code">${code || "(missing)"}</code>
      </div>

      <a href="${escapeAttr(ghStartUrl)}" class="primary gh-btn">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="currentColor" d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.1c-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.27-1.7-1.27-1.7-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18.91-.25 1.89-.38 2.86-.39.97 0 1.95.13 2.86.39 2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.08 0 4.4-2.69 5.37-5.25 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.21.68.8.56 4.56-1.52 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5Z"/>
        </svg>
        <span>Sign in with GitHub</span>
      </a>

      <p class="fineprint">
        The code is single-use and expires ten minutes after your agent
        requested it. We bind one htmlbin account per GitHub identity —
        new tokens always attach to the same account, so quotas and
        existing drops follow you across devices.
      </p>
    </div>

    <style>
      .field.readonly { gap: 6px; }
      .field.readonly .code {
        font: 500 14px/1 var(--mono);
        color: var(--ink);
        background: var(--bg-2);
        border: 1px solid var(--rule);
        padding: 8px 10px;
        border-radius: 4px;
        letter-spacing: 0.08em;
        align-self: flex-start;
      }
      a.primary.gh-btn {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        width: fit-content;
      }
      a.primary.gh-btn svg { flex: 0 0 auto; }
    </style>
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
