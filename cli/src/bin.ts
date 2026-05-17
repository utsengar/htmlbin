// CLI entrypoint. commander wires subcommands to backend methods.
//
//   htmlbin publish <file>             → publish
//   htmlbin list                       → list
//   htmlbin delete <slug>              → delete
//   htmlbin url <slug>                 → print URL
//   htmlbin login                      → cloud device-code auth
//   htmlbin setup                      → backend-specific one-time prep
//
// Every command accepts `--to <backend>`. The active backend resolves via
// the precedence in src/config.ts.

import { Command, Option } from "commander";
import { createCloudBackend } from "./backends/cloud.js";
import { createGhPagesBackend } from "./backends/gh-pages.js";
import { createCloudflareBackend } from "./backends/cloudflare.js";
import { CliError, exitCodeFor } from "./errors.js";
import {
  loadConfigFile,
  resolveBackend,
  type ConfigFile,
} from "./config.js";
import type { Backend, BackendName, DropSummary, PublishOpts } from "./backend.js";
import { setAgent } from "./useragent.js";

const VERSION = "0.1.0";

// Agent-runner env vars that, when present, default --output to json so
// the runner gets parseable data without having to know about the flag.
// Mirrors DataDog/pup's detection list as of 2026-05, plus a couple of
// runners we want to cover ourselves. Tuple of [env var, friendly name]
// — the friendly name is included in the User-Agent.
const AGENT_ENV_VARS: ReadonlyArray<readonly [string, string]> = [
  ["CLAUDECODE", "claude-code"],
  ["CLAUDE_CODE", "claude-code"],
  ["CURSOR_AGENT", "cursor"],
  ["CODEX", "codex"],
  ["CODEX_AGENT", "codex"],
  ["OPENAI_CODEX", "codex"],
  ["OPENCODE", "opencode"],
  ["AIDER", "aider"],
  ["CLINE", "cline"],
  ["WINDSURF_AGENT", "windsurf"],
  ["GITHUB_COPILOT", "github-copilot"],
  ["AMAZON_Q", "amazon-q"],
  ["AWS_Q_DEVELOPER", "amazon-q"],
  ["GEMINI_CODE_ASSIST", "gemini-code-assist"],
  ["SRC_CODY", "sourcegraph-cody"],
  ["PI_CODING_AGENT", "pi"],
  ["AMP_CODE", "amp"],
  ["DEVIN", "devin"],
  ["AGENT", "generic-agent"], // generic fallback for runners we haven't named
];

export function detectAgent(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.FORCE_AGENT_MODE) return "forced";
  for (const [key, name] of AGENT_ENV_VARS) {
    if (env[key]) return name;
  }
  return null;
}

function isAgentContext(env: NodeJS.ProcessEnv = process.env): boolean {
  return detectAgent(env) !== null;
}

type OutputMode = "text" | "json";
// Mutable module-level — set by the commander preAction hook before each
// command runs. Used by die() since errors can throw from anywhere.
let OUTPUT_MODE: OutputMode = isAgentContext() ? "json" : "text";

// Configure the User-Agent module with the detected agent name at startup
// so every HTTP call includes it. If the detection result changes (e.g.,
// FORCE_AGENT_MODE flips on between calls), the preAction hook re-syncs.
setAgent(detectAgent());

interface GlobalOpts {
  to?: string;
  output?: OutputMode;
}

interface PublishCmdOpts extends GlobalOpts {
  title?: string;
  description?: string;
  pr?: string;
  slug?: string;
  repo?: string;
  branch?: string;
  project?: string;
}

interface SetupCmdOpts extends GlobalOpts {
  // gh-pages
  branch?: string;
  repo?: string;
  // cloudflare
  project?: string;
  productionBranch?: string;
  idp?: string[];
  emailDomain?: string[];
  email?: string[];
}

async function makeBackend(name: BackendName, cfg: ConfigFile, extra: PublishCmdOpts | SetupCmdOpts = {}): Promise<Backend> {
  switch (name) {
    case "cloud":
      return createCloudBackend({ apiUrl: cfg.api_url });
    case "gh-pages":
      return createGhPagesBackend({
        repo: extra.repo ?? cfg.repo,
        branch: extra.branch ?? cfg.branch,
      });
    case "cloudflare":
      return createCloudflareBackend({
        accountId: cfg.account_id,
        project: (extra as PublishCmdOpts).project ?? cfg.project,
        setupIdp: (extra as SetupCmdOpts).idp,
        setupEmailDomain: (extra as SetupCmdOpts).emailDomain,
        setupEmail: (extra as SetupCmdOpts).email,
        productionBranch: (extra as SetupCmdOpts).productionBranch,
      });
  }
}

async function resolveActiveBackend(globalOpts: GlobalOpts): Promise<{ backend: BackendName; config: ConfigFile }> {
  const config = await loadConfigFile();
  const resolved = resolveBackend({
    flag: globalOpts.to,
    env: process.env.HTMLBIN_BACKEND,
    config,
  });
  return { backend: resolved.backend, config };
}

