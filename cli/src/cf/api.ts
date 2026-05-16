// Thin Cloudflare API client. Just the slice we need:
//   - Pages projects / deployments
//   - Direct Upload (JWT + missing-blob negotiation + upload)
//   - Access apps + policies

import { request } from "undici";
import { CliError } from "../errors.js";

const BASE = "https://api.cloudflare.com/client/v4";

export interface CfEnvelope<T> {
  success: boolean;
  result: T;
  errors?: Array<{ code: number; message: string }>;
  messages?: Array<{ code: number; message: string }>;
}

export class CloudflareApi {
  constructor(
    private readonly token: string,
    private readonly accountId: string
  ) {}

  // -----------------------------
  // Pages projects + deployments
  // -----------------------------

  async listProjects(): Promise<Array<{ name: string; subdomain: string }>> {
    const env = await this.req<CfEnvelope<Array<{ name: string; subdomain: string }>>>(
      "GET",
      `/accounts/${this.accountId}/pages/projects`
    );
    return env.result;
  }

  async getProject(name: string): Promise<{ name: string; subdomain: string } | null> {
    try {
      const env = await this.req<CfEnvelope<{ name: string; subdomain: string }>>(
        "GET",
        `/accounts/${this.accountId}/pages/projects/${encodeURIComponent(name)}`
      );
      return env.result;
    } catch (e) {
      if (e instanceof CliError && (e.details as { status?: number } | undefined)?.status === 404) return null;
      throw e;
    }
  }

  async createProject(name: string, productionBranch: string = "main"): Promise<{ name: string; subdomain: string }> {
    const env = await this.req<CfEnvelope<{ name: string; subdomain: string }>>(
      "POST",
      `/accounts/${this.accountId}/pages/projects`,
      { name, production_branch: productionBranch }
    );
    return env.result;
  }

  async listDeployments(project: string): Promise<Array<{ id: string; aliases?: string[]; url: string; created_on: string }>> {
    const env = await this.req<CfEnvelope<Array<{ id: string; aliases?: string[]; url: string; created_on: string }>>>(
      "GET",
      `/accounts/${this.accountId}/pages/projects/${encodeURIComponent(project)}/deployments`
    );
    return env.result;
  }

  async deleteDeployment(project: string, deploymentId: string): Promise<void> {
    await this.req<CfEnvelope<unknown>>(
      "DELETE",
      `/accounts/${this.accountId}/pages/projects/${encodeURIComponent(project)}/deployments/${encodeURIComponent(deploymentId)}`
    );
  }

  // -----------------------------
  // Direct Upload — JWT + manifest
  // -----------------------------

  async getUploadJwt(project: string): Promise<string> {
    const env = await this.req<CfEnvelope<{ jwt: string }>>(
      "GET",
      `/accounts/${this.accountId}/pages/projects/${encodeURIComponent(project)}/upload-token`
    );
    return env.result.jwt;
  }

  async checkMissingBlobs(jwt: string, hashes: string[]): Promise<string[]> {
    const env = await this.reqWith<CfEnvelope<string[]>>(
      "POST",
      "/pages/assets/check-missing",
      { hashes },
      { Authorization: `Bearer ${jwt}` }
    );
    return env.result;
  }

  async uploadBlobs(
    jwt: string,
    payload: Array<{ key: string; value: string; metadata: { contentType: string }; base64: boolean }>
  ): Promise<void> {
    await this.reqWith<CfEnvelope<unknown>>(
      "POST",
      "/pages/assets/upload",
      payload,
      { Authorization: `Bearer ${jwt}` }
    );
  }

