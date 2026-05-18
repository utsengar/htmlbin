// Cloud-backend tests via an injected token + a local undici Mock Agent
// against api.htmlbin.dev. Verifies the happy path for publish/list/delete
// and the error-code surfacing path.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from "undici";
import { createCloudBackend } from "../src/backends/cloud.js";
import { CliError } from "../src/errors.js";

const BASE = "https://htmlbin.dev";

let mockAgent: MockAgent;
let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  await mockAgent.close();
  setGlobalDispatcher(originalDispatcher);
});

async function makeFixtureHtml(contents = "<!doctype html><title>hello</title>"): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "htmlbin-cli-cloud-"));
  const file = join(dir, "hello.html");
  await writeFile(file, contents, "utf8");
  return file;
}

describe("cloud backend", () => {
  it("publish: POSTs /api/drops and prints the returned URL", async () => {
    const pool = mockAgent.get(BASE);
    pool
      .intercept({ path: "/api/drops", method: "POST" })
      .reply(201, {
        slug: "abc1234",
        title: "hello",
        description: null,
        url: `${BASE}/p/abc1234`,
        raw_url: `${BASE}/p/abc1234/raw`,
        locked: false,
        latest_version: 1,
        view_count: 0,
        created_at: 0,
        updated_at: 0,
      })
      .persist();

    const be = createCloudBackend({ token: "hb_test_abcdefghijklmnop" });
    const filePath = await makeFixtureHtml();
    const r = await be.publish({ file: filePath });
    expect(r.url).toBe(`${BASE}/p/abc1234`);
    expect(r.slug).toBe("abc1234");
  });

  it("publish: surfaces the API's error.code as the CliError code", async () => {
    const pool = mockAgent.get(BASE);
    pool
      .intercept({ path: "/api/drops", method: "POST" })
      .reply(413, {
        error: {
          code: "html_too_large",
          message: "HTML exceeds 2097152 bytes.",
          details: { max_bytes: 2097152 },
        },
      });

    const be = createCloudBackend({ token: "hb_test_abcdefghijklmnop" });
    const filePath = await makeFixtureHtml();
    try {
      await be.publish({ file: filePath });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).code).toBe("html_too_large");
    }
  });

  it("publish: file_not_found when path is missing", async () => {
    const be = createCloudBackend({ token: "hb_test_abcdefghijklmnop" });
    try {
      await be.publish({ file: "/tmp/does-not-exist-htmlbin-test.html" });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).code).toBe("file_not_found");
    }
  });

  it("list: paginates", async () => {
    const pool = mockAgent.get(BASE);
    pool
      .intercept({ path: /\/api\/drops\?.*page=1.*/, method: "GET" })
      .reply(200, {
        data: [
          {
            slug: "aaa1111",
            title: "a",
            url: `${BASE}/p/aaa1111`,
            raw_url: `${BASE}/p/aaa1111/raw`,
            locked: false,
            latest_version: 1,
            view_count: 0,
            created_at: 0,
            updated_at: 1700000000000,
          },
        ],
        pagination: { page: 1, page_size: 100, total_items: 2, total_pages: 2, sort_by: "updated_at", sort_order: "desc" },
      });
    pool
      .intercept({ path: /\/api\/drops\?.*page=2.*/, method: "GET" })
      .reply(200, {
        data: [
          {
            slug: "bbb2222",
            title: "b",
            url: `${BASE}/p/bbb2222`,
            raw_url: `${BASE}/p/bbb2222/raw`,
            locked: false,
            latest_version: 1,
            view_count: 0,
            created_at: 0,
            updated_at: 1700000001000,
          },
        ],
        pagination: { page: 2, page_size: 100, total_items: 2, total_pages: 2, sort_by: "updated_at", sort_order: "desc" },
      });

    const be = createCloudBackend({ token: "hb_test_abcdefghijklmnop" });
    const rows = await be.list();
    expect(rows.map((r) => r.slug)).toEqual(["aaa1111", "bbb2222"]);
  });

  it("delete: DELETEs /api/drops/:slug", async () => {
    const pool = mockAgent.get(BASE);
    pool
      .intercept({ path: "/api/drops/abc1234", method: "DELETE" })
      .reply(204, "");

    const be = createCloudBackend({ token: "hb_test_abcdefghijklmnop" });
    await be.delete("abc1234");
  });
});
