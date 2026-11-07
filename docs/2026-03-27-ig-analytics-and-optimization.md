# IG Analytics & Optimization

**Date:** 2026-03-27
**Commit:** 543eb44

## What was done

First analytics run on @arttok.art (49 followers, 20 posts), followed by data-driven optimizations.

## Analytics Fixes

- Added `instagram_manage_insights` permission to Meta app (was missing)
- Fixed insights API: `impressions` metric not supported for VIDEO media type — now selects `plays` for VIDEO, `impressions` for IMAGE, with fallback to `reach,saved,shares`
- Added `INSTAGRAM_USER_ID` to local `.env` (was missing)

## Key Findings

- **Engagement rate: 12.4%** — strong for a new account
- **Zero saves/shares** across all 20 posts — biggest growth gap
- **Reels get 3-5x more reach** but lower engagement conversion (5-6% vs 47-65% for images)
- **Best posting time: 15:00-19:00 UTC** (16:00-20:00 CET)
- **23:00 CET was dead zone** — 2.8 avg engagement (lowest by far)
- **Met Museum content: 85% of posts** — AIC at 0% due to 403 issues
- **Emoji captions underperformed** — posts without emojis averaged 78% higher engagement
- **Avg caption length: 148 chars** out of 2,200 — too short for saves

## Changes Applied

### Schedule: 4 → 5 posts/day
- Old: 07:00, 11:00, 17:00, 22:00 UTC
- New: 07:00, 10:00, 14:00, 17:00, 20:00 UTC
- Dropped 22:00 UTC dead zone, added 14:00/10:00 UTC slots

### Mode cycle: reel every ~2 days
- Old: post → post → reel → post (1 reel per 4 posts, >1/day)
- New: 9 posts → 1 reel (1 reel per 10 posts, every ~2 days)

### Hashtag audit
- Removed 18 broad tags (5M+ posts) that buried content
- Added 16 mid-tier niche tags (10K-500K posts) for discoverability
- Added 3 movement tags: fresco, mosaicart, engraving
- Final pool: 38 rotating tags, 20-25 per post

### Watercolor card rendering
- Saturation boost: 1.2x → 1.5x (richer colors from artwork palette)
- Lightness boost: 0.1 → 0.05 (keeps translucent watercolor feel without washing out)
- Wash alpha: 0.018 → 0.022 main, 0.014 → 0.018 blend (more pigment buildup)
- Wash spread: 200+350 → 240+380 radius (better canvas coverage)
- Paper grain: noise 215-255 → 195-245, alpha 0.6 → 0.5 (warmer, more visible tooth)

### Reel card preset
- New `reel` preset: padding 120px (vs story 80px) for smaller art image with more breathing room
- Reel auto-story now renders its own story card instead of reusing reel buffer

## Files Changed

- `.github/workflows/instagram-post.yml` — 5-post schedule
- `scripts/instagram-poster/post.mjs` — mode cycle, reel card import, auto-story fix
- `scripts/instagram-poster/lib/render.mjs` — watercolor params, reel preset, renderReelCard export
- `scripts/instagram-poster/lib/captions.mjs` — hashtag audit, movement tags
- `scripts/instagram-poster/analytics.mjs` — media_type-aware insights
- `docs/analytics/2026-03-27-weekly.md` — first analytics report