  async createDeployment(
    project: string,
    manifest: Record<string, string>,
    branch?: string
  ): Promise<{ id: string; url: string; aliases?: string[] }> {
    // The CF API expects multipart/form-data for deployment creation.
    const boundary = "----htmlbin-cli-" + Math.random().toString(36).slice(2);
    const parts: string[] = [];
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="manifest"\r\n\r\n${JSON.stringify(manifest)}\r\n`);
    if (branch) {
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="branch"\r\n\r\n${branch}\r\n`);
    }
    parts.push(`--${boundary}--\r\n`);
    const body = Buffer.from(parts.join(""), "utf8");

    const url = `${BASE}/accounts/${this.accountId}/pages/projects/${encodeURIComponent(project)}/deployments`;
    let res;
    try {
      res = await request(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "user-agent": "@htmlbin/cli",
        },
        body,
      });
    } catch (e) {
      throw new CliError("network_error", `Network error calling ${url}`, { cause: e });
    }
    const text = await res.body.text();
    if (res.statusCode >= 400) {
      throw new CliError("network_error", `Cloudflare deployment create failed (HTTP ${res.statusCode}): ${text.slice(0, 400)}`, {
        details: { status: res.statusCode },
      });
    }
    const env = JSON.parse(text) as CfEnvelope<{ id: string; url: string; aliases?: string[] }>;
    if (!env.success) {
      throw new CliError("network_error", `Cloudflare deployment create returned success=false`, {
        details: { errors: env.errors },
      });
    }
    return env.result;
  }

  // -----------------------------
  // Access — applications + policies
  // -----------------------------

  async listAccessApps(): Promise<Array<{ id: string; name: string; domain: string }>> {
    const env = await this.req<CfEnvelope<Array<{ id: string; name: string; domain: string }>>>(
      "GET",
      `/accounts/${this.accountId}/access/apps`
    );
    return env.result;
  }

  async createAccessApp(domain: string, name: string): Promise<{ id: string; name: string; domain: string }> {
    const env = await this.req<CfEnvelope<{ id: string; name: string; domain: string }>>(
      "POST",
      `/accounts/${this.accountId}/access/apps`,
      { name, domain, type: "self_hosted", session_duration: "24h" }
    );
    return env.result;
  }

  async createAccessPolicy(
    appId: string,
    policy: { name: string; decision: "allow" | "deny"; include: Array<Record<string, unknown>> }
  ): Promise<{ id: string }> {
    const env = await this.req<CfEnvelope<{ id: string }>>(
      "POST",
      `/accounts/${this.accountId}/access/apps/${appId}/policies`,
      policy
    );
    return env.result;
  }

  // -----------------------------
  // Account-level probe (used by setup to detect Access availability)
  // -----------------------------

  async getAccessIdentityProviders(): Promise<Array<{ id: string; name: string; type: string }>> {
    const env = await this.req<CfEnvelope<Array<{ id: string; name: string; type: string }>>>(
      "GET",
      `/accounts/${this.accountId}/access/identity_providers`
    );
    return env.result;
  }

  // -----------------------------
  // Low-level
  // -----------------------------

  private req<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.reqWith<T>(method, path, body, {});
  }

  private async reqWith<T>(
    method: string,
    path: string,
    body: unknown,
    extraHeaders: Record<string, string>
  ): Promise<T> {
    const url = path.startsWith("http") ? path : BASE + path;
    let res;
    try {
      res = await request(url, {
        method: method as "GET" | "POST" | "DELETE",
        headers: {
          ...(extraHeaders.Authorization ? {} : { authorization: `Bearer ${this.token}` }),
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
          "user-agent": "@htmlbin/cli",
          ...extraHeaders,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new CliError("network_error", `Network error calling ${url}`, { cause: e });
    }
    const text = await res.body.text();
    let parsed: unknown;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new CliError("network_error", `Non-JSON response from ${url} (HTTP ${res.statusCode})`, {
          details: { body: text.slice(0, 400) },
        });
      }
    }
    if (res.statusCode >= 400) {
      const env = parsed as CfEnvelope<unknown> | undefined;
      const errMsg = env?.errors?.[0]?.message ?? `HTTP ${res.statusCode}`;
      throw new CliError("network_error", errMsg, {
        details: { status: res.statusCode, errors: env?.errors },
      });
    }
    return parsed as T;
  }
}
