import { test } from "node:test";
import assert from "node:assert/strict";
import { extractContextSentence } from "../lib/wiki.mjs";

test("accepts a clean biographical sentence", () => {
  const extract = "Charles Bird King was an American portrait artist, best known for his portrayals of Native American leaders.";
  const out = extractContextSentence(extract, "Charles Bird King");
  assert.equal(out, "Charles Bird King was an American portrait artist, best known for his portrayals of Native American leaders.");
});

test("rejects disambiguation pages", () => {
  assert.equal(extractContextSentence("Charles King may refer to:", "Charles King"), null);
});

test("rejects when artist name absent from text", () => {
  assert.equal(extractContextSentence("A completely unrelated article about geology.", "Charles Bird King"), null);
});

test("rejects too-short and too-long sentences", () => {
  assert.equal(extractContextSentence("Charles Bird King painted.", "Charles Bird King"), null);
  assert.equal(extractContextSentence(`Charles Bird King ${"x".repeat(400)}.`, "Charles Bird King"), null);
});
