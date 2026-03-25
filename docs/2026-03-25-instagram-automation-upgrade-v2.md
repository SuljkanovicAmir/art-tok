# Instagram Automation Upgrade v2

**Date:** 2026-03-25
**PR:** #12 → develop, #13 → main (merged)

## What was built

7-feature upgrade to the Instagram auto-poster: reduced to 4 posts/day with mode cycling (post→post→reel→post), added alt text on image posts, first-comment hashtags, auto-story alongside every post, 30s watercolor card reels with CC0 classical music via ffmpeg, seasonal content (~20% chance with no-two-in-a-row guard), and a weekly analytics report.

## Files changed

- `scripts/instagram-poster/post.mjs` — full rewrite: mode cycle, alt text, first-comment hashtags, auto-story, reel creation, seasonal logic, history migration to composite keys
- `scripts/instagram-poster/analytics.mjs` — new: weekly engagement report generator
- `.github/workflows/instagram-post.yml` — 4x/day cron, auto/post/story/reel modes, ffmpeg install, history auto-commit
- `.github/workflows/instagram-analytics.yml` — new: Monday cron for weekly analytics
- `scripts/instagram-poster/audio/` — 7 CC0 classical music tracks for reels

## Key patterns & decisions

- **Alt text forbidden on reels** — `alt_text_custom` causes API error on REELS media type, only used for IMAGE posts
- **First-comment hashtags** — cleaner captions, same discoverability; posted as `POST /{media-id}/comments` immediately after publish
- **Mode cycling** — `["post","post","reel","post"]` indexed by history count; every 3rd post is a reel for algorithmic boost
- **Seasonal guard** — `Math.random() < 0.2` chance + no-two-in-a-row check prevents seasonal spam
- **Audio committed to repo** — 37MB total, acceptable for a repo this size; avoids network dependency in GitHub Actions
- **Reel via ffmpeg** — `stillimage` tune + 30s duration + AAC audio, `movflags +faststart` for streaming