function die(err: unknown): never {
  if (err instanceof CliError) {
    if (OUTPUT_MODE === "json") {
      const body: { error: Record<string, unknown> } = {
        error: { code: err.code, message: err.message },
      };
      if (err.hint) body.error.hint = err.hint;
      if (err.details) body.error.details = err.details;
      process.stderr.write(JSON.stringify(body) + "\n");
    } else {
      process.stderr.write(`error: ${err.message}  [${err.code}]\n`);
      if (err.hint) process.stderr.write(`hint:  ${err.hint}\n`);
    }
    process.exit(exitCodeFor(err.code));
  }
  const message = (err as Error)?.message ?? String(err);
  if (OUTPUT_MODE === "json") {
    process.stderr.write(JSON.stringify({ error: { code: "unknown", message } }) + "\n");
  } else {
    process.stderr.write(`error: ${message}\n`);
  }
  process.exit(1);
}

// Emit a result. JSON mode prints the structured payload on stdout;
// text mode invokes the human renderer (which may have side effects like
// writing notes to stderr — those only fire in text mode).
function emit(payload: unknown, renderText: () => string): void {
  if (OUTPUT_MODE === "json") {
    process.stdout.write(JSON.stringify(payload) + "\n");
  } else {
    process.stdout.write(renderText());
  }
}

async function run(): Promise<void> {
  const program = new Command();
  program
    .name("htmlbin")
    .description("Publish HTML, get a URL. Cloud by default; pluggable backends for org-internal hosting.")
    .version(VERSION)
    .addOption(
      new Option("--to <backend>", "backend to use: cloud | gh-pages | cloudflare").choices([
        "cloud",
        "gh-pages",
        "cloudflare",
      ])
    )
    .addOption(
      new Option("--output <format>", "output format (auto-detects coding-agent env vars and defaults to json then)")
        .choices(["text", "json"])
    );

  // Sync OUTPUT_MODE + User-Agent before each command runs so die() and
  // emit() see the resolved value, and outbound HTTP carries the detected
  // agent. Precedence: explicit --output > agent env detection > "text".
  program.hook("preAction", () => {
    const explicit = program.opts<GlobalOpts>().output;
    if (explicit) OUTPUT_MODE = explicit;
    else OUTPUT_MODE = isAgentContext() ? "json" : "text";
    setAgent(detectAgent());
  });

  // --- publish ---
  program
    .command("publish")
    .description("Publish an HTML file and print the resulting URL")
    .argument("<file>", "path to an HTML file")
    .option("--title <text>", "title (cloud backend; defaults to filename)")
    .option("--description <text>", "description (cloud backend)")
    .option("--pr <n>", "PR number (gh-pages, cloudflare; default: $GITHUB_REF in CI)")
    .option("--slug <name>", "explicit slug (e.g. feature/X; overrides --pr)")
    .option("--repo <owner/name>", "repo (gh-pages; default: git remote origin)")
    .option("--branch <name>", "branch (gh-pages; default: gh-pages)")
    .option("--project <name>", "Pages project (cloudflare; default: $CLOUDFLARE_PAGES_PROJECT)")
    .action(async (file: string, cmdOpts: PublishCmdOpts) => {
      try {
        const { backend, config } = await resolveActiveBackend(program.opts<GlobalOpts>());
        const be = await makeBackend(backend, config, cmdOpts);
        const opts: PublishOpts = { file };
        if (cmdOpts.title) opts.title = cmdOpts.title;
        if (cmdOpts.description) opts.description = cmdOpts.description;
        if (cmdOpts.pr) opts.pr = Number(cmdOpts.pr);
        if (cmdOpts.slug) opts.slug = cmdOpts.slug;
        const r = await be.publish(opts);
        const payload: Record<string, unknown> = {
          url: r.url,
          slug: r.slug,
          backend,
        };
        if (r.note) payload.note = r.note;
        emit(payload, () => {
          let out = r.url + "\n";
          if (r.note) process.stderr.write(`note:  ${r.note}\n`);
          return out;
        });
      } catch (e) {
        die(e);
      }
    });

  // --- list ---
  program
    .command("list")
    .description("List published drops on the active backend")
    .option("--project <name>", "Pages project (cloudflare)")
    .option("--repo <owner/name>", "repo (gh-pages)")
    .option("--branch <name>", "branch (gh-pages)")
    .option("-n, --limit <n>", "max rows to return (default: all)")
    .action(async (cmdOpts: PublishCmdOpts & { limit?: string }) => {
      try {
        const { backend, config } = await resolveActiveBackend(program.opts<GlobalOpts>());
        const be = await makeBackend(backend, config, cmdOpts);
        let rows = await be.list();
        if (cmdOpts.limit) {
          const n = Number.parseInt(cmdOpts.limit, 10);
          if (!Number.isFinite(n) || n < 1) {
            throw new CliError("invalid_arg", `--limit must be a positive integer (got: ${cmdOpts.limit})`);
          }
          rows = rows.slice(0, n);
        }
        emit(rows, () => {
          if (rows.length === 0) return "(no drops)\n";
          if (process.stdout.isTTY) return formatListForHumans(rows);
          // Pipe-friendly: tab-separated, no headers, full ISO timestamp.
          return rows
            .map((r) => `${r.slug}\t${r.updated_at}\t${r.title ?? ""}\t${r.url}`)
            .join("\n") + "\n";
        });
      } catch (e) {
        die(e);
      }
    });

  // --- delete ---
  program
    .command("delete")
    .description("Delete a drop (slug or PR number)")
    .argument("<slug>", "slug or PR number")
    .option("--project <name>", "Pages project (cloudflare)")
    .option("--repo <owner/name>", "repo (gh-pages)")
    .option("--branch <name>", "branch (gh-pages)")
    .action(async (slug: string, cmdOpts: PublishCmdOpts) => {
      try {
        const { backend, config } = await resolveActiveBackend(program.opts<GlobalOpts>());
        const be = await makeBackend(backend, config, cmdOpts);
        await be.delete(slug);
        emit({ deleted: true, slug, backend }, () => `deleted ${slug}\n`);
      } catch (e) {
        die(e);
      }
    });

  // --- url ---
  program
    .command("url")
    .description("Print the URL for a given slug (no publish)")
    .argument("<slug>", "slug or PR number")
    .option("--project <name>", "Pages project (cloudflare)")
    .option("--repo <owner/name>", "repo (gh-pages)")
    .option("--branch <name>", "branch (gh-pages)")
    .action(async (slug: string, cmdOpts: PublishCmdOpts) => {
      try {
        const { backend, config } = await resolveActiveBackend(program.opts<GlobalOpts>());
        const be = await makeBackend(backend, config, cmdOpts);
        const url = await be.url(slug);
        emit({ url, slug, backend }, () => url + "\n");
      } catch (e) {
        die(e);
      }
    });

  // --- login ---
  program
    .command("login")
    .description("Sign in (cloud backend only — device-code flow with GitHub)")
    .action(async () => {
      try {
        const cloud = createCloudBackend();
        if (!cloud.login) throw new CliError("invalid_arg", "Cloud backend has no login method.");
        await cloud.login();
      } catch (e) {
        die(e);
      }
    });

  // --- setup ---
  program
    .command("setup")
    .description("One-time prep for the selected backend (creates branches / projects, prints UI steps)")
    .option("--branch <name>", "branch (gh-pages; default: gh-pages)")
    .option("--repo <owner/name>", "repo (gh-pages)")
    .option("--project <name>", "Pages project (cloudflare)")
    .option("--production-branch <name>", "production branch (cloudflare; default: main)")
    .option("--idp <id...>", "Cloudflare Access IdP id(s) to allow (repeatable)")
    .option("--email-domain <domain...>", "allow this email domain (Access)")
    .option("--email <addr...>", "allow this specific email (Access)")
    .action(async (cmdOpts: SetupCmdOpts) => {
      try {
        const { backend, config } = await resolveActiveBackend(program.opts<GlobalOpts>());
        const be = await makeBackend(backend, config, cmdOpts);
        if (!be.setup) throw new CliError("invalid_arg", `Backend "${backend}" has no setup step.`);
        const r = await be.setup();
        emit({ instructions: r.instructions, backend }, () =>
          r.instructions.map((line) => line + "\n").join("")
        );
      } catch (e) {
        die(e);
      }
    });

  await program.parseAsync(process.argv);
}

