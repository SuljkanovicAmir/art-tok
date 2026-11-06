import { describe, it, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { searchMetIds } from "../lib/art-fetchers.mjs";

const originalFetch = globalThis.fetch;

/** Serve `total` sequential IDs the way /v1.1/search does: omit objectIDs past the end. */
function mockMetSearch(total) {
  const seen = [];
  globalThis.fetch = mock.fn(async (url) => {
    const u = new URL(url);
    seen.push(u);
    const limit = Number(u.searchParams.get("limit"));
    const offset = Number(u.searchParams.get("offset"));
    const end = Math.min(offset + limit, total);
    const objectIDs = [];
    for (let id = offset + 1; id <= end; id++) objectIDs.push(id);
    const body = objectIDs.length ? { total, objectIDs } : { total };
    return { ok: true, text: async () => JSON.stringify(body) };
  });
  return seen;
}

describe("searchMetIds", () => {
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("uses the v1.1 endpoint and forwards params", async () => {
    const seen = mockMetSearch(3);
    await searchMetIds({ hasImages: "true", q: "painting" });
    assert.equal(seen[0].pathname, "/public/collection/v1.1/search");
    assert.equal(seen[0].searchParams.get("q"), "painting");
    assert.equal(seen[0].searchParams.get("hasImages"), "true");
  });

  it("walks pages until every ID is collected", async () => {
    const seen = mockMetSearch(864);
    const ids = await searchMetIds({ q: "painting" });
    assert.equal(ids.length, 864);
    assert.deepEqual(seen.map((u) => u.searchParams.get("offset")), ["0", "500"]);
  });

  it("stops without an extra call when results end on a page boundary", async () => {
    const seen = mockMetSearch(500);
    const ids = await searchMetIds({ q: "painting" });
    assert.equal(ids.length, 500);
    assert.equal(seen.length, 1);
  });

  it("returns an empty list when the API omits objectIDs", async () => {
    mockMetSearch(0);
    assert.deepEqual(await searchMetIds({ q: "nothing" }), []);
  });

  it("caps broad searches at four pages", async () => {
    const seen = mockMetSearch(371356);
    const ids = await searchMetIds({ q: "*" });
    assert.equal(seen.length, 4);
    assert.equal(ids.length, 2000);
  });
});
