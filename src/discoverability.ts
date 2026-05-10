// Agent-ready discoverability layer.
//
// Inspired by the criteria at https://isitagentready.com:
//   - /robots.txt with explicit AI-bot allowances and sitemap pointer
//   - /sitemap.xml listing public URLs
//   - /llms.txt — the de-facto agent-friendly site index (plain text)
//   - /.well-known/agent-card.json — compact capability descriptor
//   - /openapi.json — OpenAPI 3.1 spec for the public API
//   - HTTP `Link:` headers on the landing page advertising the above
//   - JSON-LD Service schema on the landing page (added inline in landing.ts)
//
// Everything here is content-negotiation friendly: `Accept: text/plain`,
// `Accept: text/markdown`, `Accept: application/json` all do reasonable
// things on the agent-aimed endpoints.

export function robotsTxt(publicUrl: string): string {
  return `# htmlbin is built for agents. All AI crawlers are welcome.
# See ${publicUrl}/llms.txt for the agent-friendly site index.

User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Bytespider
Allow: /

User-agent: Meta-ExternalAgent
Allow: /

User-agent: cohere-ai
Allow: /

# Don't crawl signed or auth-only paths
Disallow: /api/auth/
Disallow: /verify

Sitemap: ${publicUrl}/sitemap.xml
`;
}

// llms.txt — see https://llmstxt.org. Plain text, top-level, agent-aimed.
export function llmsTxt(publicUrl: string): string {
  const host = stripScheme(publicUrl);
  return `# htmlbin

> Agent-first HTML hosting. Drop self-contained HTML, get a public URL.
> Built for the HTML-as-output-format era. The whole product is reachable
> via a single API; no signup, no dashboard.

A drop is one HTML artifact published at ${host}/p/<id>. Each drop has
versions; the URL never changes when you iterate.

## Quick start (for agents)

If you are an agent landing on this page, fetch this URL — it returns a
markdown protocol you can follow end-to-end:

  ${publicUrl}/api/onboard

It walks you through a 4-step flow: device-code auth → one-time human
anti-bot click → token (one-time read) → POST your HTML.

## Endpoints

- ${publicUrl}/                              — landing (memo addressed to agents)
- ${publicUrl}/index.md                      — landing rendered as markdown (also served when Accept: text/markdown)
- ${publicUrl}/api/onboard                   — agent onboarding (markdown)
- ${publicUrl}/openapi.json                  — full OpenAPI 3.1 spec
- ${publicUrl}/.well-known/agent-card.json   — compact capability descriptor
- ${publicUrl}/.well-known/agent-skills/index.json  — Agent Skills Discovery (RFC v0.2.0) index
- ${publicUrl}/.well-known/api-catalog       — API catalog (RFC 9727, linkset+json)
- ${publicUrl}/sitemap.xml                   — sitemap

## API surface

### auth
- POST /api/auth/start         → { code, verification_url, poll_token }
- GET  /api/auth/poll?token=…  → { status, api_token? }       (one-time read)

### drops (auth: Bearer hb_…)
- POST   /api/drops                  → upload HTML (creates v1)
- GET    /api/drops                  → list yours
- GET    /api/drops/:slug            → metadata
- PUT    /api/drops/:slug            → mints a new version
- GET    /api/drops/:slug/versions   → list versions
- GET    /api/drops/:slug/v/:n       → version metadata + context
- DELETE /api/drops/:slug            → delete (all versions)
- POST   /api/drops/:slug/password   → set/change/remove password
- GET    /api/tokens                      → list your active tokens
- DELETE /api/tokens/:id                  → revoke a token (id = first 12 hex)

### viewer
- GET /p/:slug          → public viewer (latest version)
- GET /p/:slug?v=N      → pinned to version N
- GET /p/:slug/raw      → raw HTML, edge-cached
- GET /p/:slug/raw?v=N  → raw HTML for a specific version

## Limits

- 2 MB per HTML
- 60 writes / minute / token
- 500 drops per account
- 10-minute TTL on verification codes

## Errors

All errors are JSON: { "error": "<code>" } with appropriate HTTP status.
Common codes: unauthorized, invalid_token, rate_limited, html_too_large,
forbidden, not_found, expired_code, password_too_short.

## Source

Open source. Edge-hosted. Hosting platform is an implementation detail —
the format and protocol are the long-term play.

`;
}