// ---------------------------------------------------------------
// list-output formatter for TTY (aligned columns, smart timestamps)
// ---------------------------------------------------------------

function formatListForHumans(rows: DropSummary[]): string {
  const data = rows.map((r) => ({
    slug: r.slug,
    updated: humanTime(r.updated_at),
    title: truncate(r.title?.trim() || "—", 50),
    url: r.url,
  }));

  const headers = { slug: "SLUG", updated: "UPDATED", title: "TITLE", url: "URL" } as const;
  const cols: Array<keyof typeof headers> = ["slug", "updated", "title", "url"];

  const widths: Record<string, number> = {};
  for (const c of cols) {
    widths[c] = Math.max(headers[c].length, ...data.map((d) => d[c].length));
  }

  const SEP = "  ";
  const DIM = "\x1b[2m";
  const RESET = "\x1b[0m";

  const headerLine = DIM + cols.map((c) => headers[c].padEnd(widths[c] ?? 0)).join(SEP) + RESET;
  const rowLines = data.map((d) =>
    cols.map((c) => d[c].padEnd(widths[c] ?? 0)).join(SEP)
  );
  return [headerLine, ...rowLines].join("\n") + "\n";
}

function humanTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const ms = Math.max(0, Date.now() - t);
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (ms < min) return "just now";
  if (ms < hr) return `${Math.floor(ms / min)}m ago`;
  if (ms < day) return `${Math.floor(ms / hr)}h ago`;
  if (ms < 30 * day) return `${Math.floor(ms / day)}d ago`;
  // older: YYYY-MM-DD
  return iso.slice(0, 10);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

run().catch(die);
