import { fetchJson, pick } from "./fetch.mjs";

// ── Art source configs ──────────────────────────────────────────────────────

const HARVARD_API = "https://api.harvardartmuseums.org/object";
const HARVARD_FIELDS = [
  "objectid", "primaryimageurl", "title", "people", "description",
  "culture", "dated", "classification", "medium", "url", "images",
].join(",");

const MET_API = "https://collectionapi.metmuseum.org/public/collection/v1";

const AIC_API = "https://api.artic.edu/api/v1";
const AIC_IIIF = "https://www.artic.edu/iiif/2";
const AIC_FIELDS = [
  "id", "title", "artist_display", "image_id", "place_of_origin",
  "date_display", "classification_title", "medium_display", "description",
].join(",");

const { HARVARD_API_KEY } = process.env;

// ── Harvard: random page from top-viewed works ──────────────────────────────

export async function fetchHarvardRandom() {
  if (!HARVARD_API_KEY) throw new Error("HARVARD_API_KEY not set");

  // First get total count
  const countUrl = `${HARVARD_API}?apikey=${HARVARD_API_KEY}&size=1&hasimage=1&q=verificationlevel:4&fields=objectid`;
  const countData = await fetchJson(countUrl);
  const totalPages = Math.min(countData.info.pages, 200);

  // Random page
  const page = Math.floor(Math.random() * totalPages) + 1;
  const url = `${HARVARD_API}?apikey=${HARVARD_API_KEY}&size=10&page=${page}&hasimage=1&q=verificationlevel:4&sort=totalpageviews&sortorder=desc&fields=${HARVARD_FIELDS}`;
  const data = await fetchJson(url);

  const records = data.records.filter((r) => r.primaryimageurl);
  if (records.length === 0) throw new Error("No Harvard artworks with images on this page");

  const r = pick(records);
  const artist = r.people?.map((p) => p.name).filter(Boolean).join(", ") || "Unknown artist";

  // Prefer IIIF URL (ids.lib.harvard.edu) — nrs.harvard.edu rate-limits aggressively
  const iiifUrl = r.images?.[0]?.iiifbaseuri;
  const imageUrl = iiifUrl ? `${iiifUrl}/full/843,/0/default.jpg` : r.primaryimageurl;

  return {
    id: r.objectid,
    title: r.title || "Untitled",
    artist,
    imageUrl,
    source: "harvard",
    culture: r.culture,
    dated: r.dated,
    classification: r.classification,
    medium: r.medium,
    description: r.description || "",
    url: r.url || `https://harvardartmuseums.org/collections/object/${r.objectid}`,
    museumName: "Harvard Art Museums",
  };
}

// ── Met: random from highlights ─────────────────────────────────────────────

export async function fetchMetRandom() {
  const searchUrl = `${MET_API}/search?hasImages=true&isHighlight=true&q=*`;
  const data = await fetchJson(searchUrl);
  const ids = data.objectIDs;
  if (!ids || ids.length === 0) throw new Error("No Met highlights found");

  // Try up to 5 random picks (some objects may lack images)
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = pick(ids);
    try {
      const obj = await fetchJson(`${MET_API}/objects/${id}`);
      const imageUrl = obj.primaryImage || obj.primaryImageSmall;
      if (!imageUrl) continue;

      return {
        id: obj.objectID,
        title: obj.title || "Untitled",
        artist: obj.artistDisplayName || "Unknown artist",
        imageUrl,
        source: "met",
        culture: obj.culture,
        dated: obj.objectDate,
        classification: obj.classification,
        medium: obj.medium,
        url: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
        museumName: "The Metropolitan Museum of Art",
      };
    } catch {
      continue;
    }
  }
  throw new Error("Failed to find Met artwork with image after 5 attempts");
}

// ── AIC: random from search ────────────────────────────────────────────────

