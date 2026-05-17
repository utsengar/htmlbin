// Cloud backend — talks to htmlbin.dev API.

import { basename, extname } from "node:path";
import { CloudApi, type CloudDrop } from "../cloud/api.js";
import { deviceCodeLogin, requireToken } from "../cloud/auth.js";
import { loadHtml } from "../load.js";
import type {
  Backend,
  DropSummary,
  PublishOpts,
  PublishResult,
} from "../backend.js";

const MAX_HTML_BYTES = 2 * 1024 * 1024;

export interface CloudBackendOpts {
  apiUrl?: string;
  token?: string;
  cwd?: string;
}

export function createCloudBackend(opts: CloudBackendOpts = {}): Backend {
  const baseUrl = opts.apiUrl ?? "https://htmlbin.dev";

  let cached: CloudApi | null = null;
  async function api(): Promise<CloudApi> {
    if (cached) return cached;
    const token = opts.token ?? (await requireToken(opts.cwd)).token;
    cached = new CloudApi(baseUrl, token);
    return cached;
  }

  return {
    name: "cloud",

    async publish(po: PublishOpts): Promise<PublishResult> {
      const cwdOpt = opts.cwd === undefined ? {} : { cwd: opts.cwd };
      const loaded = await loadHtml(po.file, { maxBytes: MAX_HTML_BYTES, ...cwdOpt });
      const { filePath, html } = loaded;
      const title = po.title?.trim() || defaultTitle(filePath);
      const body: { html: string; title: string; description?: string } = {
        html,
        title,
      };
      if (po.description) body.description = po.description;
      const drop = await (await api()).publish(body);
      return { url: drop.url, slug: drop.slug };
    },

    async list(): Promise<DropSummary[]> {
      const out: DropSummary[] = [];
      let page = 1;
      const pageSize = 100;
      for (;;) {
        const resp = await (await api()).listDrops({ page, pageSize, sortBy: "updated_at" });
        for (const d of resp.data) out.push(toSummary(d));
        if (page >= resp.pagination.total_pages) break;
        page += 1;
      }
      return out;
    },

    async delete(slug: string): Promise<void> {
      await (await api()).deleteDrop(slug);
    },

    async url(slug: string): Promise<string> {
      const drop = await (await api()).getDrop(slug);
      return drop.url;
    },

    async login(): Promise<void> {
      await deviceCodeLogin({ apiUrl: baseUrl, cwd: opts.cwd, label: "@htmlbin/cli" });
    },
  };
}

function toSummary(d: CloudDrop): DropSummary {
  const out: DropSummary = {
    slug: d.slug,
    url: d.url,
    updated_at: new Date(d.updated_at).toISOString(),
  };
  if (d.title) out.title = d.title;
  return out;
}

function defaultTitle(filePath: string): string {
  const base = basename(filePath, extname(filePath));
  return base || "untitled";
}
