# Expanding Art Sources — Research Notes (2026-04-16)

Research snapshot for adding **Rijksmuseum** and **Smithsonian Open Access**
as art sources alongside Harvard / Met / AIC. No code written — integration
was paused after the Rijks Linked Art parser showed more complexity than the
quick-win framing suggested. This doc captures findings so the next session
can pick up without re-researching.

## Why

Current three sources (Harvard, Met, AIC) bias toward Anglo-American canon.
Goal: more obscure, diverse art — Dutch Golden Age, Asian, African,
Indigenous, outsider/folk, non-canonical European.

## Rijksmuseum

**Status:** paused. Linked Art parser non-trivial; needs a dedicated session.

### API status
- **Legacy key-based API is being shut down** (explicitly end-of-2024/2025,
  still listed in their docs as "deprecated, will soon be permanently
  discontinued"). Existing demo key `0fiuZFh4` no longer works. Not viable.
- **Linked Art API** is the replacement. Launch docs at
  [data.rijksmuseum.nl/docs/search](https://data.rijksmuseum.nl/docs/search).
  No API key required.

### Search endpoint
```
GET https://data.rijksmuseum.nl/search/collection?type=painting&imageAvailable=true
```
- Returns `OrderedCollectionPage` with `orderedItems[]` of bare LOD
  identifiers: `{ id: "https://id.rijksmuseum.nl/200100988", type: "HumanMadeObject" }`.
- Pagination: base64-encoded `pageToken` in `next.id`.
- `totalItems: 4921` painting records with images (as of probe).
- Useful params:
  - `type=painting` (also accepts Dutch `schilderij`)
  - `material=oil+paint` / `technique=oil+painting`
  - `imageAvailable=true`
  - `creationDate=1600..1700`
  - `hexColor=#rrggbb` (dominant color)
  - `creator=<name>`

### Detail resolution
Each search hit resolves via `Accept: application/ld+json`:
```
GET https://id.rijksmuseum.nl/<id>          # → 303 redirect to data.rijksmuseum.nl/<id>
```

Response is Linked Art JSON-LD. Top-level keys: `@context, id, type,
produced_by, subject_of, identified_by, classified_as, dimension, made_of,
current_location, shows, referred_to_by, equivalent, member_of`.

Field extraction map (from sample `200100988` — Jan Toorop, "Misty Sea"):

| Field | Path |
|---|---|
| Title | `identified_by[]` → find `Name` with `classified_as` containing Getty AAT `300417207` (title type); prefer `language` matching English |
| Artist | `produced_by.part[].carried_out_by[].notation[]` → `@value` where `@language === "en"` |
| Date | `produced_by.timespan.begin_of_the_begin` (ISO 8601) or `identified_by[].content` |
| Description | `referred_to_by[]` → `LinguisticObject` with large `content` string; language-filter for English or fallback to Dutch |
| Museum URL | `subject_of[].digitally_carried_by[].access_point[].id` (format `text/html`) |
| Image | **NOT in main response.** `shows[]` contains ref to `VisualItem` at a different URL (note id mangling: `200100988` → `202100988`). Must fetch VisualItem separately to get image URLs. |

### Image pipeline (unresolved)
- Fetching the `VisualItem` adds a second round-trip per artwork.
- IIIF manifest location not yet confirmed from this session's probe.
- Rijks historically hosted images via `lh3.googleusercontent.com` (from
  legacy API) and has a IIIF service — need to confirm the LOD path.

### Estimated effort
3–5 hours for a robust parser + IIIF fallback + error handling. The
Linked Art complexity is the bulk (nested Getty vocabulary refs,
multi-language content, indirect image references).

### Recommended approach when resuming
1. Complete the image-URL probe (fetch a VisualItem, find the IIIF endpoint).
2. Build `lib/linked-art.mjs` with pure extraction helpers: `extractTitle`,
   `extractArtist`, `extractDate`, `extractImageUrl` — take the JSON-LD
   object, walk defensively, fall back gracefully.
3. Add `fetchRijksRandom()` to `art-fetchers.mjs` — two-step (search → resolve).
4. Register in `SOURCES` array.
5. Update Dropbox image cache curator to handle Rijks.

## Smithsonian Open Access

**Status:** researched only. Not yet probed.

### API
- Base: `https://api.si.edu/openaccess/api/v1.0/`
- Requires free API key from [api.data.gov](https://api.data.gov).
- Search endpoint: `GET /search?api_key=KEY&q=painting&fqs=[...]`
- 11M+ metadata records; CC0 licensed portions flagged in metadata.

### Painting filter
```
?api_key=KEY&q=painting&fqs=["object_type:Painting","online_media_type:Images"]
```

### Diversity angle
- `unit_code` filters to one Smithsonian museum: SAAM (American Art),
  FSG (Freer/Sackler Asian), NPG (National Portrait), NMAI (American Indian),
  NMAAHC (African American), etc.
- Field names aren't perfectly uniform across units — some use `type` or
  `classification` instead of `object_type`. Budget prototype time to
  confirm per-unit schema before committing.

### Estimated effort
2–3 days: field-mapping across multiple units is the main cost.

## Decision

When resuming, start with **Rijksmuseum** (no key, narrower scope, higher
aesthetic yield per record). Smithsonian second (bigger catalog but more
per-museum mapping work). Both would significantly diversify the feed over
Harvard/Met/AIC alone.

## Sources

- [Rijksmuseum Data Services](https://data.rijksmuseum.nl/)
- [Rijksmuseum Search API docs](https://data.rijksmuseum.nl/docs/search)
- [Smithsonian Open Access devtools](https://www.si.edu/openaccess/devtools)
- [EDAN-python query examples](https://github.com/Smithsonian/EDAN-python)
- [Linked Art specification](https://linked.art/)