export function sitemapXml(publicUrl: string): string {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${publicUrl}/`, priority: "1.0" },
    { loc: `${publicUrl}/api/onboard`, priority: "0.9" },
    { loc: `${publicUrl}/llms.txt`, priority: "0.6" },
    { loc: `${publicUrl}/openapi.json`, priority: "0.6" },
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
}

// Compact agent-capability card. Self-describing JSON intended for any
// agent that lands on / and follows the well-known link.
export function agentCard(publicUrl: string): object {
  return {
    schema_version: "1.0",
    name: "htmlbin",
    description:
      "Agent-first HTML hosting. Drop self-contained HTML, get a public URL.",
    home: publicUrl,
    contact: `${publicUrl}/`,
    onboarding: {
      url: `${publicUrl}/api/onboard`,
      content_types: ["text/markdown", "application/json"],
      summary:
        "Single endpoint that returns the full agent protocol as markdown.",
    },
    auth: {
      type: "device_code",
      start: `${publicUrl}/api/auth/start`,
      poll: `${publicUrl}/api/auth/poll`,
      verify_human_at: `${publicUrl}/verify`,
      token_format: "Bearer hb_<base62>",
      token_lifetime: "non-expiring (revocable)",
    },
    capabilities: [
      {
        id: "publish_html",
        description:
          "Upload self-contained HTML up to 2 MB; receive a permanent public URL. Creates v1.",
        method: "POST",
        path: "/api/drops",
        accepts: ["title", "description?", "html", "password?", "context?"],
      },
      {
        id: "update_html",
        description:
          "PUT mints a NEW version on the same slug — URL is preserved across iterations.",
        method: "PUT",
        path: "/api/drops/:slug",
        accepts: ["html?", "title?", "description?", "context?"],
      },
      {
        id: "list_versions",
        method: "GET",
        path: "/api/drops/:slug/versions",
      },
      {
        id: "get_version",
        description: "Includes the optional context recorded at that version.",
        method: "GET",
        path: "/api/drops/:slug/v/:n",
      },
      {
        id: "delete_drop",
        method: "DELETE",
        path: "/api/drops/:slug",
      },
      {
        id: "delete_version",
        description:
          "Delete a single version. Refused for the last remaining version; if the deleted version was the head, latest_version is recomputed.",
        method: "DELETE",
        path: "/api/drops/:slug/v/:n",
      },
      {
        id: "list_my_drops",
        method: "GET",
        path: "/api/drops",
      },
      {
        id: "lock_with_password",
        description:
          "Set, change, or remove a password gate. Pass empty string to remove.",
        method: "POST",
        path: "/api/drops/:slug/password",
      },
      {
        id: "list_my_tokens",
        description:
          "List active tokens for this user across machines (read-only, no plaintext).",
        method: "GET",
        path: "/api/tokens",
      },
      {
        id: "revoke_token",
        description:
          "Revoke a specific token by its short id (first 12 hex chars of the hash).",
        method: "DELETE",
        path: "/api/tokens/:id",
      },
    ],
    versioning: {
      semantics:
        "Every PUT with a new html body increments the version. Slug + URL stay stable.",
      view_specific_version: "/p/<slug>?v=<n>",
      raw_specific_version: "/p/<slug>/raw?v=<n>",
    },
    cross_machine_auth: {
      method: "Run /api/auth/start on a new machine, then paste your existing token at /verify.",
      result: "Both devices share the same user_id with separate tokens.",
    },
    limits: {
      max_html_bytes: 2_097_152,
      max_context_bytes: 65_536,
      max_versions_per_drop: 200,
      writes_per_minute: 60,
      writes_per_day: 500,
      drops_per_account: 500,
      verification_ttl_seconds: 600,
    },
    spec: {
      openapi: `${publicUrl}/openapi.json`,
      llms_txt: `${publicUrl}/llms.txt`,
      agent_skills_index: `${publicUrl}/.well-known/agent-skills/index.json`,
      api_catalog: `${publicUrl}/.well-known/api-catalog`,
    },
    license: "MIT",
  };
}

// OpenAPI 3.1 spec — small, intentionally narrow.
export function openApiSpec(publicUrl: string): object {
  return {
    openapi: "3.1.0",
    info: {
      title: "htmlbin API",
      version: "1.0.0",
      summary:
        "Agent-first HTML hosting. Drop self-contained HTML, get a public URL.",
      description:
        "All endpoints under /api/. Auth uses a Bearer token minted via the /api/auth/start device-code flow.",
      contact: { url: publicUrl },
      license: { name: "MIT" },
    },
    servers: [{ url: publicUrl }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "hb_<base62>",
        },
      },
      schemas: {
        Drop: {
          type: "object",
          required: ["slug", "title", "url", "raw_url", "created_at"],
          properties: {
            slug: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            url: { type: "string", format: "uri" },
            raw_url: { type: "string", format: "uri" },
            locked: { type: "boolean" },
            latest_version: { type: "integer" },
            view_count: { type: "integer" },
            created_at: { type: "integer", description: "unix ms" },
            updated_at: { type: "integer", description: "unix ms" },
          },
        },
        VersionListItem: {
          type: "object",
          required: ["version", "size_bytes", "created_at"],
          properties: {
            version: { type: "integer" },
            size_bytes: { type: "integer" },
            has_context: { type: "boolean" },
            created_at: { type: "integer" },
          },
        },
        Version: {
          type: "object",
          required: ["slug", "version", "size_bytes", "created_at"],
          properties: {
            slug: { type: "string" },
            version: { type: "integer" },
            size_bytes: { type: "integer" },
            context: {
              type: "string",
              nullable: true,
              description: "Optional reasoning trace recorded at this version",
            },
            created_at: { type: "integer" },
            is_latest: { type: "boolean" },
          },
        },
        Error: {
          type: "object",
          required: ["error"],
          properties: { error: { type: "string" } },
        },
      },
    },
    paths: {
      "/api/onboard": {
        get: {
          summary: "Agent onboarding instructions",
          description:
            "Returns the full agent protocol. Markdown by default; pass Accept: application/json for JSON wrapper.",
          responses: {
            "200": {
              description: "Onboarding text",
              content: {
                "text/markdown": { schema: { type: "string" } },
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      instructions: { type: "string" },
                      public_url: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/start": {
        post: {
          summary: "Begin device-code flow",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { label: { type: "string" } },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Code + poll token",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      code: { type: "string" },
                      verification_url: { type: "string", format: "uri" },
                      poll_token: { type: "string" },
                      expires_in: { type: "integer" },
                      poll_interval: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/poll": {
        get: {
          summary: "Poll for verified token",
          parameters: [
            {
              name: "token",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Status (and api_token if verified, exactly once)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: {
                        type: "string",
                        enum: ["pending", "verified", "claimed", "expired"],
                      },
                      api_token: { type: "string" },
                      user_id: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/drops": {
        get: {
          summary: "List your drops",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Array of drops",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Drop" },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: "Upload a new drop",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "html"],
                  properties: {
                    title: { type: "string", maxLength: 200 },
                    description: { type: "string", maxLength: 500 },
                    html: { type: "string" },
                    password: { type: "string", minLength: 4 },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Drop" },
                },
              },
            },
            "400": {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/api/drops/{slug}": {
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          summary: "Get metadata for one of your drops",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Drop metadata",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Drop" },
                },
              },
            },
          },
        },
        put: {
          summary: "Update drop (slug stays the same)",
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    html: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          summary: "Delete drop",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/drops/{slug}/password": {
        post: {
          summary: "Set, change, or remove the password on a drop",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["password"],
                  properties: {
                    password: {
                      type: "string",
                      description: "Empty string to remove",
                    },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Updated" } },
        },
      },
      "/p/{slug}": {
        get: {
          summary: "Public viewer (HTML)",
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Viewer page" },
            "404": { description: "Not found" },
          },
        },
      },
      "/p/{slug}/raw": {
        get: {
          summary: "Raw HTML, edge-cached",
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "The drop, served as text/html",
              content: { "text/html": { schema: { type: "string" } } },
            },
          },
        },
      },
    },
  };
}

// Build the discoverability `Link:` header value advertised on /.
export function linkHeader(publicUrl: string): string {
  const host = publicUrl.replace(/\/$/, "");
  return [
    `<${host}/index.md>; rel="alternate"; type="text/markdown"; title="this page as markdown"`,
    `<${host}/api/onboard>; rel="describedby"; type="text/markdown"; title="agent onboarding"`,
    `<${host}/openapi.json>; rel="service-desc"; type="application/openapi+json"`,
    `<${host}/.well-known/agent-card.json>; rel="https://agentprotocol.org/agent-card"; type="application/json"`,
    `<${host}/.well-known/agent-skills/index.json>; rel="https://agentskills.io/discovery"; type="application/json"; title="Agent Skills Discovery"`,
    `<${host}/.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"`,
    `<${host}/llms.txt>; rel="alternate"; type="text/plain"; title="llms.txt"`,
    `<${host}/sitemap.xml>; rel="sitemap"; type="application/xml"`,
  ].join(", ");
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "");
}
