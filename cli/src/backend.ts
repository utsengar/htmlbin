// The Backend interface. Every destination the CLI can publish to
// implements this. The CLI core never reaches past these four methods
// (plus two optional ones).

export type BackendName = "cloud" | "gh-pages" | "cloudflare";

export interface PublishOpts {
  /** Absolute or relative path to the HTML file to publish. */
  file: string;
  /** Title for the drop (cloud backend only; ignored elsewhere). */
  title?: string;
  /** Description (cloud backend only). */
  description?: string;
  /** PR number, used for gh-pages / cloudflare slug. */
  pr?: number;
  /** Explicit slug override. */
  slug?: string;
}

export interface DropSummary {
  slug: string;
  url: string;
  updated_at: string;
  /** Title — populated by backends that carry it (cloud); undefined elsewhere. */
  title?: string;
}

export interface PublishResult {
  url: string;
  slug: string;
  /** Optional human-readable note (e.g. "rebuild may take ~60s"). */
  note?: string;
}

export interface SetupResult {
  /** Lines of human-readable instructions to print to stdout. */
  instructions: string[];
}

export interface Backend {
  readonly name: BackendName;

  publish(opts: PublishOpts): Promise<PublishResult>;
  list(): Promise<DropSummary[]>;
  delete(slug: string): Promise<void>;
  url(slug: string): Promise<string>;

  // Optional capabilities — backends opt in.
  setup?(): Promise<SetupResult>;
  login?(): Promise<void>;
}
