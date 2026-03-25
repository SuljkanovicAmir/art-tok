const CORE_TAGS = ["#arttok", "#fineart", "#arthistory"];

const ROTATING_TAGS = [
  "#classicalart", "#museumlife", "#masterpiece", "#artdiscovery",
  "#paintingoftheday", "#artappreciation", "#artcollector", "#fineartphotography",
  "#artgallery", "#culturalheritage", "#artistsoninstagram", "#artworld",
  "#arthistorynerd", "#classicalmasterpiece", "#museumlover", "#oilpaintingart",
  "#artcurator", "#dailyart", "#arteducation", "#artlovers",
  "#renaissanceart", "#impressionism", "#baroqueart", "#modernart",
  "#artmuseum", "#contemporaryart", "#europeanart", "#portraitpainting",
  "#landscapepainting", "#artoftheday", "#instaart", "#artexhibition",
  "#gallerywall", "#oldmasters", "#fineartfriday", "#artcommunity",
  "#artinspiration", "#worldofart", "#artdaily", "#artlover",
];

const MOVEMENT_TAGS = {
  painting: "#painting", paintings: "#painting",
  oil: "#oilpainting", watercolor: "#watercolor",
  sculpture: "#sculpture", photograph: "#photography",
  print: "#printmaking", drawing: "#drawing",
  ceramic: "#ceramics", textile: "#textileart",
};

const MUSEUM_TAGS = {
  harvard: "#harvardartmuseums",
  met: "#themet",
  artic: "#artinstituteofchicago",
};

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function buildHashtags(art) {
  const tags = [...CORE_TAGS];

  // Museum tag
  tags.push(MUSEUM_TAGS[art.source] || "#museum");

  // Medium/movement-specific tags (allow up to 2)
  if (art.medium) {
    const mediumLower = art.medium.toLowerCase();
    let mediumCount = 0;
    for (const [keyword, tag] of Object.entries(MOVEMENT_TAGS)) {
      if (mediumLower.includes(keyword)) {
        tags.push(tag);
        mediumCount++;
        if (mediumCount >= 2) break;
      }
    }
  }

  // Culture-specific tag
  if (art.culture) {
    const clean = art.culture.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (clean.length > 2 && clean.length < 30) tags.push(`#${clean}`);
  }

  // Fill remaining slots from rotating pool (target 20-25 total)
  const target = 20 + Math.floor(Math.random() * 6); // 20-25
  const remaining = target - tags.length;
  if (remaining > 0) tags.push(...pickRandom(ROTATING_TAGS, remaining));

  return tags.join(" ");
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#?\w+;/g, "").replace(/\s+/g, " ").trim();
}

function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  const cut = str.lastIndexOf(" ", maxLen);
  return str.slice(0, cut > 0 ? cut : maxLen) + "...";
}

function cleanDescription(raw) {
  if (!raw) return "";
  const cleaned = stripHtml(raw);
  if (cleaned.length < 20) return "";
  return cleaned;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
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

export function buildCaption(art, mode = "post") {
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
    if (Math.random() < 0.125) {
      lines.push("");
      lines.push(pick(CURATOR_NOTES));
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
    if (details.length) lines.push(details.join(" \u00B7 "));

    lines.push(art.museumName);

    if (desc) {
      lines.push("");
      lines.push("───────");
      lines.push("");
      lines.push(truncate(desc, 400));
    }

    // Curator's note ~1 in 3 posts
    if (Math.random() < 0.125) {
      lines.push("");
      lines.push(pick(CURATOR_NOTES));
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