export async function fetchAicRandom() {
  // Get total, pick random page (AIC returns 403 on deep pages, cap at 100)
  const countUrl = `${AIC_API}/artworks/search?q=*&limit=1&fields=id`;
  const countData = await fetchJson(countUrl);
  const totalPages = Math.min(countData.pagination.total_pages, 100);

  const page = Math.floor(Math.random() * totalPages) + 1;
  const url = `${AIC_API}/artworks/search?q=*&page=${page}&limit=10&fields=${AIC_FIELDS}`;
  const data = await fetchJson(url);

  const records = data.data.filter((r) => r.image_id);
  if (records.length === 0) throw new Error("No AIC artworks with images on this page");

  const r = pick(records);
  return {
    id: r.id,
    title: r.title || "Untitled",
    artist: r.artist_display || "Unknown artist",
    imageUrl: `${AIC_IIIF}/${r.image_id}/full/843,/0/default.jpg`,
    source: "artic",
    culture: r.place_of_origin,
    dated: r.date_display,
    classification: r.classification_title,
    medium: r.medium_display,
    description: r.description || "",
    url: `https://www.artic.edu/artworks/${r.id}`,
    museumName: "Art Institute of Chicago",
  };
}

// ── Fetch specific artwork by source:id ─────────────────────────────────────

export async function fetchSpecificArtwork(sourceId) {
  const [source, id] = sourceId.split(":");
  if (!source || !id) throw new Error(`Invalid --art format. Use: --art=harvard:229060`);

  console.log(`Fetching ${source}:${id}...`);

  if (source === "harvard") {
    if (!HARVARD_API_KEY) throw new Error("HARVARD_API_KEY not set");
    const url = `${HARVARD_API}/${id}?apikey=${HARVARD_API_KEY}&fields=${HARVARD_FIELDS}`;
    const r = await fetchJson(url);
    if (!r.primaryimageurl) throw new Error("This artwork has no image");
    const artist = r.people?.map((p) => p.name).filter(Boolean).join(", ") || "Unknown artist";
    const iiifUrl = r.images?.[0]?.iiifbaseuri;
    const imageUrl = iiifUrl ? `${iiifUrl}/full/843,/0/default.jpg` : r.primaryimageurl;
    return {
      id: r.objectid, title: r.title || "Untitled", artist,
      imageUrl, source: "harvard", culture: r.culture,
      dated: r.dated, classification: r.classification, medium: r.medium,
      description: r.description || "",
      url: r.url || `https://harvardartmuseums.org/collections/object/${r.objectid}`,
      museumName: "Harvard Art Museums",
    };
  }

  if (source === "met") {
    const obj = await fetchJson(`${MET_API}/objects/${id}`);
    const imageUrl = obj.primaryImage || obj.primaryImageSmall;
    if (!imageUrl) throw new Error("This artwork has no image");
    return {
      id: obj.objectID, title: obj.title || "Untitled",
      artist: obj.artistDisplayName || "Unknown artist", imageUrl, source: "met",
      culture: obj.culture, dated: obj.objectDate, classification: obj.classification,
      medium: obj.medium,
      url: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
      museumName: "The Metropolitan Museum of Art",
    };
  }

  if (source === "artic" || source === "aic") {
    const data = await fetchJson(`${AIC_API}/artworks/${id}?fields=${AIC_FIELDS}`);
    const r = data.data;
    if (!r.image_id) throw new Error("This artwork has no image");
    return {
      id: r.id, title: r.title || "Untitled",
      artist: r.artist_display || "Unknown artist",
      imageUrl: `${AIC_IIIF}/${r.image_id}/full/843,/0/default.jpg`,
      source: "artic", culture: r.place_of_origin, dated: r.date_display,
      classification: r.classification_title, medium: r.medium_display,
      description: r.description || "",
      url: `https://www.artic.edu/artworks/${r.id}`,
      museumName: "Art Institute of Chicago",
    };
  }

  throw new Error(`Unknown source: ${source}. Use harvard, met, or artic.`);
}

