import { bindings, defineConfig } from "cf/config";

// Secrets (GITHUB_CLIENT_SECRET, TOKEN_PEPPER, SENTRY_DSN) are not in this
// file. D1 migrations live in ./migrations (the `cf d1 migrations` default).

export default defineConfig({
	accountId: "8a9eb8a6efdca98aa450343a55b484cc",
	worker: {
		name: "htmlbin",
		compatibilityDate: "2025-04-01",
		compatibilityFlags: [
			"nodejs_compat",
		],
		entrypoint: "src/index.ts",
		previewUrls: true,
		observability: {
			enabled: true,
		},
		domains: [
			"htmlbin.dev",
			"www.htmlbin.dev",
		],
		env: {
			PUBLIC_URL: bindings.text("https://htmlbin.dev"),
			GITHUB_CLIENT_ID: bindings.text("Ov23li6nAqCYrRIN3WSf"),
			DB: bindings.d1({
				name: "htmlbin-db",
				id: "63632af3-b786-422b-87bd-bf6e13399ec9",
			}),
			DROPS_KV: bindings.kv({
				id: "915440d1cdfb4876bb3b8c721a694873",
			}),
			AI: bindings.ai({}),
		},
	},
});
