# @htmlbin/cli

> Publish HTML, get a URL. One verb, pluggable backends.

```
$ htmlbin publish ./out.html
https://htmlbin.dev/p/aB3xK7g

$ htmlbin publish ./out.html --to gh-pages
https://myorg.github.io/myrepo/pr-1234/

$ htmlbin publish ./out.html --to cloudflare --project preview --pr 1234
https://pr-1234.preview.pages.dev
```

The CLI for [htmlbin](https://htmlbin.dev). The cloud is the default. Alternative backends ship as opt-ins for environments where a public URL is the wrong fit — GitHub Pages (org-internal SSO via Pages → Private) and Cloudflare Pages + Access (free identity-aware gate up to 50 users).

## Install

```bash
npm i -g @htmlbin/cli
# or
npx @htmlbin/cli publish ./out.html
```

Requires Node 20+.

## Backends

| Backend | When to use | Auth | Cost barrier |
|---|---|---|---|
| `cloud` *(default)* | Public-by-URL publishing. Most uses. | `hb_*` token (device-code) | Free |
| `gh-pages` | Internal review previews inside a GitHub org | `$GITHUB_TOKEN` | GitHub Enterprise / Teams (private Pages) |
| `cloudflare` | Free SSO-gated previews via Cloudflare Access | `$CLOUDFLARE_API_TOKEN` | Free Zero Trust tier (up to 50 users) |

### Backend resolution order

1. `--to <name>` flag
2. `$HTMLBIN_BACKEND` env var
3. `backend = "…"` in `./.htmlbin/config` (TOML)
4. Default: `cloud`

## Commands

```
htmlbin publish <file> [options]   Publish an HTML file, print the URL
htmlbin list                       List your drops
htmlbin delete <slug>              Remove a drop
htmlbin url <slug>                 Print the URL for a slug (no publish)
htmlbin login                      Cloud: device-code sign-in via GitHub
htmlbin setup                      One-time prep for the selected backend
```

Global flags:

```
--to cloud | gh-pages | cloudflare    backend selector
--output text | json                  output format (default: text)
```

## Output modes (agent-friendly)

`--output json` makes every command emit a structured payload on stdout. Errors emit `{"error": {"code", "message", "hint?", "details?"}}` on stderr — same `error.code` shape as the htmlbin.dev API.

```bash
$ htmlbin --output json publish ./out.html
{"url":"https://htmlbin.dev/p/aB3xK7g","slug":"aB3xK7g","backend":"cloud"}

$ htmlbin --output json list
[{"slug":"aB3xK7g","url":"...","updated_at":"...","title":"..."}, ...]

$ htmlbin --output json publish /tmp/missing.html
{"error":{"code":"file_not_found","message":"No such file: /tmp/missing.html","hint":"...","details":{...}}}
# exit code 4
```

### Auto-detection

If any of these env vars is set, `--output json` becomes the default — no flag needed:

```
CLAUDE_CODE · CURSOR_AGENT · CODEX · CODEX_AGENT · AIDER · CLINE · AMP_CODE · DEVIN
```

Most coding-agent runners set one of these. The agent gets JSON without having to know about the flag; humans running interactively get the text formatting. Explicit `--output text` always overrides the detection.

## Cloud backend (default)

The fastest path. Wraps the htmlbin.dev API with no new server-side code.

### One-time login

```bash
htmlbin login
```

Mints a `hb_*` token via the device-code flow (open the verification URL, sign in with GitHub, token writes to `./.htmlbin/token`). Same token storage convention the API's `/api/onboard` descriptor advertises:

1. `./.htmlbin/token` (project-local, preferred)
2. `$HTMLBIN_TOKEN` env var
3. `~/.config/htmlbin/token`

### Publish

```bash
htmlbin publish ./out.html --title "Preview of PR #1234"
# → https://htmlbin.dev/p/aB3xK7g
```

`--title` defaults to the filename. `--description` is optional. Both are cloud-only; gh-pages and cloudflare ignore them.

### Manage

```bash
htmlbin list                     # paginated history (newest first)
htmlbin url aB3xK7g              # print URL for a slug
htmlbin delete aB3xK7g           # remove the drop
```

## GitHub Pages backend (`--to gh-pages`)

For org-internal previews gated by GitHub SSO. GitHub itself provides the gate: a **private repo** with **Settings → Pages → Access: "Private"** redirects unauthenticated viewers through the org's SAML SSO before serving HTML.

### Prerequisites

- A repo with GitHub Pages enabled, source = `gh-pages` branch.
- Repo visibility: **Private** or **Internal**.
- Org plan: **GitHub Enterprise Cloud** or **Teams** with private Pages enabled. Free / personal orgs serve public Pages regardless of repo visibility.

### Setup

```bash
GITHUB_TOKEN=$(gh auth token) htmlbin setup --to gh-pages
```

Creates `gh-pages` with an empty commit if missing, then prints the manual UI steps for flipping Pages → "Private" (no API).

### Publish

```bash
# Locally
htmlbin publish ./out.html --to gh-pages --pr 1234
# → https://myorg.github.io/myrepo/pr-1234/

# In GitHub Actions (PR number auto-detected from $GITHUB_REF)
htmlbin publish ./out.html --to gh-pages
```

### How publish works

One atomic commit per invocation via the GitHub Git Data API — no clone, no temp dir, no git binary:

```
GET    /repos/{o}/{r}/git/ref/heads/gh-pages   → current SHA
GET    .../git/commits/{sha}                   → current tree
POST   .../git/blobs                           → upload HTML
POST   .../git/trees { base_tree, [pr-N/...] }
POST   .../git/commits { tree, parents }
PATCH  .../git/refs/heads/gh-pages             → advance ref
```

Pages typically rebuilds within ~60s after the commit lands.

## Cloudflare backend (`--to cloudflare`)

For teams that want a free SSO gate without GitHub Enterprise. Cloudflare Access is an identity-aware proxy in front of any CF-hosted URL — Google, Okta, Azure AD, GitHub, one-time pin email codes, or email-domain rules.

### Prerequisites

- A Cloudflare account with **Zero Trust / Access enabled** (free tier works for up to 50 users).
- `$CLOUDFLARE_API_TOKEN` with **Pages: edit** and **Access: edit** scopes on the target account.
- `$CLOUDFLARE_ACCOUNT_ID`.

### Setup

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
htmlbin setup --to cloudflare --project preview-htmlbin --email-domain example.com
```

Creates the Pages project if it doesn't exist, then provisions an Access app covering `*.preview-htmlbin.pages.dev` with a default "allow" policy. Pass `--idp <id>` for a specific IdP, or `--email user@x.com`.

Without include flags, `setup` just prints the available IdPs and tells you how to re-run.

### Publish

```bash
htmlbin publish ./out.html --to cloudflare --project preview-htmlbin --pr 1234
# → https://pr-1234.preview-htmlbin.pages.dev
```

The deployment alias is the slug (`pr-1234` by default, or `--slug feature-x`). Cloudflare serves the URL within seconds; Access gates it via the policy you configured.

## Configuration file

Optional. `./.htmlbin/config` is read on every command:

```toml
backend = "cloudflare"
account_id = "abcdef..."
project = "preview-htmlbin"
```

For gh-pages:

```toml
backend = "gh-pages"
repo = "myorg/myrepo"
branch = "gh-pages"
```

## Exit codes

Stable across releases — CI can switch on these.

| Code | Meaning |
|---|---|
| `0` | success |
| `2` | auth failure (`unauthorized`, `auth_required`, `github_token_missing`, `cloudflare_token_missing`) |
| `3` | `forbidden` |
| `4` | not found (drop, file, branch, project) |
| `5` | rate limit / quota |
| `6` | size limit (HTML too large, title too long) |
| `7` | bad input (invalid slug, missing PR, bad backend name, setup required) |
| `8` | network / server misconfig |

The CLI prints `error: <message>  [<code>]` to stderr. The bracketed code mirrors the htmlbin.dev API's `error.code` for the cloud backend — agents and CI can switch on it.

## Reference GitHub Actions workflows

The CLI is publish-only. Whatever produces the HTML upstream is the user's choice. Two reference workflows ship in `examples/` for the two common cases:

### Static-site repos — `examples/preview-workflow.yml`

For repos whose build naturally produces HTML (Storybook, Vite SPA, Astro, Next.js static export, etc.). The workflow runs `npm run build`, then publishes whatever HTML the build emits. Branching sticky comments handle the three failure modes: preview lives / build OK but no HTML at path / build failed entirely.

### Non-static repos — `examples/agent-preview-workflow.yml`

For repos that don't build to HTML on their own (backend services, libraries, mobile apps, CLIs). A headless coding agent CLI — Claude Code `-p` mode by default, swap-points documented for OpenAI Codex CLI's `codex exec` — runs inside the CI runner with full tool use (file system, bash, multi-turn). The agent reads the PR diff and writes `./preview.html`; `htmlbin publish` ships it.

The agent harness is what makes this work — a raw model call against a diff produces noise; an agent that can read related files, run the build, and iterate produces a real preview. The repo content never leaves the CI environment (only model-API egress); pick whichever agent vendor your team is already paying for.

Both workflows pair with `examples/teardown-workflow.yml` to clean up the preview when the PR closes.

## License

MIT. Source: [github.com/utsengar/htmlbin](https://github.com/utsengar/htmlbin) (under `cli/`).
