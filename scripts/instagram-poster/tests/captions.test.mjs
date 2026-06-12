import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHashtags, buildCaption } from "../lib/captions.mjs";

const art = {
  source: "harvard", id: 1, title: "The Vanity of the Artist's Dream",
  artist: "Charles Bird King", dated: "1830", culture: "American",
  medium: "Oil and graphite on canvas", museumName: "Harvard Art Museums",
  description: "",
};

test("hashtags are 5-7 focused tags including artist slug and museum", () => {
  const tags = buildHashtags(art, () => 0.5).split(" ");
  assert.ok(tags.length >= 5 && tags.length <= 7, `got ${tags.length}`);
  assert.ok(tags.includes("#charlesbirdking"));
  assert.ok(tags.includes("#harvardartmuseums"));
  assert.ok(tags.includes("#oilpainting"));
});

test("unknown artist gets no artist tag and no crash", () => {
  const tags = buildHashtags({ ...art, artist: "Unknown artist" }, () => 0.5);
  assert.doesNotMatch(tags, /#unknownartist/);
});

test("artist slug skipped when unreasonably long", () => {
  const tags = buildHashtags({ ...art, artist: "Workshop of the Master of the Embroidered Foliage" }, () => 0.5);
  assert.doesNotMatch(tags, /#workshopofthemaster/);
});

test("caption first line block front-loads artist, medium, date (IG SEO)", () => {
  const caption = buildCaption(art, "post", () => 0.9); // rng 0.9 -> no curator note
  const head = caption.split("\n").slice(0, 4).join(" ");
  assert.match(head, /Charles Bird King/);
  assert.match(head, /Oil and graphite on canvas/);
  assert.match(head, /1830/);
});
