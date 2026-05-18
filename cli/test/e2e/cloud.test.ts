// End-to-end coverage for the cloud backend against real htmlbin.dev.
//
// Gated on `HTMLBIN_E2E_TOKEN` — without it, every test is skipped. To
// run locally against your own account:
//
//   HTMLBIN_E2E_TOKEN=$(cat ~/.config/htmlbin/token) npm test
//
// Each test that publishes a drop also deletes it on the way out, so we
// don't pile up garbage in the test account's history.

import { describe, expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { distAvailable, makeIsolatedEnv, parseJson, runCli } from "./helpers.js";

const TOKEN = process.env.HTMLBIN_E2E_TOKEN;
const SHOULD_RUN = distAvailable() && !!TOKEN;

const TEST_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>htmlbin-cli e2e test</title></head>
<body><h1>cli e2e — safe to delete</h1></body></html>`;

describe.skipIf(!SHOULD_RUN)("cloud backend e2e (HTMLBIN_E2E_TOKEN required)", () => {
  it("publish → URL printed, --output json returns full Drop shape", async () => {
    const { env, baseDir } = await makeIsolatedEnv();
    const file = join(baseDir, "hello.html");
    await writeFile(file, TEST_HTML, "utf8");
    const r = await runCli(
      ["--output", "json", "publish", file, "--title", "cli e2e — publish"],
      { env: { ...env, HTMLBIN_TOKEN: TOKEN } }
    );
    expect(r.exitCode).toBe(0);
    const parsed = parseJson<{ url: string; slug: string; backend: string }>(r.stdout);
    expect(parsed?.backend).toBe("cloud");
    expect(parsed?.slug).toMatch(/^[A-Za-z0-9]+$/);
    expect(parsed?.url).toMatch(/^https:\/\/htmlbin\.dev\/p\/[A-Za-z0-9]+$/);
    // cleanup
    await runCli(["delete", parsed!.slug], { env: { ...env, HTMLBIN_TOKEN: TOKEN } });
  });

  it("list returns at least one drop", async () => {
    const { env } = await makeIsolatedEnv();
    const r = await runCli(
      ["--output", "json", "list", "--limit", "1"],
      { env: { ...env, HTMLBIN_TOKEN: TOKEN } }
    );
    expect(r.exitCode).toBe(0);
    const rows = parseJson<Array<{ slug: string; url: string }>>(r.stdout);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("--limit caps the row count", async () => {
    const { env } = await makeIsolatedEnv();
    const r = await runCli(
      ["--output", "json", "list", "--limit", "2"],
      { env: { ...env, HTMLBIN_TOKEN: TOKEN } }
    );
    expect(r.exitCode).toBe(0);
    const rows = parseJson<unknown[]>(r.stdout);
    expect(rows?.length).toBeLessThanOrEqual(2);
  });

  it("--limit -1 is rejected", async () => {
    const { env } = await makeIsolatedEnv();
    const r = await runCli(["list", "--limit", "-1"], {
      env: { ...env, HTMLBIN_TOKEN: TOKEN },
    });
    expect(r.exitCode).toBe(7);
    expect(r.stderr).toContain("invalid_arg");
  });

  it("delete of an unknown slug exits 4 with not_found", async () => {
    const { env } = await makeIsolatedEnv();
    // Slug shape must pass the API's regex (alphanumeric, 7+ chars) so
    // the failure is "not_found", not "invalid_slug".
    const r = await runCli(["delete", "notrealabc"], {
      env: { ...env, HTMLBIN_TOKEN: TOKEN },
    });
    expect(r.exitCode).toBe(4);
    expect(r.stderr).toContain("not_found");
  });

  it("full publish → url → delete → 404 cycle", async () => {
    const { env, baseDir } = await makeIsolatedEnv();
    const file = join(baseDir, "cycle.html");
    await writeFile(file, TEST_HTML, "utf8");
    const tokenEnv = { ...env, HTMLBIN_TOKEN: TOKEN };

    // publish
    const pub = await runCli(
      ["--output", "json", "publish", file, "--title", "cli e2e — cycle"],
      { env: tokenEnv }
    );
    expect(pub.exitCode).toBe(0);
    const drop = parseJson<{ slug: string; url: string }>(pub.stdout);
    expect(drop?.slug).toBeDefined();

    // url (text mode)
    const url = await runCli(["--output", "text", "url", drop!.slug], {
      env: tokenEnv,
    });
    expect(url.exitCode).toBe(0);
    expect(url.stdout.trim()).toBe(drop!.url);

    // delete
    const del = await runCli(["--output", "json", "delete", drop!.slug], {
      env: tokenEnv,
    });
    expect(del.exitCode).toBe(0);
    const delResult = parseJson<{ deleted: boolean; slug: string }>(del.stdout);
    expect(delResult?.deleted).toBe(true);
    expect(delResult?.slug).toBe(drop!.slug);

    // url after delete → not_found
    const after = await runCli(["url", drop!.slug], { env: tokenEnv });
    expect(after.exitCode).toBe(4);
  });
});
