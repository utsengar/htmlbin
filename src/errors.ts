// Canonical error response shape for the htmlbin API.
//
// Every 4xx/5xx response goes through `apiError()`. The shape is:
//
//   { "error": { "code": "<machine_readable>", "message": "<human>", "details"?: {...} } }
//
// Codes are stable snake_case identifiers — agents should switch on `code`,
// not on `message`. `details` is reserved for context (limits, fields).

import type { Context } from "hono";

export type ErrorCode =
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
  | "password_required"
  | "password_too_short"
  | "token_required"
  | "rate_limited"
  | "daily_quota_exceeded"
  | "quota_exceeded"
  | "version_limit_reached"
  | "last_version_cannot_be_deleted"
  | "metadata_only_on_patch"
  | "server_misconfigured";

export type HttpStatus =
  | 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 503;

export function apiError(
  c: Context,
  code: ErrorCode,
  message: string,
  status: HttpStatus,
  details?: Record<string, unknown>
): Response {
  const body = details
    ? { error: { code, message, details } }
    : { error: { code, message } };
  return c.json(body, status);
}
