// Cloudflare Access provisioning for the Pages project.
//
// Creates a self-hosted Access application covering the project's
// preview/production hostnames and attaches a single "allow" policy that
// uses the chosen identity provider(s). Idempotent: if an app already
// covers the domain, leave it alone and report it.

import type { CloudflareApi } from "./api.js";

export interface AccessProvisionOpts {
  /** Pages project name. */
  project: string;
  /** Pages subdomain (e.g. `<project>.pages.dev`); passed in from project info. */
  subdomain: string;
  /** IdP ids to allow. If empty, the policy uses email-domain include rules. */
  idpIds?: string[];
  /** Email domains to allow (e.g. ["example.com"]). */
  emailDomains?: string[];
  /** Specific email addresses to allow. */
  emails?: string[];
}

export interface AccessProvisionResult {
  appId: string;
  domain: string;
  policyId?: string;
  created: boolean;
}

export async function provisionAccessApp(
  api: CloudflareApi,
  opts: AccessProvisionOpts
): Promise<AccessProvisionResult> {
  const domain = `*.${opts.subdomain}`;
  const existing = await api.listAccessApps();
  const match = existing.find((a) => a.domain === domain);
  if (match) {
    return { appId: match.id, domain: match.domain, created: false };
  }

  const app = await api.createAccessApp(domain, `htmlbin · ${opts.project}`);
  const include: Array<Record<string, unknown>> = [];

  if (opts.idpIds && opts.idpIds.length > 0) {
    for (const id of opts.idpIds) include.push({ login_method: { id } });
  }
  if (opts.emailDomains && opts.emailDomains.length > 0) {
    for (const d of opts.emailDomains) include.push({ email_domain: { domain: d } });
  }
  if (opts.emails && opts.emails.length > 0) {
    for (const e of opts.emails) include.push({ email: { email: e } });
  }
  if (include.length === 0) {
    include.push({ everyone: {} }); // safe default, easy to tighten later in UI
  }

  const policy = await api.createAccessPolicy(app.id, {
    name: "htmlbin default",
    decision: "allow",
    include,
  });

  return { appId: app.id, domain: app.domain, policyId: policy.id, created: true };
}
