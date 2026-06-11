import { test } from "node:test";
import assert from "node:assert/strict";
import { isDuplicateRun } from "../lib/run-guard.mjs";

const now = new Date("2026-06-12T15:00:00Z");

test("blocks when last successful post was 30 minutes ago", () => {
  const log = [{ timestamp: "2026-06-12T14:30:00.000Z", mediaId: "123" }];
  assert.equal(isDuplicateRun(log, now), true);
});

test("allows when last post was 3 hours ago (normal schedule gap)", () => {
  const log = [{ timestamp: "2026-06-12T12:00:00.000Z", mediaId: "123" }];
  assert.equal(isDuplicateRun(log, now), false);
});

test("allows on empty log", () => {
  assert.equal(isDuplicateRun([], now), false);
});

test("ignores entries without mediaId (dry runs never log, but be safe)", () => {
  const log = [{ timestamp: "2026-06-12T14:55:00.000Z" }];
  assert.equal(isDuplicateRun(log, now), false);
});
