import { test } from "node:test";
import assert from "node:assert/strict";
import { pickThemedSet } from "../lib/cache.mjs";

const entry = (id, over = {}) => ({
  source: "harvard", id, title: `T${id}`, artist: `A${id}`,
  culture: "Dutch", aspect: 0.85, skip: false, tags: [], ...over,
});

test("picks 4 same-orientation entries sharing a culture", () => {
  const entries = [1, 2, 3, 4, 5].map((i) => entry(i));
  const set = pickThemedSet(entries, new Set(), { size: 4, rng: () => 0 });
  assert.equal(set.length, 4);
  assert.ok(set.every((e) => e.culture === "Dutch"));
});

test("never mixes portrait and landscape orientations", () => {
  const entries = [entry(1), entry(2), entry(3, { aspect: 1.5 }), entry(4), entry(5)];
  const set = pickThemedSet(entries, new Set(), { size: 4, rng: () => 0 });
  assert.ok(set.every((e) => e.aspect < 1.0));
});

test("returns null when no theme has enough members", () => {
  const entries = [entry(1), entry(2, { culture: "French" }), entry(3, { culture: "Italian" })];
  assert.equal(pickThemedSet(entries, new Set(), { size: 4, rng: () => 0 }), null);
});

test("excludes posted and skipped entries", () => {
  const entries = [1, 2, 3, 4, 5].map((i) => entry(i));
  entries[0].skip = true;
  const set = pickThemedSet(entries, new Set(["harvard:2"]), { size: 4, rng: () => 0 });
  assert.ok(!set.some((e) => e.id === 1 || e.id === 2));
});

test("caps at one work per artist", () => {
  const entries = [entry(1, { artist: "Same" }), entry(2, { artist: "Same" }),
    entry(3), entry(4), entry(5), entry(6)];
  const set = pickThemedSet(entries, new Set(), { size: 4, rng: () => 0 });
  // "caps at" is an upper bound — the dedup guarantees no artist appears twice.
  assert.ok(set.filter((e) => e.artist === "Same").length <= 1);
  assert.equal(new Set(set.map((e) => e.artist)).size, set.length); // all artists distinct
});
