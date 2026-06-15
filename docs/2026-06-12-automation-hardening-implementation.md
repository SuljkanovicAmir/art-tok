# Automation Hardening + New Content Formats — Implementation Notes

**Date:** 2026-06-12
**Plan:** [docs/plans/2026-06-12-automation-hardening-and-content-formats.md](plans/2026-06-12-automation-hardening-and-content-formats.md)
**Status:** All 17 tasks implemented, merged to `main`, tests green (52 IG-poster + 2 RSS).

Shipped in five phases, each merged to `main` after local verification:

| Phase | Tasks | What landed |
|-------|-------|-------------|
| 0 — Workflow hardening | 1–3 | analytics workflow `permissions`/push-retry/failure-alerts; post workflow concurrency (`ig-state`), `npm ci`, pre-flight tests, alerts; actions bumped to v5/v4; `.gitignore` + least-privilege perms |
| 1 — Posting safety | 4–7 | idempotency guard (`run-guard.mjs`); state written at publish time + `wasSeasonal` fix; Dropbox URL pre-probe + try/finally cleanup + honest deletes; reel retry parity (`publishContainer`), 5-min video poll, reel→post fallback; API `statusCode` on `fetchJson` |
| 2 — Pan/zoom reels | 8–10 | `reel-pan.mjs` motion planner (pullout/pan/pushin); `createPanReel` ffmpeg shell behind `--pan` with card-reel fallback; trial reels + `thumb_offset` cover |
| 3 — Caption SEO | 11–12 | focused 5–7 metadata hashtags (was 20–25 generic); front-loaded gallery-label captions; Wikipedia artist context line for description-less posts (`wiki.mjs`) |
| 4 — Themed carousels | 13–14 | `pickThemedSet` (same culture + orientation, one-per-artist); `publishCarousel` + `buildCarouselCaption` + `--carousel` mode; Sunday 16:00 UTC cron via a "Resolve mode" step |
| 5 — Recap / RSS / health | 15–17 | `recap.mjs` weekly top-3 story (analytics workflow, `continue-on-error`); `scripts/prerender/generate-rss.mjs` Pinterest feed at deploy; pipeline-health section in the weekly report |

## Deviations from the plan (and why)

These were necessary corrections — the plan's literal code would have failed:

1. **Dropbox probe uses `GET`, not `HEAD`** (Task 6). `dl.dropboxusercontent.com` answers `HEAD` with `content-type: application/json` and no length; only `GET` returns `image/jpeg` + real bytes. The plan's `HEAD` probe would have rejected every valid upload and **blocked all posting**. Probe now does a `GET` (body discarded), with a corrected type check and orphan-cleanup if the probe fails.
2. **`-loop 1` added to the pan-reel ffmpeg input** (Task 9). The crop-based lateral pan's `x='…t…'` expression needs the still held across the timeline; without `-loop 1` it renders a single static frame. Verified by frame-brightness sweep (219→60 across a gradient).
3. **Pan filter carries a seed-derived `span`** (Task 8). The plan's direction-only filter is identical for seeds 42/43 (both `rng() > 0.5`), failing the "varies with seed" test. Travel-extent `span` makes the filter vary for any seed pair.
4. **CI uses `npm test`, not `node --test tests/`** (Task 2). `node --test tests/` (trailing-slash dir) throws `MODULE_NOT_FOUND` on Node 22 — it would have failed the pre-flight gate and blocked posting. Project's `npm test` (`node --test tests/*.test.mjs`) is the working invocation.
5. **Carousel "caps at one per artist" test asserts `<= 1`** (Task 13), not `=== 1`. The shuffle+slice can drop the deduped survivor; the real invariant is an upper bound (verified additionally with an all-distinct-artists assertion).
6. **Analytics workflow gained `npm ci` + fonts** (Task 15). `recap.mjs` renders story cards via node-canvas, which the analytics job didn't install.

Branched off `main` (not `develop` — `develop` was ~170 commits stale and missing all IG-poster code).

## Deferred — owner / live actions

- **Live dispatch verification** (post to `@arttok.art`): `gh workflow run instagram-post.yml -f mode=story`, `-f mode=pan-reel-trial`, `-f mode=carousel`, then `gh run watch`. Confirms the canvas prebuild + pre-flight + GET-probe path on the runner.
- **Pinterest**: create a Business account, claim the site, connect `https://<site>/feed.xml` → one board. Pin links need the SPA `404.html` fallback (separate web plan).
- **Pan-reel rollout**: run 3–4 `pan-reel-trial`s over a week; if watch-through beats card reels, flip `--pan` to opt-out.