// ── Random artwork from any source ──────────────────────────────────────────

const SOURCES = [
  { name: "Harvard", fn: fetchHarvardRandom, needsKey: true },
  { name: "Met", fn: fetchMetRandom, needsKey: false },
  { name: "AIC", fn: fetchAicRandom, needsKey: false },
];

/**
 * Rotate sources based on current UTC date + hour.
 * Works without persistent history — each run deterministically picks
 * a different starting source based on time alone.
 */
function rotateByTime(sources) {
  const now = new Date();
  const daySlot = now.getUTCDate() * 24 + now.getUTCHours();
  const offset = daySlot % sources.length;
  return [...sources.slice(offset), ...sources.slice(0, offset)];
}

export async function fetchRandomArtwork(historySet, excludeSources = new Set()) {
  // Filter to sources we can use (Harvard needs API key) and not excluded
  const available = SOURCES.filter((s) =>
    (!s.needsKey || HARVARD_API_KEY) && !excludeSources.has(s.name.toLowerCase()),
  );

  if (available.length === 0) throw new Error("All art sources excluded or unavailable");

  // Try up to 10 times across all sources to find a non-duplicate
  for (let round = 0; round < 10; round++) {
    // First round: rotate by time; later rounds: shuffle
    const ordered = round === 0
      ? rotateByTime(available)
      : [...available].sort(() => Math.random() - 0.5);

    for (const source of ordered) {
      try {
        console.log(`Trying ${source.name}...`);
        const art = await source.fn();
        const key = `${art.source}:${art.id}`;

        if (historySet.has(key)) {
          console.log(`Skipping duplicate: "${art.title}" [${key}]`);
          continue;
        }

        console.log(`Got: "${art.title}" by ${art.artist} [${source.name}]`);
        return art;
      } catch (err) {
        console.warn(`${source.name} failed: ${err.message}`);
      }
    }
  }

  throw new Error("All art sources failed or all results were duplicates");
}

// ── Seasonal content ─────────────────────────────────────────────────────────

const SEASONAL_CALENDAR = [
  { key: "new-year",     start: [12, 20], end: [1, 5],   keywords: ["celebration", "new year", "winter", "feast", "festive"] },
  { key: "valentine",    start: [2, 7],   end: [2, 15],  keywords: ["love", "cupid", "romance", "kiss", "lovers", "heart"] },
  { key: "spring",       start: [3, 15],  end: [4, 5],   keywords: ["spring", "flowers", "bloom", "garden", "pastoral"] },
  { key: "easter",       start: [3, 25],  end: [4, 20],  keywords: ["resurrection", "easter", "lamb", "crucifixion", "madonna"] },
  { key: "summer",       start: [6, 15],  end: [7, 10],  keywords: ["summer", "sun", "sea", "beach", "bathing", "harvest"] },
  { key: "halloween",    start: [10, 20], end: [11, 1],  keywords: ["skull", "death", "skeleton", "night", "dark", "witch"] },
  { key: "thanksgiving", start: [11, 18], end: [11, 28], keywords: ["harvest", "feast", "abundance", "cornucopia", "gratitude"] },
  { key: "christmas",    start: [12, 10], end: [12, 26], keywords: ["nativity", "christmas", "madonna", "angel", "snow", "winter"] },
];

export function getActiveSeason() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  for (const season of SEASONAL_CALENDAR) {
    const [sm, sd] = season.start;
    const [em, ed] = season.end;

    // Handle year-wrapping (e.g. new-year: Dec 20 → Jan 5)
    if (sm > em) {
      if ((month > sm || (month === sm && day >= sd)) ||
          (month < em || (month === em && day <= ed))) {
        return season;
      }
    } else {
      if ((month > sm || (month === sm && day >= sd)) &&
          (month < em || (month === em && day <= ed))) {
        return season;
      }
    }
  }
  return null;
}

