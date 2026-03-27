import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

// ── Mock helpers ────────────────────────────────────────────────────────────

function makeArt(source, id, title = "Test Art") {
  return {
    id, title, artist: "Test Artist", imageUrl: `https://example.com/${source}/${id}.jpg`,
    source, culture: "Test", dated: "2000", classification: "Painting",
    medium: "Oil", url: `https://example.com/${id}`, museumName: "Test Museum",
  };
}

function make429Error(hostname = "nrs.harvard.edu") {
  const err = new Error(`Image fetch failed: 429 from ${hostname}`);
  err.statusCode = 429;
  return err;
}

function make403Error(hostname = "www.artic.edu") {
  const err = new Error(`Image fetch failed: 403 from ${hostname}`);
  err.statusCode = 403;
  return err;
}

const FAKE_IMAGE_BUFFER = Buffer.from("fake-image-data");

// ── Tests for probeImage ────────────────────────────────────────────────────

describe("probeImage", () => {
  it("test 1: returns buffer on successful fetch", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(() => Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }));

    const { probeImage } = await import("../lib/fetch.mjs?t=1");
    const buf = await probeImage("https://example.com/image.jpg");
    assert.ok(Buffer.isBuffer(buf));

    globalThis.fetch = originalFetch;
  });

  it("test 2: throws with statusCode 429 after retries exhausted", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(() => Promise.resolve({
      ok: false,
      status: 429,
    }));

    const { probeImage } = await import("../lib/fetch.mjs?t=2");
    await assert.rejects(() => probeImage("https://nrs.harvard.edu/img.jpg", 0), (err) => {
      assert.equal(err.statusCode, 429);
      return true;
    });

    globalThis.fetch = originalFetch;
  });

  it("test 3: throws with statusCode 403 after retries exhausted", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(() => Promise.resolve({
      ok: false,
      status: 403,
    }));

    const { probeImage } = await import("../lib/fetch.mjs?t=3");
    await assert.rejects(() => probeImage("https://www.artic.edu/img.jpg", 0), (err) => {
      assert.equal(err.statusCode, 403);
      return true;
    });

    globalThis.fetch = originalFetch;
  });

  it("test 4: retries on 429 then succeeds", async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = mock.fn(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ ok: false, status: 429 });
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });
    });

    const { probeImage } = await import("../lib/fetch.mjs?t=4");
    const buf = await probeImage("https://example.com/image.jpg", 1);
    assert.ok(Buffer.isBuffer(buf));
    assert.equal(callCount, 2);

    globalThis.fetch = originalFetch;
  });

  it("test 5: adds Referer header for AIC URLs", async () => {
    const originalFetch = globalThis.fetch;
    let capturedHeaders = null;
    globalThis.fetch = mock.fn((url, opts) => {
      capturedHeaders = opts?.headers;
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });
    });

    const { probeImage } = await import("../lib/fetch.mjs?t=5");
    await probeImage("https://www.artic.edu/iiif/2/abc/full/843,/0/default.jpg");
    assert.equal(capturedHeaders?.Referer, "https://www.artic.edu/");

    globalThis.fetch = originalFetch;
  });
});

// ── Integration tests: source fallback chain ────────────────────────────────
//
// These test the blacklisting logic extracted from fetchRandomArtwork.
// We replicate the core algorithm (source rotation + probeImage + blacklist)
// with controllable mocks to verify each scenario end-to-end.

/**
 * Mini version of fetchRandomArtwork's core loop, extracted for testability.
 * Takes injectable fetchers and probeImage so we can mock them.
 */
async function fetchWithFallback(sources, historySet, probeFn) {
  const failedImageSources = new Set();

  for (let round = 0; round < 3; round++) {
    const usable = sources.filter((s) => !failedImageSources.has(s.name.toLowerCase()));
    if (usable.length === 0) break;

    for (const source of usable) {
      try {
        const art = await source.fn();
        const key = `${art.source}:${art.id}`;
        if (historySet.has(key)) continue;

        const imageBuffer = await probeFn(art.imageUrl);
        art.imageBuffer = imageBuffer;
        return art;
      } catch (err) {
        if (err.statusCode === 429 || err.statusCode === 403) {
          failedImageSources.add(source.name.toLowerCase());
        }
      }
    }
  }
  throw new Error("All art sources failed or all results were duplicates");
}

