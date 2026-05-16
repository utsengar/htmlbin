// Cloudflare setup walkthrough.
//
// Does as much as possible programmatically:
//   - Ensures the Pages project exists (creates it if not).
//   - Probes for available Access identity providers.
//   - If --idp / --email-domain / --email flags are passed, provisions the
//     Access app + a single "allow" policy.
//   - Otherwise prints the available IdPs and instructs the user to re-run
//     with the flags they want, or finish provisioning in the UI.

import { CliError } from "../errors.js";
import type { SetupResult } from "../backend.js";
import { CloudflareApi } from "./api.js";
import { provisionAccessApp } from "./access.js";

export interface CfSetupOpts {
  project: string;
  productionBranch?: string;
  idp?: string[];
  emailDomain?: string[];
  email?: string[];
}

export async function setupCloudflare(api: CloudflareApi, opts: CfSetupOpts): Promise<SetupResult> {
  const instructions: string[] = [];

  // 1. Ensure the project exists.
  let project = await api.getProject(opts.project);
  if (!project) {
    project = await api.createProject(opts.project, opts.productionBranch ?? "main");
    instructions.push(`Created Cloudflare Pages project \`${opts.project}\` (subdomain: ${project.subdomain}).`);
  } else {
    instructions.push(`Pages project \`${opts.project}\` already exists (subdomain: ${project.subdomain}).`);
  }

  // 2. Probe Access.
  let idps: Array<{ id: string; name: string; type: string }> = [];
  try {
    idps = await api.getAccessIdentityProviders();
  } catch (e) {
    throw new CliError(
      "cloudflare_access_not_enabled",
      "Could not list Access identity providers — Cloudflare Access (Zero Trust) may not be enabled on this account.",
      {
        hint:
          "Enable Zero Trust at https://one.dash.cloudflare.com/ (free tier counts), then re-run setup.",
        cause: e,
      }
    );
  }

  // 3. If the user passed include rules, provision the Access app.
  const hasIncludeFlags =
    (opts.idp && opts.idp.length > 0) ||
    (opts.emailDomain && opts.emailDomain.length > 0) ||
    (opts.email && opts.email.length > 0);

  if (hasIncludeFlags) {
    const result = await provisionAccessApp(api, {
      project: opts.project,
      subdomain: project.subdomain,
      idpIds: opts.idp,
      emailDomains: opts.emailDomain,
      emails: opts.email,
    });
    instructions.push(
      result.created
        ? `Created Access app for \`${result.domain}\` with a default "allow" policy (policyId ${result.policyId}).`
        : `Access app already exists for \`${result.domain}\` (appId ${result.appId}). Leaving it untouched.`
    );
  } else {
    instructions.push("");
    instructions.push("Access identity providers available on this account:");
    if (idps.length === 0) {
      instructions.push("  (none configured — add one at https://one.dash.cloudflare.com/ → Settings → Authentication)");
    } else {
      for (const i of idps) {
        instructions.push(`  • ${i.name}  (id=${i.id}, type=${i.type})`);
      }
    }
    instructions.push("");
    instructions.push("Re-run setup with one of:");
    instructions.push(`  htmlbin setup --to cloudflare --project ${opts.project} --idp <id>`);
    instructions.push(`  htmlbin setup --to cloudflare --project ${opts.project} --email-domain example.com`);
    instructions.push(`  htmlbin setup --to cloudflare --project ${opts.project} --email alice@example.com`);
    instructions.push("");
    instructions.push("Or skip auth provisioning and configure the Access app in the UI:");
    instructions.push(`  https://one.dash.cloudflare.com/?account=${opts.project}#/access`);
  }

  instructions.push("");
  instructions.push(`Once Access is configured, publish with:`);
  instructions.push(`  htmlbin publish ./out.html --to cloudflare --project ${opts.project} --pr <n>`);
  instructions.push(`URL pattern: https://pr-<n>.${project.subdomain}`);

  return { instructions };
}
