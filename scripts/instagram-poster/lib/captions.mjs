const CORE_TAGS = ["#arttok", "#fineart", "#arthistory"];

const MOVEMENT_TAGS = {
  painting: "#painting", paintings: "#painting",
  oil: "#oilpainting", watercolor: "#watercolor",
  sculpture: "#sculpture", photograph: "#photography",
  print: "#printmaking", drawing: "#drawing",
  ceramic: "#ceramics", textile: "#textileart",
  fresco: "#fresco", mosaic: "#mosaicart", engraving: "#engraving",
};

const MUSEUM_TAGS = {
  harvard: "#harvardartmuseums",
  met: "#themet",
  artic: "#artinstituteofchicago",
};

// 2026 IG discovery: 3–5 *specific* tags beat 20+ generic ones, and the keyword-rich
// caption itself is now the real surface. Build a focused set: brand + museum + artist
// + medium + culture, capped at 7. (rng kept for signature parity; result is deterministic.)
export function buildHashtags(art, rng = Math.random) {
  const tags = [...CORE_TAGS]; // #arttok #fineart #arthistory

  tags.push(MUSEUM_TAGS[art.source] || "#museum");

  // Artist tag — the highest-intent searchers use these.
  if (art.artist && art.artist !== "Unknown artist") {
    const slug = art.artist.toLowerCase().replace(/[^a-z]/g, "");
    if (slug.length >= 4 && slug.length <= 24) tags.push(`#${slug}`);
  }

  // One medium tag.
  if (art.medium) {
    const mediumLower = art.medium.toLowerCase();
    for (const [keyword, tag] of Object.entries(MOVEMENT_TAGS)) {
      if (mediumLower.includes(keyword)) { tags.push(tag); break; }
    }
  }

  // One culture tag.
  if (art.culture) {
    const clean = art.culture.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (clean.length > 2 && clean.length < 30) tags.push(`#${clean}`);
  }

  return [...new Set(tags)].slice(0, 7).join(" ");
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#?\w+;/g, "").replace(/\s+/g, " ").trim();
}

function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  const cut = str.lastIndexOf(" ", maxLen);
  return str.slice(0, cut > 0 ? cut : maxLen) + "...";
}

export function cleanDescription(raw) {
  if (!raw) return "";
  const cleaned = stripHtml(raw);
  if (cleaned.length < 20) return "";
  return cleaned;
}

// ── Rotating engagement hooks (keeps feed fresh, drives comments + saves) ──

// Curator's notes — short, observational, never asks for engagement.
// Shown on ~1 in 3 posts to keep the feed clean.
const CURATOR_NOTES = [
  "Worth seeing in person.",
  "A permanent collection favourite.",
  "One of those pieces that shifts with the light.",
  "Better the longer you look.",
  "The kind of work rooms are built around.",
  "Still striking after all these centuries.",
  "Reproductions never quite capture it.",
  "A masterclass in restraint.",
];

const SIGN_OFF = "Follow @arttok.art \u00B7 Masterworks, daily.";

export function buildCaption(art, mode = "post", rng = Math.random, { contextLine = null } = {}) {
  const lines = [];
  const desc = cleanDescription(art.description);

  if (mode === "reel") {
    // ── Reel: compact, cinematic ──
    lines.push(art.title);
    if (art.artist !== "Unknown artist") {
      const datePart = art.dated ? ` \u00B7 ${art.dated}` : "";
      lines.push(`${art.artist}${datePart}`);
    } else if (art.dated) {
      lines.push(art.dated);
    }
    lines.push(art.museumName);

    if (desc) {
      lines.push("");
      lines.push(truncate(desc, 200));
    }

    // Curator's note ~1 in 3 reels
    if (rng() < 0.33) {
      lines.push("");
      lines.push(CURATOR_NOTES[Math.floor(rng() * CURATOR_NOTES.length)]);
    }

    lines.push("");
    lines.push(SIGN_OFF);
  } else {
    // ── Post: gallery wall label style ──
    lines.push(art.title);
    if (art.artist !== "Unknown artist") lines.push(art.artist);

    const details = [];
    if (art.dated) details.push(art.dated);
    if (art.medium) details.push(art.medium);
    if (art.culture) details.push(art.culture);
    if (details.length) lines.push(details.join(" \u00B7 "));

    lines.push(art.museumName);

    if (desc) {
      lines.push("");
      lines.push("───────");
      lines.push("");
      lines.push(truncate(desc, 400));
    } else if (contextLine) {
      lines.push("");
      lines.push("───────");
      lines.push("");
      lines.push(contextLine);
    }

    // Curator's note ~1 in 3 posts
    if (rng() < 0.33) {
      lines.push("");
      lines.push(CURATOR_NOTES[Math.floor(rng() * CURATOR_NOTES.length)]);
    }

    lines.push("");
    lines.push(SIGN_OFF);
  }

  return lines.join("\n");
}

export function buildAltText(art) {
  const parts = [`${art.title} by ${art.artist}`];
  if (art.medium) parts.push(art.medium);
  parts.push(art.museumName);
  return parts.join(". ").slice(0, 1000);
}

// Numbered gallery labels for a themed carousel, one entry per child work.
export function buildCarouselCaption(theme, arts, rng = Math.random) {
  const lines = [theme, ""];
  arts.forEach((a, i) => {
    const detail = [a.dated, a.medium].filter(Boolean).join(" · ");
    lines.push(`${i + 1}. ${a.title}${a.artist !== "Unknown artist" ? ` — ${a.artist}` : ""}`);
    if (detail) lines.push(`   ${detail}`);
  });
  lines.push("", arts[0].museumName, "", SIGN_OFF);
  return lines.join("\n");
}
