import { test } from "node:test";
import assert from "node:assert/strict";
import { toDirectUrl } from "../lib/dropbox.mjs";

test("rewrites www.dropbox.com host and dl param", () => {
  assert.equal(
    toDirectUrl("https://www.dropbox.com/scl/fi/abc/x.jpg?rlkey=k&dl=0"),
    "https://dl.dropboxusercontent.com/scl/fi/abc/x.jpg?rlkey=k&dl=1",
  );
});

test("handles dl=0 as first query param", () => {
  assert.equal(
    toDirectUrl("https://www.dropbox.com/scl/fi/abc/x.jpg?dl=0"),
    "https://dl.dropboxusercontent.com/scl/fi/abc/x.jpg?dl=1",
  );
});

test("idempotent on already-direct URLs", () => {
  const direct = "https://dl.dropboxusercontent.com/scl/fi/abc/x.jpg?rlkey=k&dl=1";
  assert.equal(toDirectUrl(direct), direct);
});
