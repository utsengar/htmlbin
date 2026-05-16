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
import type { Backend, BackendName, PublishOpts } from "./backend.js";

const VERSION = "0.1.0";

interface GlobalOpts {
  to?: string;
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
    process.stderr.write(`error: ${err.message}  [${err.code}]\n`);
    if (err.hint) process.stderr.write(`hint:  ${err.hint}\n`);
    process.exit(exitCodeFor(err.code));
  }
  process.stderr.write(`error: ${(err as Error)?.message ?? String(err)}\n`);
  process.exit(1);
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
    );

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
        process.stdout.write(r.url + "\n");
        if (r.note) process.stderr.write(`note:  ${r.note}\n`);
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
    .action(async (cmdOpts: PublishCmdOpts) => {
      try {
        const { backend, config } = await resolveActiveBackend(program.opts<GlobalOpts>());
        const be = await makeBackend(backend, config, cmdOpts);
        const rows = await be.list();
        if (rows.length === 0) {
          process.stderr.write("(no drops)\n");
          return;
        }
        for (const r of rows) {
          process.stdout.write(`${r.slug}\t${r.updated_at}\t${r.url}\n`);
        }
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
        process.stdout.write(`deleted ${slug}\n`);
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
        process.stdout.write(url + "\n");
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
        for (const line of r.instructions) process.stdout.write(line + "\n");
      } catch (e) {
        die(e);
      }
    });

  await program.parseAsync(process.argv);
}

run().catch(die);
