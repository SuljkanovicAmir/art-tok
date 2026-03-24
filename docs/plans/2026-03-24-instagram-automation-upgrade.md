# Instagram Automation Upgrade — Design Doc

**Date:** 2026-03-24
**Status:** Approved
**Scope:** 7 features for the Instagram auto-poster (`scripts/instagram-poster/`)

---

## Features

### 1. Reduce to 4 posts/day

**Current:** 8 posts/day (every 3 hours)
**New:** 4 posts/day with strategic timing

**Cron schedule (UTC):**
```
0 7,12,18,1 * * *
```
- 07:00 UTC — morning EU
- 12:00 UTC — morning US East / lunch EU
- 18:00 UTC — evening EU / afternoon US
- 01:00 UTC — evening US West

**Mode cycle** per day (tracked in posted-history.json):
| Run | Content |
|-----|---------|
| 1 | Feed post + auto-story |
| 2 | Feed post + auto-story |
| 3 | **Reel** (30s video) + auto-story |
| 4 | Feed post + auto-story |

Daily output: 3 feed posts + 1 reel + 4 stories = 8 pieces from 4 runs.

**Changes:**
- `.github/workflows/instagram-post.yml` — update cron
- `post.mjs` — add mode cycle logic, read/write `runIndex` in history

---

### 2. Alt text on every post

Add `alt_text` parameter to the Instagram media container creation API call.

**Format:**
```
{title} by {artist}. {medium}. {museumName}.
```

**Truncated to 1000 chars** (Instagram alt text limit).

**Changes:**
- `post.mjs` — add `alt_text` to `containerParams` in `publishToInstagram()`

---

### 3. First comment with hashtags

Move all hashtags from the caption into an auto-posted first comment.

**Caption becomes:**
```
{title}
{artist}, {dated}
{medium} · {museumName}

Follow @arttok.art for masterworks from the world's greatest museums.
```

**First comment contains 20-25 hashtags:**
- 3 core: `#arttok #fineart #arthistory`
- 1 museum-specific
- 1-2 medium-specific
- 1-2 culture-specific
- 12-16 from expanded rotating pool (~40 niche art tags)

**Expanded rotating pool (new niche tags):**
```
#classicalart #museumlife #masterpiece #artdiscovery #paintingoftheday
#artappreciation #artcollector #fineartphotography #artgallery
#culturalheritage #artistsoninstagram #artworld #arthistorynerd
#classicalmasterpiece #museumlover #oilpaintingart #artcurator
#dailyart #arteducation #artlovers #renaissanceart #impressionism
#baroqueart #modernart #artmuseum #contemporaryart #europeanart
#portraitpainting #landscapepainting #abstractart #artoftheday
#instaart #artexhibition #gallerywall #artisticexpression
#oldmasters #fineartfriday #artcommunity #artinspiration #worldofart
```

**Implementation:**
- New function `postFirstComment(mediaId, hashtags)` — calls `POST /{media-id}/comments`
- `buildCaption()` returns caption without hashtags
- `buildHashtags()` returns expanded hashtag string for comment

**Changes:**
- `post.mjs` — split caption/hashtags, new `postFirstComment()` function

---

### 4. Auto-story with every feed post

After publishing any feed post or reel, immediately publish a story using the same artwork.