export function shouldPostSeasonal(historyData) {
  const season = getActiveSeason();
  if (!season) return null;
  if (historyData.postsSinceLastSeasonal < 2) return null;
  if (Math.random() > 0.2) return null;
  return season;
}

export async function fetchSeasonalArtwork(season, historySet, excludeSources = new Set()) {
  const keyword = pick(season.keywords);
  console.log(`Seasonal (${season.key}): searching for "${keyword}"...`);

  const available = SOURCES.filter((s) =>
    (!s.needsKey || HARVARD_API_KEY) && !excludeSources.has(s.name.toLowerCase()),
  );
  if (available.length === 0) return null;
  const ordered = rotateByTime(available);

  for (const source of ordered) {
    try {
      if (source.name === "Harvard") {
        const url = `${HARVARD_API}?apikey=${HARVARD_API_KEY}&size=10&hasimage=1&keyword=${encodeURIComponent(keyword)}&fields=${HARVARD_FIELDS}`;
        const data = await fetchJson(url);
        const records = data.records?.filter((r) => r.primaryimageurl) || [];
        if (records.length === 0) continue;
        const r = pick(records);
        const artist = r.people?.map((p) => p.name).filter(Boolean).join(", ") || "Unknown artist";
        const iiifUrl = r.images?.[0]?.iiifbaseuri;
        const imageUrl = iiifUrl ? `${iiifUrl}/full/843,/0/default.jpg` : r.primaryimageurl;
        const art = {
          id: r.objectid, title: r.title || "Untitled", artist,
          imageUrl, source: "harvard", culture: r.culture,
          dated: r.dated, classification: r.classification, medium: r.medium,
          description: r.description || "",
          url: r.url || `https://harvardartmuseums.org/collections/object/${r.objectid}`,
          museumName: "Harvard Art Museums",
        };
        if (!historySet.has(`${art.source}:${art.id}`)) return art;
      } else if (source.name === "Met") {
        const searchUrl = `${MET_API}/search?hasImages=true&q=${encodeURIComponent(keyword)}`;
        const searchData = await fetchJson(searchUrl);
        const ids = searchData.objectIDs;
        if (!ids || ids.length === 0) continue;
        for (let i = 0; i < Math.min(5, ids.length); i++) {
          const id = pick(ids);
          try {
            const obj = await fetchJson(`${MET_API}/objects/${id}`);
            const imageUrl = obj.primaryImage || obj.primaryImageSmall;
            if (!imageUrl) continue;
            const art = {
              id: obj.objectID, title: obj.title || "Untitled",
              artist: obj.artistDisplayName || "Unknown artist", imageUrl, source: "met",
              culture: obj.culture, dated: obj.objectDate, classification: obj.classification,
              medium: obj.medium,
              url: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
              museumName: "The Metropolitan Museum of Art",
            };
            if (!historySet.has(`${art.source}:${art.id}`)) return art;
          } catch { continue; }
        }
      } else if (source.name === "AIC") {
        const url = `${AIC_API}/artworks/search?q=${encodeURIComponent(keyword)}&limit=10&fields=${AIC_FIELDS}`;
        const data = await fetchJson(url);
        const records = data.data?.filter((r) => r.image_id) || [];
        if (records.length === 0) continue;
        const r = pick(records);
        const art = {
          id: r.id, title: r.title || "Untitled",
          artist: r.artist_display || "Unknown artist",
          imageUrl: `${AIC_IIIF}/${r.image_id}/full/843,/0/default.jpg`,
          source: "artic", culture: r.place_of_origin, dated: r.date_display,
          classification: r.classification_title, medium: r.medium_display,
          description: r.description || "",
          url: `https://www.artic.edu/artworks/${r.id}`,
          museumName: "Art Institute of Chicago",
        };
        if (!historySet.has(`${art.source}:${art.id}`)) return art;
      }
    } catch (err) {
      console.warn(`Seasonal search (${source.name}) failed: ${err.message}`);
    }
  }

  console.log("No seasonal artwork found — falling back to random");
  return null;
}
