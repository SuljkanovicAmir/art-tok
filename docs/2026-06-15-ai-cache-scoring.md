# AI Cache Scoring — Run Results (2026-06-15)

Executed the in-session Claude (Sonnet) scoring run planned in
[docs/plans/2026-06-15-ai-cache-scoring.md](plans/2026-06-15-ai-cache-scoring.md).
Deterministic plumbing was already built (see that plan); this doc records the
actual scoring run and its outcome.

## What ran

1. **Download** — `node score-cache.mjs --download` pulled all 214 unscored
   `image-cache.json` entries, downscaled each to ≤1024px JPEG q80 into
   `temp/scoring/`, and wrote `temp/scoring/manifest.json` (214 entries).
   (220 total cache entries; 6 were already scored/skipped.)
2. **Scoring fan-out** — 11 `general-purpose` Sonnet subagents, ~20 images each,
   dispatched in parallel. Each read `SCORING_RUBRIC.md` verbatim + its batch's
   local images and returned strict JSON `{key, score, breakdown, note}`.
   The calibration batch (first 15) used the same rubric as the rest; the
   approval pause was skipped per request and all 214 were scored in one pass.
3. **Merge** — concatenated to `temp/scoring/scores.json` →
   `node score-cache.mjs --apply` → 214 applied, 0 malformed.
4. **Prune** — `node score-cache.mjs --prune --min 5` set `skip:true` on the 81
   entries scoring < 5 (reversible).

## Result

- **Mean score 5.20**, clean spread (no clustering at 7):

  | score | count |
  |------:|------:|
  | 9 | 9 |
  | 8 | 20 |
  | 7 | 44 |
  | 6 | 32 |
  | 5 | 28 |
  | 4 | 26 |
  | 3 | 20 |
  | 2 | 33 |
  | 1 | 2 |

- After prune: **133 available** (all scored 5–9: 28×5, 32×6, 44×7, 20×8, 9×9),
  **87 `skip:true`** (81 newly pruned + 6 pre-existing).
- The 1–2 band (35 entries) was almost entirely B&W archival photographs,
  frame-in-shot catalogue captures, and heavily damaged/yellowed scans — i.e.
  genuinely unpostable, not just weak art. The rubric's quality hard-cap did the
  heavy lifting here.

## Standouts (score 9)

Cornelis de Heem still life, Moreau *Saint Sebastian*, Monet *House of the
Customs Officer*, Sargent *The Breakfast Table*, Jan van Huysum floral still
life, Moran *Venice*, Rossetti *A Sea-Spell*, Burne-Jones *Pan and Psyche*,
Miró *Ciphers and Constellations*.

## Not done (deferred)

- **Wiring `minScore` into `post.mjs`** — left off. `lib/cache.mjs` already
  accepts `{ minScore }` (unscored = eligible) but `post.mjs` callers don't pass
  it yet. Recommend enabling after ~1 week of analytics confirms high-scorers
  actually outperform. The prune already biases selection toward quality via
  `skip:true`, so this is additive, not required.

## Re-running on new cache entries

The flow is idempotent: `curator.mjs` adds new unscored entries over time;
re-run `--download` (only pulls unscored) → fan out the delta → `--apply` →
optional `--prune`. `temp/` is gitignored; `image-cache.json` carries the
scores and is committed.
