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

export function buildCaption(art) {
  const lines = [];

  // Title block — authoritative, museum-label style
  lines.push(art.title);
  if (art.artist !== "Unknown artist") lines.push(art.artist);

  const details = [];
  if (art.dated) details.push(art.dated);
  if (art.medium) details.push(art.medium);
  if (details.length) lines.push(details.join(" · "));

  lines.push(art.museumName);
  lines.push("");

  // CTA
  lines.push("Follow @arttok.art for masterworks from the world's greatest museums.");

  return lines.join("\n");
}

export function buildAltText(art) {
  const parts = [`${art.title} by ${art.artist}`];
  if (art.medium) parts.push(art.medium);
  parts.push(art.museumName);
  return parts.join(". ").slice(0, 1000);
}
