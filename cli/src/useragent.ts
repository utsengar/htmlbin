// User-Agent string sent on every outbound HTTP call. The shape mirrors
// what other agent-friendly CLIs do (e.g., DataDog/pup): include CLI
// version, runtime, OS / arch, and the detected coding agent (if any) so
// server-side analytics + debug can distinguish traffic shapes.
//
// Example outputs:
//   @htmlbin/cli/0.1.0 (node v22.5.0; darwin arm64)
//   @htmlbin/cli/0.1.0 (node v22.5.0; darwin arm64; agent claude-code)

import { platform, arch } from "node:os";

const CLI_NAME = "@htmlbin/cli";
const CLI_VERSION = "0.1.0";

let agentName: string | null = null;

/** Called once at startup by bin.ts after detecting the runner. */
export function setAgent(name: string | null): void {
  agentName = name;
}

export function userAgent(): string {
  const base = `${CLI_NAME}/${CLI_VERSION} (node ${process.version}; ${platform()} ${arch()})`;
  return agentName ? base.replace(/\)$/, `; agent ${agentName})`) : base;
}
