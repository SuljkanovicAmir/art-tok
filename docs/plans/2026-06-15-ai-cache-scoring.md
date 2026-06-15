# AI Cache Scoring — In-Session Claude (Sonnet) Curator

**Created:** 2026-06-15
**Status:** Deterministic plumbing BUILT 2026-06-15 (deliverables 1–5 below, tests green: 58/58). Remaining work = the in-session scoring run (download → calibrate → fan out → merge), to do in a fresh **Sonnet** session.
**Goal:** Have Claude (in-session, via subagents) rate each `image-cache.json` entry 1–10 for visual quality + Instagram fit, write the scores back, and let the poster prefer/prune by score. No external API — uses Claude Code usage instead of a Gemini/Claude API key.

---

## Why this shape

- **Scoring is high-volume (220 entries) and visual** → can't eyeball 220 in one linear context (images stay in context and bloat it). Solution: **fan out to subagents**, each with a fresh context scoring a batch.
- **Correctness-first** (user's explicit requirement: "only if they rate it correctly"): a **calibration gate** scores ONE batch first and verifies the rubric produces sane scores before committing to the full run.
- **Deterministic parts in Node, AI parts in-session.** A node script can't spawn Claude subagents, so the work splits:
  - **Node** (`score-cache.mjs`): download images locally (downscaled), merge scores back into `image-cache.json`, report status, optional prune. No AI.
  - **Claude session**: dispatch subagents to score batches, collect JSON, hand to the node merge step.

---

## Current state (verified 2026-06-15)

- `image-cache.json`: **220 entries, 0 scored.** Every entry has `imageUrl` (Dropbox direct link).
- Cache entry shape includes: `source, id, title, artist, imageUrl, medium, culture, dated, classification, description, museumName, width, height, aspect, tags, skip`.
- `lib/cache.mjs` `getAvailable()` / `pickCached()` / `pickThemedSet()` already filter `skip` + posted. Score filtering hooks in here.

---

## Deliverables

### 1. `scripts/instagram-poster/SCORING_RUBRIC.md` (new — canonical rubric)
The exact text every scoring subagent reads, so scores are consistent. Full content in the **Rubric** section below. Create this file verbatim.

### 2. `scripts/instagram-poster/score-cache.mjs` (new — deterministic helper)

CLI:

- `node score-cache.mjs --download`
  - Reads `image-cache.json`, selects entries **without** `aiScore` (idempotent / resumable).
  - Downloads each `imageUrl` and **downscales to ≤1024px longest edge, JPEG q80** (use the existing `canvas` dep — `loadImage` + a resized `createCanvas` → `toBuffer('image/jpeg', {quality:0.8})`). Downscaling is critical: cuts agent token cost ~4–8× and speeds scoring with zero loss for grading.
  - Writes files to `scripts/instagram-poster/temp/scoring/<source>-<id>.jpg`.
  - Writes `temp/scoring/manifest.json`: an array of `{ key, localPath, title, artist, medium, culture, dated, classification }` for every downloaded (unscored) entry. **No `description`** (keep the agent focused on the image; metadata is light context only).
  - Skips downloads that already exist on disk. Pause ~1s between Dropbox fetches (be polite; Dropbox is lenient but no need to hammer).
  - Prints: downloaded N, skipped M (already local), total unscored.

- `node score-cache.mjs --apply temp/scoring/scores.json`
  - `scores.json` = array of `{ key, score, breakdown:{visual,composition,quality,igFit}, note }`.
  - Merges by `key` (`<source>:<id>`) into `image-cache.json`, setting:
    `aiScore` (number), `aiScoreBreakdown` (object), `aiScoreNote` (string), `aiScoredAt` (YYYY-MM-DD), `aiScoredBy` (`"claude-sonnet-4-6"`).
  - **Crash-safe:** write to a temp file then rename, or write after each merge. Validate each score is 1–10 integer; skip + warn on malformed.
  - Prints: applied N, skipped (bad/unknown key) M.

- `node score-cache.mjs --status`
  - Prints scored / unscored counts and a score histogram (1–10 buckets), plus mean.

- `node score-cache.mjs --prune --min <N>` (optional, **non-destructive**)
  - Sets `skip: true` on entries with `aiScore < N` (reversible — does NOT delete). Prints how many newly skipped. Default `--min 6` if flag omitted but `--prune` given.

### 3. `lib/cache.mjs` — score-aware selection (additive, backward-compatible)

- Add an optional `minScore` param to `getAvailable(entries, historySet, source, { minScore } = {})`. When set, also require `e.aiScore == null || e.aiScore >= minScore` (treat **unscored as eligible** so the pipeline never starves if scoring is incomplete — log/skip is the explicit reject path).
- Thread an optional `minScore` through `pickCached()` and `pickThemedSet()` the same way (unscored = eligible).
- **Do not change defaults.** Callers in `post.mjs` opt in later. This keeps posting behavior identical until you choose a threshold.

### 4. Tests (`scripts/instagram-poster/tests/score-cache.test.mjs`)
- `--apply` merges by key, sets all fields, ignores unknown keys, rejects out-of-range scores.
- `getAvailable`/`pickCached` with `minScore`: filters low scores, keeps unscored, keeps high. Run with `npm test` (suite is green — don't expect red).

### 5. `.gitignore`
Add `scripts/instagram-poster/temp/` (downloaded images + manifest + scores are throwaway). `image-cache.json` itself **is** committed (scores persist there).

---

## Execution order (fresh Sonnet session)

> Start the session, switch model to **Sonnet** (`/model sonnet`). Open this file first.

1. ~~**Build** deliverables 1–5.~~ **DONE 2026-06-15** — `SCORING_RUBRIC.md`, `score-cache.mjs`, `cache.mjs` `minScore` hooks, `tests/score-cache.test.mjs`, `.gitignore` all built; `node --test tests/*.test.mjs` green (58/58). Just start at step 2.
2. **Download:** `node score-cache.mjs --download`. Confirm `temp/scoring/manifest.json` has ~220 entries and images are on disk + downscaled.
3. **Calibration gate (the "rate it correctly" check):**
   - Take the **first 15** manifest entries. Dispatch **one** `general-purpose` (Sonnet) subagent with: the full `SCORING_RUBRIC.md` text + the 15 local image paths + their light metadata. Instruct it to **Read every image** and return a strict JSON array (schema below), nothing else.
   - When it returns, **the orchestrator (you) Reads those same 15 images yourself** and spot-checks: are obvious duds scored low, are vivid sharp works scored high, are scores spread (not all 7s)? 
   - Present a short table to the user (key, score, your agreement). **Only proceed if the user confirms the rubric is rating correctly.** If not, tune the rubric anchors and re-run calibration.
4. **Full fan-out:** split the remaining ~205 into batches of **~20**. Dispatch subagents **in parallel** (multiple Agent calls per message; cap ~6–8 in flight). Each agent: identical rubric, its batch's image paths + metadata, returns strict JSON array. Collect all arrays.
   - Use the **same canonical rubric file** in every prompt — never paraphrase it per-agent (consistency is what makes cross-batch scores comparable).
   - If an agent returns malformed JSON or skips images, re-dispatch that batch.
5. **Merge:** concatenate all JSON → `temp/scoring/scores.json` → `node score-cache.mjs --apply temp/scoring/scores.json`.
6. **Review:** `node score-cache.mjs --status`. Show the user the histogram. Discuss a prune threshold (likely 5 or 6).
7. **Prune (optional, user decides):** `node score-cache.mjs --prune --min 6`.
8. **Wire-in (optional follow-up):** in `post.mjs`, pass `{ minScore: 6 }` to the pick calls so posting prefers high-scorers. Leave defaulted off until the user okays it.
9. **Docs + memory:** create `docs/2026-06-15-ai-cache-scoring.md` (what shipped) and update `memory/MEMORY.md` + a new memory file. Commit (branch off, PR — never push `main` directly).

---

## Subagent output schema (strict)

Each scoring agent returns **only** this JSON array, no prose:

```json
[
  {
    "key": "harvard:230411",
    "score": 8,
    "breakdown": { "visual": 8, "composition": 7, "quality": 9, "igFit": 8 },
    "note": "Vivid, sharp; strong diagonal composition reads well at thumbnail size."
  }
]
```

- `key` must exactly equal the manifest `key`.
- `score` integer 1–10 (the holistic score, **not** the average of the breakdown — see hard caps).
- `note` ≤ 140 chars, why it got that score.

---

## Rubric (becomes `SCORING_RUBRIC.md` verbatim)

> You are grading a public-domain painting for posting to the Instagram account **@arttok.art** (gallery-label aesthetic, paintings only, dark minimal feed). Read the image and score it for how well it works as a standalone Instagram art post. Metadata is light context only — **judge the image you see**, not the description.
>
> **Score each dimension 1–10:**
>
> - **visual** — Color vibrancy, contrast, light. Would it stop a scroll? Flat/muddy/washed-out = low; rich and luminous = high.
> - **composition** — Clear focal point, balance, framing. Awkward crop or cluttered/aimless = low; striking and intentional = high.
> - **quality** — Reproduction quality of *this scan*: sharpness, no heavy yellowing/glare/cracking/damage, not a faded or low-res capture. A great painting in a bad scan scores low here.
> - **igFit** — Does it read at thumbnail size and suit a curated art feed? Subtle works that turn to mush when small = low; bold legible images = high.
>
> **Holistic `score` (1–10), with HARD CAPS (these override the average):**
> - If `quality ≤ 3` → `score ≤ 4` (an unpostable scan can't be saved by a good composition).
> - If `visual ≤ 3` AND `igFit ≤ 4` → `score ≤ 4` (too dull to stop a scroll).
> - Otherwise weight roughly: visual 35%, igFit 30%, composition 20%, quality 15%, then round.
>
> **Anchors:**
> - **9–10** — Scroll-stopping: vivid, sharp, striking composition. Instantly postable as a hero image.
> - **7–8** — Strong, clearly postable. Good color/comp, clean scan, reads well small.
> - **5–6** — Acceptable but unremarkable. Fine to post in rotation; nothing special.
> - **3–4** — Weak: muddy/faded color, awkward crop, dull subject, or a so-so scan.
> - **1–2** — Unpostable: damaged/blurry/heavily yellowed scan, or visually inert.
>
> **Calibrate to a spread** — most museum works are 5–7; reserve 9–10 for genuine standouts and 1–2 for true rejects. Do not cluster everything at 7.
>
> Read **every** image in your batch. Return only the JSON array described in the task. No commentary.

---

## Cost / scale notes

- Downscaled images (≤1024px) ≈ 800–1,200 tokens each. 220 images ≈ 200–260K image tokens total, spread across ~11 batch-agents → each agent context stays small and fast.
- Parallel dispatch (~6–8 in flight) means the full run is minutes, not hours. "Leave it running" is comfortable headroom.
- Idempotent throughout: `--download` and the manifest only include unscored entries, so a crashed run resumes cleanly. Re-running the curator later adds new unscored entries; just re-run this flow on the delta.

---

## Open decisions for the session (surface to user)

1. **Prune threshold** — skip `< 5` (aggressive) vs `< 6` (lenient). Recommend showing the histogram first, then deciding.
2. **Haiku vs Sonnet for the bulk batches** — Sonnet for taste (recommended). Could drop to Haiku for cheaper bulk *after* calibration confirms the rubric is robust, if cost matters. Calibration should stay on Sonnet.
3. **Wire `minScore` into `post.mjs` now or later** — recommend later, after a week of watching that high-scorers actually outperform in analytics.