describe("source fallback chain (integration)", () => {
  it("test 6: Harvard 429 → falls back to Met", async () => {
    const sources = [
      { name: "Harvard", fn: () => Promise.resolve(makeArt("harvard", 1, "Harvard Art")) },
      { name: "Met", fn: () => Promise.resolve(makeArt("met", 2, "Met Art")) },
    ];
    const probeFn = (url) => {
      if (url.includes("harvard")) throw make429Error();
      return Promise.resolve(FAKE_IMAGE_BUFFER);
    };

    const art = await fetchWithFallback(sources, new Set(), probeFn);
    assert.equal(art.source, "met");
    assert.equal(art.title, "Met Art");
    assert.ok(Buffer.isBuffer(art.imageBuffer));
  });

  it("test 7: Harvard 429 → Met 429 → AIC succeeds", async () => {
    const sources = [
      { name: "Harvard", fn: () => Promise.resolve(makeArt("harvard", 1)) },
      { name: "Met", fn: () => Promise.resolve(makeArt("met", 2)) },
      { name: "AIC", fn: () => Promise.resolve(makeArt("artic", 3, "AIC Art")) },
    ];
    const probeFn = (url) => {
      if (url.includes("harvard") || url.includes("met")) throw make429Error();
      return Promise.resolve(FAKE_IMAGE_BUFFER);
    };

    const art = await fetchWithFallback(sources, new Set(), probeFn);
    assert.equal(art.source, "artic");
    assert.equal(art.title, "AIC Art");
  });

  it("test 8: all 3 sources image 429 → throws", async () => {
    const sources = [
      { name: "Harvard", fn: () => Promise.resolve(makeArt("harvard", 1)) },
      { name: "Met", fn: () => Promise.resolve(makeArt("met", 2)) },
      { name: "AIC", fn: () => Promise.resolve(makeArt("artic", 3)) },
    ];
    const probeFn = () => { throw make429Error(); };

    await assert.rejects(
      () => fetchWithFallback(sources, new Set(), probeFn),
      { message: "All art sources failed or all results were duplicates" },
    );
  });

  it("test 9: AIC 403 → Harvard succeeds", async () => {
    const sources = [
      { name: "AIC", fn: () => Promise.resolve(makeArt("artic", 1)) },
      { name: "Harvard", fn: () => Promise.resolve(makeArt("harvard", 2, "Harvard Art")) },
    ];
    const probeFn = (url) => {
      if (url.includes("artic")) throw make403Error();
      return Promise.resolve(FAKE_IMAGE_BUFFER);
    };

    const art = await fetchWithFallback(sources, new Set(), probeFn);
    assert.equal(art.source, "harvard");
    assert.equal(art.title, "Harvard Art");
  });

  it("test 10: skips duplicate, posts second artwork", async () => {
    let metCall = 0;
    const sources = [
      { name: "Met", fn: () => {
        metCall++;
        // First call returns duplicate, second returns fresh
        return Promise.resolve(makeArt("met", metCall === 1 ? 100 : 200, metCall === 1 ? "Duplicate" : "Fresh"));
      }},
    ];
    const historySet = new Set(["met:100"]);
    const probeFn = () => Promise.resolve(FAKE_IMAGE_BUFFER);

    const art = await fetchWithFallback(sources, historySet, probeFn);
    assert.equal(art.id, 200);
    assert.equal(art.title, "Fresh");
  });
});

// ── Tests for cache helpers ─────────────────────────────────────────────────

describe("cache helpers", () => {
  it("test 11: pickCached returns entry for matching source", async () => {
    const { pickCached } = await import("../lib/cache.mjs?t=11");
    const entries = [
      { source: "harvard", id: 1, title: "A", skip: false },
      { source: "harvard", id: 2, title: "B", skip: false },
      { source: "artic", id: 3, title: "C", skip: false },
    ];
    const result = pickCached(entries, new Set(), "harvard");
    assert.ok(result);
    assert.equal(result.source, "harvard");
  });

  it("test 12: pickCached skips entries with skip:true", async () => {
    const { pickCached } = await import("../lib/cache.mjs?t=12");
    const entries = [
      { source: "harvard", id: 1, skip: true },
      { source: "harvard", id: 2, skip: false },
    ];
    const result = pickCached(entries, new Set(), "harvard");
    assert.equal(result.id, 2);
  });

  it("test 13: pickCached skips already-posted entries", async () => {
    const { pickCached } = await import("../lib/cache.mjs?t=13");
    const entries = [
      { source: "harvard", id: 1, skip: false },
      { source: "harvard", id: 2, skip: false },
    ];
    const result = pickCached(entries, new Set(["harvard:1"]), "harvard");
    assert.equal(result.id, 2);
  });

  it("test 14: pickCached returns null when cache empty for source", async () => {
    const { pickCached } = await import("../lib/cache.mjs?t=14");
    const entries = [
      { source: "artic", id: 1, skip: false },
    ];
    const result = pickCached(entries, new Set(), "harvard");
    assert.equal(result, null);
  });

  it("test 15: excludeEntry marks entry as skip", async () => {
    const { excludeEntry } = await import("../lib/cache.mjs?t=15");
    const entries = [
      { source: "harvard", id: 1, skip: false },
    ];
    const found = excludeEntry(entries, "harvard:1");
    assert.equal(found, true);
    assert.equal(entries[0].skip, true);
  });

  it("test 16: getCacheStats counts correctly", async () => {
    const { getCacheStats } = await import("../lib/cache.mjs?t=16");
    const entries = [
      { source: "harvard", id: 1, skip: false },
      { source: "harvard", id: 2, skip: true },
      { source: "artic", id: 3, skip: false },
    ];
    const stats = getCacheStats(entries, new Set(["harvard:1"]));
    assert.equal(stats.total, 3);
    assert.equal(stats.available, 1);
    assert.equal(stats.skipped, 1);
    assert.equal(stats.posted, 1);
  });
});
