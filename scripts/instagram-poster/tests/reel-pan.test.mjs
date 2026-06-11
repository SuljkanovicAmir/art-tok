import { test } from "node:test";
import assert from "node:assert/strict";
import { planPanMotion, DURATION_S, FPS } from "../lib/reel-pan.mjs";

test("portrait painting gets pull-out preset", () => {
  const plan = planPanMotion({ width: 1600, height: 1917, seed: 1 });
  assert.equal(plan.preset, "pullout");
  assert.match(plan.filter, /zoompan/);
  assert.match(plan.filter, /s=1080x1920/);
});

test("landscape painting gets lateral pan via crop (not zoompan)", () => {
  const plan = planPanMotion({ width: 2400, height: 1500, seed: 1 });
  assert.equal(plan.preset, "pan");
  assert.match(plan.filter, /crop=/);
  assert.doesNotMatch(plan.filter, /zoompan/);
});

test("small source falls back to gentle push-in", () => {
  const plan = planPanMotion({ width: 1200, height: 1100, seed: 1 });
  assert.equal(plan.preset, "pushin");
});

test("too-small source returns null (caller falls back to card reel)", () => {
  assert.equal(planPanMotion({ width: 900, height: 700, seed: 1 }), null);
});

test("deterministic for the same seed, varies with seed", () => {
  const a = planPanMotion({ width: 2400, height: 1500, seed: 42 });
  const b = planPanMotion({ width: 2400, height: 1500, seed: 42 });
  const c = planPanMotion({ width: 2400, height: 1500, seed: 43 });
  assert.equal(a.filter, b.filter);
  assert.notEqual(a.filter, c.filter); // direction flips with seed
});
