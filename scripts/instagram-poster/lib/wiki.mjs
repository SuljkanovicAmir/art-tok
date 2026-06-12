// lib/wiki.mjs
// Optional caption enrichment: one factual sentence about the artist from
// Wikipedia's REST summary API. STRICTLY best-effort — every failure path
// returns null and the caption simply omits the line.

export function extractContextSentence(extract, artist) {
  if (!extract || /may refer to/i.test(extract)) return null;
  const lastName = artist.split(" ").pop();
  if (!extract.includes(lastName)) return null;
  const sentence = extract.split(/(?<=\.)\s+/)[0]?.trim();
  if (!sentence || sentence.length < 60 || sentence.length > 280) return null;
  return sentence;
}

export async function fetchArtistContext(artist) {
  if (!artist || artist === "Unknown artist") return null;
  try {
    const title = encodeURIComponent(artist.trim().replace(/\s+/g, "_"));
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
      { signal: AbortSignal.timeout(5000), headers: { "User-Agent": "ArtTok/1.0 (art curation bot)" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type !== "standard") return null; // skips disambiguation pages
    return extractContextSentence(data.extract, artist);
  } catch {
    return null;
  }
}
