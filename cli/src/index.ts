// Public library entry — re-exports the bits a third party might want when
// embedding the CLI core in another tool (e.g., a custom GitHub Action that
// publishes via the cloud backend without spawning the binary).

export { createCloudBackend } from "./backends/cloud.js";
export { createGhPagesBackend } from "./backends/gh-pages.js";
export { createCloudflareBackend } from "./backends/cloudflare.js";
export type {
  Backend,
  BackendName,
  PublishOpts,
  PublishResult,
  DropSummary,
  SetupResult,
} from "./backend.js";
export { CliError, exitCodeFor } from "./errors.js";
export type { CliErrorCode, WorkerErrorCode } from "./errors.js";
export { resolveBackend, loadConfigFile } from "./config.js";
