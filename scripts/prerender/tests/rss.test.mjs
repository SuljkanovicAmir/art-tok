import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRssXml } from "../generate-rss.mjs";

const items = [{
  title: "The Vanity of the Artist's Dream",
  artist: "Charles Bird King",
  description: "Oil and graphite on canvas · 1830 · Harvard Art Museums",
  imageUrl: "https://www.dropbox.com/scl/fi/abc/h-1.jpg?rlkey=k&raw=1",
  link: "https://suljkanovicamir.github.io/art-tok/artwork/harvard/213930",
}];

test("emits valid RSS 2.0 with media:content image", () => {
  const xml = buildRssXml(items, { siteUrl: "https://suljkanovicamir.github.io/art-tok/" });
  assert.match(xml, /<rss version="2.0"/);
  assert.match(xml, /xmlns:media=/);
  assert.match(xml, /<media:content url="https:\/\/www\.dropbox\.com[^"]*"/);
  assert.match(xml, /<title>The Vanity of the Artist(&apos;|')s Dream<\/title>/);
});

test("escapes XML entities in titles", () => {
  const xml = buildRssXml([{ ...items[0], title: "Love & War <study>" }], { siteUrl: "x" });
  assert.match(xml, /Love &amp; War &lt;study&gt;/);
});
