import { test } from "node:test";
import assert from "node:assert/strict";
import { getAvailable, pickCached, pickThemedSet } from "../lib/cache.mjs";

const entry = (id, over = {}) => ({
  source: "harvard", id, title: `T${id}`, artist: `A${id}`,
  culture: "Dutch", aspect: 0.85, skip: false, tags: [], ...over,
});

// ── getAvailable minScore ─────────────────────────────────────────────────────

test("getAvailable without minScore returns all non-skipped/non-posted", () => {
  const entries = [entry(1, { aiScore: 3 }), entry(2, { aiScore: 9 }), entry(3)];
  assert.equal(getAvailable(entries, new Set(), "harvard").length, 3);
});

test("getAvailable with minScore excludes low scorers", () => {
  const entries = [entry(1, { aiScore: 3 }), entry(2, { aiScore: 9 }), entry(3, { aiScore: 6 })];
  const avail = getAvailable(entries, new Set(), "harvard", { minScore: 6 });
  assert.deepEqual(avail.map((e) => e.id).sort(), [2, 3]);
});

test("getAvailable with minScore keeps UNSCORED entries eligible", () => {
  const entries = [entry(1, { aiScore: 2 }), entry(2)]; // entry(2) has no aiScore
  const avail = getAvailable(entries, new Set(), "harvard", { minScore: 6 });
  assert.deepEqual(avail.map((e) => e.id), [2]);
});

// ── pickCached minScore ───────────────────────────────────────────────────────

test("pickCached respects minScore", () => {
  const entries = [entry(1, { aiScore: 2 }), entry(2, { aiScore: 8 })];
  for (let i = 0; i < 20; i++) {
    const picked = pickCached(entries, new Set(), "harvard", null, { minScore: 6 });
    assert.equal(picked.id, 2);
  }
});

test("pickCached returns null when all entries are below minScore", () => {
  const entries = [entry(1, { aiScore: 2 }), entry(2, { aiScore: 3 })];
  assert.equal(pickCached(entries, new Set(), "harvard", null, { minScore: 6 }), null);
});

// ── pickThemedSet minScore ────────────────────────────────────────────────────

test("pickThemedSet excludes low scorers but keeps unscored", () => {
  const entries = [
    entry(1, { aiScore: 2 }), entry(2, { aiScore: 8 }),
    entry(3), entry(4, { aiScore: 9 }),
  ];
  const set = pickThemedSet(entries, new Set(), { size: 4, minScore: 6, rng: () => 0 });
  assert.ok(set.every((e) => e.aiScore == null || e.aiScore >= 6));
  assert.ok(!set.some((e) => e.id === 1));
});
