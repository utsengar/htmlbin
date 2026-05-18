// CLI-side error codes. Snake_case to mirror the htmlbin API's `error.code`
// shape (see src/errors.ts in the Worker). The cloud backend surfaces the
// API's code directly; gh-pages and cloudflare add their own codes for
// backend-specific failures (token missing, branch missing, IdP not chosen).
//
// The shared subset with the Worker is everything in `WorkerErrorCode`. CLI
// callers can rely on these strings being stable across both surfaces.

export type WorkerErrorCode =
  | "invalid_json"
  | "invalid_slug"
  | "invalid_arg"
  | "invalid_token_id"
  | "unauthorized"
  | "invalid_token"
  | "forbidden"
  | "not_found"
  | "version_not_found"
  | "title_required"
  | "title_too_long"
  | "description_too_long"
  | "html_required"
  | "html_too_large"
  | "context_too_large"
  | "passcode_required"
  | "passcode_too_short"
  | "token_required"
  | "rate_limited"
  | "daily_quota_exceeded"
  | "quota_exceeded"
  | "version_limit_reached"
  | "last_version_cannot_be_deleted"
  | "metadata_only_on_patch"
  | "server_misconfigured";

export type CliErrorCode =
  | WorkerErrorCode
  | "auth_required"
  | "file_not_found"
  | "file_too_large"
  | "backend_unknown"
  | "backend_setup_required"
  | "github_token_missing"
  | "github_remote_unparseable"
  | "github_branch_missing"
  | "github_pages_collision"
  | "cloudflare_token_missing"
  | "cloudflare_account_missing"
  | "cloudflare_project_missing"
  | "cloudflare_access_not_enabled"
  | "pr_required"
  | "network_error"
  | "unknown";

export class CliError extends Error {
  public readonly code: CliErrorCode;
  public readonly hint?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: CliErrorCode,
    message: string,
    opts?: { hint?: string; details?: Record<string, unknown>; cause?: unknown }
  ) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.hint = opts?.hint;
    this.details = opts?.details;
    if (opts?.cause) (this as { cause?: unknown }).cause = opts.cause;
  }
}

// Map CLI error codes to process exit codes. Stable across releases —
// CI can switch on these.
export function exitCodeFor(code: CliErrorCode): number {
  switch (code) {
    case "unauthorized":
    case "invalid_token":
    case "auth_required":
    case "token_required":
    case "github_token_missing":
    case "cloudflare_token_missing":
      return 2;
    case "forbidden":
      return 3;
    case "not_found":
    case "version_not_found":
    case "file_not_found":
    case "github_branch_missing":
    case "cloudflare_project_missing":
      return 4;
    case "rate_limited":
    case "quota_exceeded":
    case "daily_quota_exceeded":
    case "version_limit_reached":
      return 5;
    case "html_too_large":
    case "file_too_large":
    case "context_too_large":
    case "title_too_long":
    case "description_too_long":
      return 6;
    case "invalid_arg":
    case "invalid_slug":
    case "invalid_json":
    case "html_required":
    case "title_required":
    case "passcode_required":
    case "passcode_too_short":
    case "metadata_only_on_patch":
    case "backend_unknown":
    case "pr_required":
    case "github_remote_unparseable":
    case "github_pages_collision":
    case "cloudflare_account_missing":
    case "backend_setup_required":
    case "cloudflare_access_not_enabled":
      return 7;
    case "network_error":
    case "server_misconfigured":
      return 8;
    default:
      return 1;
  }
}
