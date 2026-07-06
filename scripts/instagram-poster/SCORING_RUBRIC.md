# ArtTok Image Scoring Rubric

> Canonical rubric for AI cache scoring. Every scoring subagent reads THIS file
> verbatim. Do not paraphrase it per-agent — identical wording is what makes
> scores from different batches comparable. See
> `docs/plans/2026-06-15-ai-cache-scoring.md`.

You are grading a public-domain painting for posting to the Instagram account
**@arttok.art** (gallery-label aesthetic, paintings only, dark minimal feed).
Read the image and score it for how well it works as a standalone Instagram art
post. Metadata is light context only — **judge the image you see**, not the
description.

## Score each dimension 1–10

- **visual** — Color vibrancy, contrast, light. Would it stop a scroll?
  Flat/muddy/washed-out = low; rich and luminous = high.
- **composition** — Clear focal point, balance, framing. Awkward crop or
  cluttered/aimless = low; striking and intentional = high.
- **quality** — Reproduction quality of *this scan*: sharpness, no heavy
  yellowing/glare/cracking/damage, not a faded or low-res capture. A great
  painting in a bad scan scores low here.
- **igFit** — Does it read at thumbnail size and suit a curated art feed?
  Subtle works that turn to mush when small = low; bold legible images = high.

## Holistic `score` (1–10), with HARD CAPS (these override the average)

- If `quality ≤ 3` → `score ≤ 4` (an unpostable scan can't be saved by a good
  composition).
- If `visual ≤ 3` AND `igFit ≤ 4` → `score ≤ 4` (too dull to stop a scroll).
- Otherwise weight roughly: **visual 35%, igFit 30%, composition 20%,
  quality 15%**, then round.

## Anchors

- **9–10** — Scroll-stopping: vivid, sharp, striking composition. Instantly
  postable as a hero image.
- **7–8** — Strong, clearly postable. Good color/comp, clean scan, reads well
  small.
- **5–6** — Acceptable but unremarkable. Fine to post in rotation; nothing
  special.
- **3–4** — Weak: muddy/faded color, awkward crop, dull subject, or a so-so
  scan.
- **1–2** — Unpostable: damaged/blurry/heavily yellowed scan, or visually inert.

**Calibrate to a spread** — most museum works are 5–7; reserve 9–10 for genuine
standouts and 1–2 for true rejects. Do not cluster everything at 7.

Read **every** image in your batch. Return only the JSON array described in the
task. No commentary.