**Flow:**
1. Render story card via existing `renderStoryCard(art, imageUrl)` (1080x1920)
2. Upload story PNG to Dropbox
3. Publish with `media_type: "STORIES"` (stories don't support captions)
4. Clean up Dropbox

**Changes:**
- `post.mjs` — new `publishStory(art, imageUrl)` function called after every feed/reel publish

---

### 5. Reels (30s watercolor card + classical music)

**Pipeline:**
1. Render story-format watercolor card (1080x1920 PNG) via `renderStoryCard()`
2. Pick random audio track from `audio/` directory
3. Use `ffmpeg` to combine: static image + audio → 30s MP4
4. Upload MP4 to Dropbox
5. Publish via Instagram API with `media_type: "REELS"`

**ffmpeg command:**
```bash
ffmpeg -loop 1 -i card.png -i audio.mp3 \
  -c:v libx264 -tune stillimage -c:a aac -b:a 128k \
  -pix_fmt yuv420p -shortest -t 30 \
  -movflags +faststart reel.mp4
```

**Audio library** (`scripts/instagram-poster/audio/`):
All CC0 / Public Domain Mark 1.0, sourced from Musopen via archive.org.

| File | Piece |
|------|-------|
| beethoven-moonlight-1st.mp3 | Moonlight Sonata, 1st mvt |
| chopin-nocturne-op9-no1.mp3 | Nocturne Op.9 No.1 |
| chopin-nocturne-op9-no2.mp3 | Nocturne Op.9 No.2 |
| chopin-nocturne-op27-no2.mp3 | Nocturne Op.27 No.2 |
| chopin-nocturne-op55-no2.mp3 | Nocturne Op.55 No.2 |
| chopin-nocturne-op72-no1.mp3 | Nocturne Op.72 No.1 |

Audio is pre-trimmed to 30 seconds during the build step (ffmpeg `-t 30` handles this).

**GitHub Action changes:**
- Add `sudo apt-get install -y ffmpeg` to system deps step
- Workflow dispatch adds `reel` option

**Changes:**
- `post.mjs` — new `createReel(art, imageUrl)` function, `publishReel()` function
- `.github/workflows/instagram-post.yml` — add ffmpeg install, reel mode

---

### 6. Seasonal content (~20% chance, cooldown)

**Seasonal calendar:**

| Key | Date Range | Search Keywords |
|-----|-----------|-----------------|
| new-year | Dec 28 – Jan 5 | celebration, feast, winter, fireworks |
| valentine | Feb 10 – Feb 16 | love, romance, couple, kiss, heart, cupid |
| spring | Mar 15 – Apr 30 | spring, garden, flower, blossom, pastoral |
| easter | Apr 10 – Apr 25 | resurrection, cross, religious, angel, church |
| summer | Jun 1 – Aug 31 | summer, beach, sun, sea, swimming, bathers |
| halloween | Oct 20 – Oct 31 | death, skull, dark, night, demon, witch, skeleton |
| thanksgiving | Nov 20 – Nov 28 | harvest, feast, autumn, cornucopia |
| christmas | Dec 10 – Dec 27 | nativity, madonna, christmas, snow, winter, magi |

**Selection logic (weighted random with cooldown):**
1. Check if today falls in any seasonal window
2. If no → regular random artwork
3. If yes → check `postsSinceLastSeasonal` in history
4. If `< 2` → skip (cooldown), regular random
5. If `>= 2` → roll 20% probability
6. If seasonal fires → use seasonal keywords in API search:
   - Harvard: `&keyword={seasonal_keywords}`
   - Met: `&q={keyword}&hasImages=true`
   - AIC: search endpoint with keyword
7. If seasonal search returns no results → fall back to regular random

**History format migration** (posted-history.json):
```json
{
  "posted": ["harvard:229060", ...],
  "postsSinceLastSeasonal": 3,
  "runIndex": 2
}
```
Old format (plain array) auto-migrated on first run.

**Changes:**
- `post.mjs` — seasonal calendar, `shouldPostSeasonal()`, `fetchSeasonalArtwork()`, history migration

---

### 7. Weekly analytics report

**New file:** `scripts/instagram-poster/analytics.mjs`
**New workflow:** `.github/workflows/instagram-analytics.yml`

**Schedule:** Every Monday at 09:00 UTC
```
cron: "0 9 * * 1"
```

**What it collects:**
1. `GET /me?fields=followers_count,media_count` — profile stats
2. `GET /me/media?fields=id,caption,timestamp,like_count,comments_count,media_type&limit=50` — recent posts
3. For each post: `GET /{id}/insights?metric=reach,impressions,saved,shares` — engagement metrics

**Report format** (committed to `docs/analytics/YYYY-MM-DD-weekly.md`):
```markdown
# Weekly Analytics — {date range}

## Profile
- Followers: {count} ({+/- change})
- Posts this week: {count}

## Top 5 Posts (by engagement)
| Post | Likes | Comments | Saves | Shares | Reach |
...

## Bottom 5 Posts
...

## Averages by Museum Source
| Source | Avg Likes | Avg Saves | Avg Reach |
...

## Averages by Posting Hour (UTC)
| Hour | Avg Engagement |
...
```

**Previous report comparison:** Reads the most recent report in `docs/analytics/` to calculate follower growth delta.

**Changes:**
- New `scripts/instagram-poster/analytics.mjs`
- New `.github/workflows/instagram-analytics.yml`

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `scripts/instagram-poster/post.mjs` | Mode cycle, alt text, first comment, auto-story, reels, seasonal, history migration |
| `scripts/instagram-poster/render.mjs` | No changes (existing renderStoryCard reused) |
| `scripts/instagram-poster/analytics.mjs` | **New** — weekly analytics report generator |
| `scripts/instagram-poster/posted-history.json` | Migrated from array to object format |
| `scripts/instagram-poster/audio/*.mp3` | 6 CC0 classical music tracks (already downloaded) |
| `.github/workflows/instagram-post.yml` | Cron 4x/day, ffmpeg install, reel mode |
| `.github/workflows/instagram-analytics.yml` | **New** — Monday analytics workflow |

## Dependencies

- `ffmpeg` — installed in GitHub Action (system package), needed for reel video generation
- No new npm packages needed
