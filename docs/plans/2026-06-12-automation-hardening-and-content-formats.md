# Automation Hardening + New Content Formats — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Instagram pipeline fail loudly and recover safely, then add the reach-driving formats (pan/zoom reels, trial reels, focused hashtags + Wikipedia context, themed carousels, weekly recap story, Pinterest RSS) — each behind a fallback to the proven posting path.

**Architecture:** Three layers. (1) Workflow hardening: alerts, concurrency, idempotency, race-proof state commits — pure YAML + one guard function. (2) Posting safety in `scripts/instagram-poster/`: history written at the moment of publish, Dropbox URL pre-probe, try/finally cleanup, reel retry parity. (3) New formats as new `lib/` modules with pure, testable planning functions (motion planning, set picking, tag building) and thin ffmpeg/Graph-API shells; every new format falls back to the current image-post path so the worst case of any failure is today's behavior.

**Tech Stack:** Node 20+ ESM, `node:test` (existing pattern in `scripts/instagram-poster/tests/`), ffmpeg (zoompan/crop filters), Meta Graph API (containers, `trial_params`, CAROUSEL), Dropbox API, GitHub Actions.

**Verification baseline before starting:** `cd scripts/instagram-poster && node --test tests/` → 27 tests pass.

---

## Phase 0 — Workflows fail loudly and can't race (YAML only, no posting-logic risk)

### Task 1: Fix the analytics workflow (broken for 5+ weeks)

**Files:**
- Modify: `.github/workflows/instagram-analytics.yml`

**Step 1: Add permissions and fix the commit chain**

Replace the full file with:

```yaml
name: Instagram Weekly Analytics

on:
  schedule:
    - cron: "0 9 * * 1"  # Every Monday at 09:00 UTC
  workflow_dispatch:

permissions:
  contents: write
  issues: write

concurrency:
  group: ig-state
  cancel-in-progress: false

jobs:
  analytics:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-node@v5
        with:
          node-version: 22

      - name: Run analytics
        working-directory: scripts/instagram-poster
        env:
          INSTAGRAM_ACCESS_TOKEN: ${{ secrets.INSTAGRAM_ACCESS_TOKEN }}
          INSTAGRAM_USER_ID: ${{ secrets.INSTAGRAM_USER_ID }}
        run: node analytics.mjs

      - name: Commit report
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add docs/analytics/
          git diff --staged --quiet && exit 0
          git commit -m "docs: weekly Instagram analytics report"
          for i in 1 2 3; do git push && exit 0; git pull --rebase origin main; done
          exit 1

      - name: Alert on failure
        if: failure()
        env:
          GH_TOKEN: ${{ github.token }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: |
          EXISTING=$(gh issue list --label automation-failure --state open --json number --jq '.[0].number' || true)
          if [ -n "$EXISTING" ]; then
            gh issue comment "$EXISTING" -b "Analytics run failed: $RUN_URL"
          else
            gh issue create --title "Automation failures" --label automation-failure \
              -b "Analytics run failed: $RUN_URL"
          fi
```

Key fixes: missing `permissions: contents: write` (the 403 root cause), `(a || b) && c` precedence bug, no Node-20-deprecated actions, rebase-retry push, failure alert.

**Step 2: Create the label (one-time)**

Run: `gh label create automation-failure --color B60205 --description "Automated pipeline failure alerts" -R SuljkanovicAmir/art-tok`
Expected: label created (or "already exists" — fine).

**Step 3: Verify YAML parses**

Run: `npx --yes yaml-lint .github/workflows/instagram-analytics.yml` (or open in editor — VS Code validates GH Actions schema).
Expected: no errors.

**Step 4: Commit**

```bash
git add .github/workflows/instagram-analytics.yml
git commit -m "fix(ci): analytics workflow permissions, push retry, failure alerts"
```

**Step 5: After this lands on main, manually dispatch the workflow and confirm a green run + committed report**

Run: `gh workflow run instagram-analytics.yml -R SuljkanovicAmir/art-tok` then `gh run watch`.
Expected: green run; new file under `docs/analytics/`.

---

### Task 2: Harden the post workflow

**Files:**
- Modify: `.github/workflows/instagram-post.yml`

**Step 1: Apply all hardening in one edit**

Replace the full file with:

```yaml
name: Instagram Auto-Post

on:
  schedule:
    # UTC. Local CET in winter: 08/11/15/18/21. In summer (CEST) these land 1h later — accepted.
    - cron: "0 7,10,14,17,20 * * *"
  workflow_dispatch:
    inputs:
      mode:
        description: "Post type (auto = follows mode cycle)"
        required: false
        default: "auto"
        type: choice
        options:
          - auto
          - post
          - story
          - reel
          - pan-reel-trial
          - seasonal-post
          - seasonal-reel

permissions:
  contents: write
  issues: write

concurrency:
  group: ig-state
  cancel-in-progress: false

jobs:
  post:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: scripts/instagram-poster/package-lock.json

      # node-canvas ships prebuilt linux-x64 binaries; only fonts + ffmpeg are needed.
      - name: Install system deps
        run: |
          sudo apt-get update
          sudo apt-get install -y fonts-liberation fonts-dejavu ffmpeg

      - name: Install npm dependencies
        working-directory: scripts/instagram-poster
        run: npm ci

      - name: Pre-flight tests
        working-directory: scripts/instagram-poster
        run: node --test tests/

      - name: Post to Instagram
        working-directory: scripts/instagram-poster
        env:
          INSTAGRAM_ACCESS_TOKEN: ${{ secrets.INSTAGRAM_ACCESS_TOKEN }}
          INSTAGRAM_USER_ID: ${{ secrets.INSTAGRAM_USER_ID }}
          META_APP_ID: ${{ secrets.META_APP_ID }}
          META_APP_SECRET: ${{ secrets.META_APP_SECRET }}
          FACEBOOK_PAGE_ID: ${{ secrets.FACEBOOK_PAGE_ID }}
          DROPBOX_REFRESH_TOKEN: ${{ secrets.DROPBOX_REFRESH_TOKEN }}
          DROPBOX_APP_KEY: ${{ secrets.DROPBOX_APP_KEY }}
          DROPBOX_APP_SECRET: ${{ secrets.DROPBOX_APP_SECRET }}
          HARVARD_API_KEY: ${{ secrets.VITE_HARVARD_API_KEY }}
          MODE: ${{ inputs.mode }}
        run: |
          case "$MODE" in
            post)           node post.mjs --post ;;
            story)          node post.mjs --story ;;
            reel)           node post.mjs --reel ;;
            pan-reel-trial) node post.mjs --reel --pan --trial ;;
            seasonal-post)  node post.mjs --seasonal ;;
            seasonal-reel)  node post.mjs --seasonal --reel ;;
            *)              node post.mjs ;;
          esac

      - name: Commit updated state
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add scripts/instagram-poster/posted-history.json \
                  scripts/instagram-poster/post-quality-log.json \
                  scripts/instagram-poster/image-cache.json
          git diff --staged --quiet && exit 0
          git commit -m "chore: update posted history + quality log"
          for i in 1 2 3; do git push && exit 0; git pull --rebase origin main; done
          exit 1

      - name: Alert on failure
        if: failure()
        env:
          GH_TOKEN: ${{ github.token }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: |
          EXISTING=$(gh issue list --label automation-failure --state open --json number --jq '.[0].number' || true)
          if [ -n "$EXISTING" ]; then
            gh issue comment "$EXISTING" -b "Post run failed: $RUN_URL"
          else
            gh issue create --title "Automation failures" --label automation-failure \
              -b "Post run failed: $RUN_URL"
          fi
```

Notes: `--pan`/`--trial` flags don't exist yet (Phase 2) — `case` branch is forward-compatible and unreachable until then; `mode=post` previously fell through to the auto cycle (bug); `MODE` now passes through `env:` (no shell injection surface); `image-cache.json` added to the commit list (Phase 1 Task 7 starts mutating it).

**Step 2: Commit**

```bash
git add .github/workflows/instagram-post.yml
git commit -m "fix(ci): post workflow concurrency, npm ci, pre-flight tests, alerts, push retry"
```

**Step 3: Dispatch a `story` run end-to-end and confirm green**

Run: `gh workflow run instagram-post.yml -f mode=story -R SuljkanovicAmir/art-tok && gh run watch`
Expected: green; story appears on the account; state commit lands.

---

### Task 3: Sweep remaining workflows + .gitignore

**Files:**
- Modify: `.github/workflows/deploy.yml` (actions v5, add `workflow_dispatch:` trigger)
- Modify: `.github/workflows/test-image-servers.yml` (actions v5, add `permissions: {}`, delete the unused `HARVARD_API_KEY` env block)
- Modify: `.gitignore`

**Step 1: deploy.yml** — change `actions/checkout@v4`→`@v5`, `actions/setup-node@v4`→`@v5`, `actions/upload-pages-artifact@v3`→`@v4`, and add `workflow_dispatch:` under `on:`.

**Step 2: test-image-servers.yml** — same version bumps; add top-level `permissions: {}`; remove the `HARVARD_API_KEY` env line (references a nonexistent secret name and is never used).

**Step 3: .gitignore** — append:

```
scripts/instagram-poster/arttok-*.jpg
scripts/instagram-poster/tmp/
.claude/
.claude-flow/
.swarm/
coverage/
```

**Step 4: Commit**

```bash
git add .github/workflows/deploy.yml .github/workflows/test-image-servers.yml .gitignore
git commit -m "chore(ci): bump actions, least-privilege perms, gitignore tooling dirs"
```

---

## Phase 1 — Posting safety (one run can't corrupt state; re-runs can't double-post)

### Task 4: Idempotency guard

**Files:**
- Create: `scripts/instagram-poster/lib/run-guard.mjs`
- Test: `scripts/instagram-poster/tests/run-guard.test.mjs`
- Modify: `scripts/instagram-poster/post.mjs` (top of `main()`)

**Step 1: Write the failing test**

```js
// tests/run-guard.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDuplicateRun } from "../lib/run-guard.mjs";

const now = new Date("2026-06-12T15:00:00Z");

test("blocks when last successful post was 30 minutes ago", () => {
  const log = [{ timestamp: "2026-06-12T14:30:00.000Z", mediaId: "123" }];
  assert.equal(isDuplicateRun(log, now), true);
});

test("allows when last post was 3 hours ago (normal schedule gap)", () => {
  const log = [{ timestamp: "2026-06-12T12:00:00.000Z", mediaId: "123" }];
  assert.equal(isDuplicateRun(log, now), false);
});

test("allows on empty log", () => {
  assert.equal(isDuplicateRun([], now), false);
});

test("ignores entries without mediaId (dry runs never log, but be safe)", () => {
  const log = [{ timestamp: "2026-06-12T14:55:00.000Z" }];
  assert.equal(isDuplicateRun(log, now), false);
});
```

**Step 2: Run it** — `node --test tests/run-guard.test.mjs` → FAIL (module not found).

**Step 3: Implement**

```js
// lib/run-guard.mjs
const WINDOW_MINUTES = 90; // schedule gap is 180 min; anything closer is a re-run/overlap

export function isDuplicateRun(qualityLog, now = new Date()) {
  const last = [...qualityLog].reverse().find((e) => e.mediaId && e.timestamp);
  if (!last) return false;
  const ageMin = (now - new Date(last.timestamp)) / 60000;
  return ageMin >= 0 && ageMin < WINDOW_MINUTES;
}
```

**Step 4: Run tests** — PASS.

**Step 5: Wire into post.mjs** — in `main()` right after `loadHistoryData` (skip when `DRY_RUN` or `SPECIFIC_ART`):

```js
import { isDuplicateRun } from "./lib/run-guard.mjs";
// ...
if (!DRY_RUN && !SPECIFIC_ART && isDuplicateRun(loadQualityLog(QUALITY_LOG_FILE))) {
  console.log("A post was published within the last 90 minutes — treating this as a duplicate run. Exiting cleanly.");
  return;
}
```

**Step 6: Commit** — `git commit -m "feat(ig-poster): idempotency guard against re-run double-posting"`

---

### Task 5: Write history at the moment of publish + fix wasSeasonal

**Files:**
- Modify: `scripts/instagram-poster/post.mjs:130-265`

**Step 1: Track what was actually fetched.** In the fetch loop, add `let usedSeasonal = false;` before the loop; set `usedSeasonal = true;` immediately after any `fetchSeasonalArtwork` call that returned art (both the `IS_SEASONAL` branch and the `shouldPostSeasonal` branch); reset to `false` when falling back to `fetchRandomArtwork`.

**Step 2: Move state writes to directly after `mediaId` is obtained** (currently steps 7–8 run first). New order after the publish block:

```js
  // 7. Record state IMMEDIATELY — first-comment and auto-story are decoration;
  //    a crash there must not leave a live post unrecorded.
  const wasSeasonal = usedSeasonal && SPECIFIC_ART === null;
  historyData.posted.push(artKey(art));
  historyData.postsSinceLastSeasonal = wasSeasonal ? 0 : historyData.postsSinceLastSeasonal + 1;
  historyData.runIndex = (historyData.runIndex + 1) % MODE_CYCLE.length;
  saveHistoryData(HISTORY_FILE, historyData);

  const qualityLog = loadQualityLog(QUALITY_LOG_FILE);
  qualityLog.push(buildQualityEntry(art, {
    mode, caption, cardSizeKB: pngBuffer.length / 1024, mediaId, wasSeasonal,
  }));
  saveQualityLog(QUALITY_LOG_FILE, qualityLog);

  // 8. First comment with hashtags (not for stories)
  if (mode !== "story") await postFirstComment(token, mediaId, hashtags);

  // 9. Auto-story (not if already a story)
  if (mode !== "story") await publishAutoStory(token, art, null);
```

Delete the old steps 7–11 this replaces. Keep any existing trailing log lines.

**Step 3: Verify with dry run** — `node post.mjs --dry-run` → unchanged behavior (dry run returns before this code).

**Step 4: Commit** — `git commit -m "fix(ig-poster): record history at publish time; wasSeasonal reflects actual art source"`

---

### Task 6: Dropbox safety — pre-probe, honest deletes, try/finally cleanup

**Files:**
- Modify: `scripts/instagram-poster/lib/dropbox.mjs`
- Modify: `scripts/instagram-poster/post.mjs` (story/post publish blocks)
- Modify: `scripts/instagram-poster/lib/instagram-api.mjs` (`publishReel`)
- Test: `scripts/instagram-poster/tests/dropbox.test.mjs`

**Step 1: Write failing tests for the pure URL transform** (extract it first — it's currently inline at dropbox.mjs:86-89):

```js
// tests/dropbox.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { toDirectUrl } from "../lib/dropbox.mjs";

test("rewrites www.dropbox.com host and dl param", () => {
  assert.equal(
    toDirectUrl("https://www.dropbox.com/scl/fi/abc/x.jpg?rlkey=k&dl=0"),
    "https://dl.dropboxusercontent.com/scl/fi/abc/x.jpg?rlkey=k&dl=1",
  );
});

test("handles dl=0 as first query param", () => {
  assert.equal(
    toDirectUrl("https://www.dropbox.com/scl/fi/abc/x.jpg?dl=0"),
    "https://dl.dropboxusercontent.com/scl/fi/abc/x.jpg?dl=1",
  );
});

test("idempotent on already-direct URLs", () => {
  const direct = "https://dl.dropboxusercontent.com/scl/fi/abc/x.jpg?rlkey=k&dl=1";
  assert.equal(toDirectUrl(direct), direct);
});
```

**Step 2: Run** → FAIL (`toDirectUrl` not exported).

**Step 3: Implement in dropbox.mjs** — extract the existing inline logic verbatim into:

```js
export function toDirectUrl(shareUrl) {
  return shareUrl
    .replace("www.dropbox.com", "dl.dropboxusercontent.com")
    .replace("?dl=0", "?dl=1")
    .replace("&dl=0", "&dl=1");
}
```

…and call it where the inline code was. Run tests → PASS.

**Step 4: Add the pre-probe.** In dropbox.mjs, after the share URL is built in `uploadToDropbox`/`uploadImage`:

```js
export async function probeDirectUrl(url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      const type = res.headers.get("content-type") || "";
      const len = Number(res.headers.get("content-length") || 0);
      if (res.ok && type.startsWith("image/") || type.startsWith("video/")) {
        if (len > 1000) return;
      }
      console.warn(`Direct-URL probe ${i}/${attempts}: status=${res.status} type=${type} len=${len}`);
    } catch (err) {
      console.warn(`Direct-URL probe ${i}/${attempts} error: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, i * 5000));
  }
  throw new Error("Dropbox direct URL not fetchable — aborting before Meta container creation");
}
```

Call `await probeDirectUrl(directUrl)` before returning from the upload functions. This converts the Meta-9004 class (media fetch failure at publish time) into an early, retryable, clearly-logged failure.

**Step 5: Honest deletes** — in `deleteFromDropbox`, after the fetch: `if (!res.ok) console.warn(\`Dropbox delete failed (${res.status}) for ${path}\`); else console.log(...)` — stop logging success unconditionally.

**Step 6: try/finally cleanup.** In post.mjs story and post blocks:

```js
const { url: publicUrl, path: dropboxPath, token: dropboxToken } = await uploadImage(pngBuffer);
try {
  mediaId = await publishToInstagram(token, publicUrl, caption, { altText });
} finally {
  await deleteFromDropbox(dropboxPath, dropboxToken);
}
```

Same pattern in `publishReel` (instagram-api.mjs:149-210): wrap everything after the upload in try/finally with the delete in finally.

**Step 7: Run all tests** — `node --test tests/` → PASS. **Commit** — `git commit -m "feat(ig-poster): Dropbox URL pre-probe, try/finally cleanup, honest delete logging"`

---

### Task 7: Reel resilience + retry-parity

**Files:**
- Modify: `scripts/instagram-poster/lib/instagram-api.mjs`
- Modify: `scripts/instagram-poster/post.mjs`
- Modify: `scripts/instagram-poster/lib/fetch.mjs`

**Step 1: Video-appropriate polling.** `publishReel` line 187: `waitForContainer(token, containerId, 30)` → `waitForContainer(token, containerId, 60, 5000)`. Add the interval param to `waitForContainer`:

```js
export async function waitForContainer(token, containerId, maxAttempts = 10, intervalMs = 3000) {
  // ... existing loop, but: await new Promise((r) => setTimeout(r, intervalMs));
```

Also request richer status: `fields=status_code,status` and include `data.status` in the ERROR throw.

**Step 2: 9007 retry for reel publish.** Replace the single publish call in `publishReel` (lines 190-205) with the same 5-attempt loop `publishToInstagram` uses (copy lines 55-81, adjusting log text). DRY note: extract a shared `publishContainer(token, containerId)` helper used by both.

**Step 3: Reel-slot fallback in post.mjs.** In the mode-publish block:

```js
if (mode === "reel") {
  try {
    console.log("Creating reel video...");
    const videoBuffer = await createReelVideo(art, pngBuffer);
    console.log("Publishing reel...");
    mediaId = await publishReel(token, videoBuffer, caption);
  } catch (err) {
    console.warn(`Reel failed (${err.message}) — falling back to image post so the slot isn't lost`);
    const prepped = await prepareFeedImage(art.imageBuffer || art.imageUrl); // may throw AspectOutOfRange — acceptable, run fails as before
    const { url, path, token: dbx } = await uploadImage(prepped.buffer);
    try {
      mediaId = await publishToInstagram(token, url, buildCaption(art, "post"), { altText });
    } finally {
      await deleteFromDropbox(path, dbx);
    }
    mode = "post"; // so quality log + first comment behave like a post
  }
}
```

(Make `mode` a `let`. Because Task 5 advances `runIndex` after *any* publish, a deterministic reel failure now costs one reel, not all future slots.)

**Step 4: statusCode on API errors** — fetch.mjs `fetchJson` throw: 

```js
const err = new Error(`HTTP ${res.status} for ${url.split("?")[0]}`);
err.statusCode = res.status;
throw err;
```

(makes the 403/429 source-blacklist in art-fetchers work for API failures, not just image probes).

**Step 5: Misc from audit** — post.mjs:83-86 replace `execSync('mkdir -p ...')` with `mkdirSync(tmpDir, { recursive: true })` (import from `node:fs`); delete the stray `-p` directory: `rmdir "scripts/instagram-poster/-p"`.

**Step 6: Run tests + dry-run reel** — `node --test tests/` PASS; `node post.mjs --reel --dry-run` produces an .mp4. **Commit** — `git commit -m "fix(ig-poster): reel retry parity, video poll budget, reel-slot fallback to post"`

---

## Phase 2 — "Look Closer" pan/zoom reels + trial reels

### Task 8: Motion planner (pure, TDD)

**Files:**
- Create: `scripts/instagram-poster/lib/reel-pan.mjs`
- Test: `scripts/instagram-poster/tests/reel-pan.test.mjs`

**Step 1: Write failing tests**

```js
// tests/reel-pan.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { planPanMotion, DURATION_S, FPS } from "../lib/reel-pan.mjs";

test("portrait painting gets pull-out preset", () => {
  const plan = planPanMotion({ width: 1600, height: 1917, seed: 1 });
  assert.equal(plan.preset, "pullout");
  assert.match(plan.filter, /zoompan/);
  assert.match(plan.filter, /s=1080x1920/);
});

test("landscape painting gets lateral pan via crop (not zoompan)", () => {
  const plan = planPanMotion({ width: 2400, height: 1500, seed: 1 });
  assert.equal(plan.preset, "pan");
  assert.match(plan.filter, /crop=/);
  assert.doesNotMatch(plan.filter, /zoompan/);
});

test("small source falls back to gentle push-in", () => {
  const plan = planPanMotion({ width: 1200, height: 1100, seed: 1 });
  assert.equal(plan.preset, "pushin");
});

test("too-small source returns null (caller falls back to card reel)", () => {
  assert.equal(planPanMotion({ width: 900, height: 700, seed: 1 }), null);
});

test("deterministic for the same seed, varies with seed", () => {
  const a = planPanMotion({ width: 2400, height: 1500, seed: 42 });
  const b = planPanMotion({ width: 2400, height: 1500, seed: 42 });
  const c = planPanMotion({ width: 2400, height: 1500, seed: 43 });
  assert.equal(a.filter, b.filter);
  assert.notEqual(a.filter, c.filter); // direction flips with seed
});
```

**Step 2: Run** → FAIL (module not found).

**Step 3: Implement**

```js
// lib/reel-pan.mjs
// Plans ffmpeg motion for "Look Closer" reels: turn one high-res painting
// into a slow 9:16 drift. Pure function -> filtergraph string; ffmpeg shell
// lives in createPanReel below.

export const DURATION_S = 18;
export const FPS = 30;
const OUT_W = 1080;
const OUT_H = 1920;
const FRAMES = DURATION_S * FPS;

// mulberry32 — same PRNG family used in render.mjs for deterministic art
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function planPanMotion({ width, height, seed }) {
  if (!width || !height) return null;
  const longEdge = Math.max(width, height);
  if (longEdge < 1080) return null; // too small for any motion — card reel instead

  const rng = mulberry32(seed >>> 0);
  const aspect = width / height;

  // Supersample before zoompan so zoom steps have sub-pixel resolution (kills jitter).
  const SS = "scale=4320:-2";

  if (aspect >= 1.25 && width >= 1600) {
    // ── Lateral pan: 9:16 window glides across the canvas. crop is jitter-free.
    const ltr = rng() < 0.5;
    const x = ltr
      ? `(in_w-out_w)*(t/${DURATION_S})`
      : `(in_w-out_w)*(1-t/${DURATION_S})`;
    return {
      preset: "pan",
      filter:
        `scale=-2:3840,crop=2160:3840:x='${x}':y=0,` +
        `scale=${OUT_W}:${OUT_H},fps=${FPS},format=yuv420p`,
    };
  }

  if (longEdge >= 1400) {
    // ── Pull-out reveal: start 2.8x on the upper third, settle on full view.
    const startZoom = 2.8;
    const step = ((startZoom - 1.0) / FRAMES).toFixed(5);
    const fx = (0.35 + rng() * 0.3).toFixed(2); // focus x in [0.35, 0.65]
    const fy = "0.30";                           // upper third — faces live here
    return {
      preset: "pullout",
      filter:
        `${SS},zoompan=` +
        `z='if(lte(on,1),${startZoom},max(1.0,zoom-${step}))'` +
        `:x='iw*${fx}-(iw/zoom)*${fx}'` +
        `:y='ih*${fy}-(ih/zoom)*${fy}'` +
        `:d=${FRAMES}:s=${OUT_W}x${OUT_H}:fps=${FPS},format=yuv420p`,
    };
  }

  // ── Gentle push-in: safe for any aspect/medium resolution.
  const step = (0.4 / FRAMES).toFixed(6);
  return {
    preset: "pushin",
    filter:
      `${SS},zoompan=z='min(1.4,zoom+${step})'` +
      `:x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2'` +
      `:d=${FRAMES}:s=${OUT_W}x${OUT_H}:fps=${FPS},format=yuv420p`,
  };
}
```

**Step 4: Run tests** → PASS. **Step 5: Commit** — `git commit -m "feat(ig-poster): pan-reel motion planner (pullout/pan/pushin presets)"`

---

### Task 9: ffmpeg shell + dry-run flag

**Files:**
- Modify: `scripts/instagram-poster/lib/reel-pan.mjs` (append `createPanReel`)
- Modify: `scripts/instagram-poster/post.mjs` (`--pan` flag, dry-run branch, fallback wiring)

**Step 1: Append the shell to reel-pan.mjs**

```js
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function hashKey(s) {
  let h = 0;
  for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return h >>> 0;
}

/**
 * Render a pan reel from the artwork's source image.
 * @param art         artwork object (needs source, id, imageBuffer or imageUrl already fetched to buffer)
 * @param imageBuffer raw painting JPEG/PNG buffer (NOT the 1080 filtered post image)
 * @param dims        { width, height } of the buffer
 * @param audioPath   mp3 path
 * @throws if no motion plan fits or ffmpeg fails — caller falls back to card reel
 */
export function createPanReel(art, imageBuffer, dims, audioPath) {
  const seed = hashKey(`${art.source}:${art.id}`);
  const plan = planPanMotion({ ...dims, seed });
  if (!plan) throw new Error(`source too small for pan reel (${dims.width}x${dims.height})`);
  console.log(`Pan reel preset: ${plan.preset} (${dims.width}x${dims.height})`);

  const tmpDir = join(__dirname, "..", "tmp");
  mkdirSync(tmpDir, { recursive: true });
  const imgPath = join(tmpDir, `pan-src-${art.source}-${art.id}.jpg`);
  const outPath = join(tmpDir, `pan-reel-${art.source}-${art.id}.mp4`);
  writeFileSync(imgPath, imageBuffer);

  try {
    execFileSync("ffmpeg", [
      "-y", "-i", imgPath, "-i", audioPath,
      "-filter_complex", `[0:v]${plan.filter}[v]`,
      "-map", "[v]", "-map", "1:a",
      "-t", String(DURATION_S),
      "-c:v", "libx264", "-preset", "medium", "-crf", "21",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      outPath,
    ], { stdio: "pipe", timeout: 180000 });

    const video = readFileSync(outPath);
    if (video.length < 100 * 1024) throw new Error(`pan reel suspiciously small (${video.length} bytes)`);
    console.log(`Pan reel created: ${(video.length / 1024 / 1024).toFixed(1)} MB`);
    return video;
  } finally {
    try { unlinkSync(imgPath); } catch { /* ignore */ }
    try { unlinkSync(outPath); } catch { /* ignore */ }
  }
}
```

**Step 2: post.mjs wiring.** Add flags near the others: `const IS_PAN = args.includes("--pan");` and `const IS_TRIAL = args.includes("--trial");`. The reel branch needs the *source image buffer + dims* — get them via `prepareFeedImage`'s sibling: add a tiny helper that probes dimensions with node-canvas `loadImage` (or reuse the cache entry's `width`/`height` when `art` came from cache — both are already on cache entries). Reel creation becomes:

```js
async function createReelVideoAuto(art, cardBuffer) {
  if (IS_PAN) {
    const imageBuffer = art.imageBuffer || Buffer.from(await (await fetch(art.imageUrl)).arrayBuffer());
    const dims = await getImageDims(imageBuffer); // loadImage from canvas — 5 lines
    return createPanReel(art, imageBuffer, dims, pickAudioTrack());
  }
  return createReelVideo(art, cardBuffer);
}
```

and the publish/dry-run branches call `createReelVideoAuto` with a try/catch falling back to `createReelVideo` (log `fallbackFrom: "pan-reel"` — add the field to the quality entry options + `buildQualityEntry` passthrough).

**Step 3: Verify locally** — pick a known cache entry:

Run: `node post.mjs --reel --pan --dry-run`
Expected: `arttok-<source>-<id>-reel.mp4` written; play it — slow drift, no jitter, audio present, 18s.

Repeat 2–3 times (different artworks) and eyeball each preset (portrait → pullout, landscape → pan).

**Step 4: Run all tests** — PASS. **Commit** — `git commit -m "feat(ig-poster): Look Closer pan reels behind --pan flag with card-reel fallback"`

---

### Task 10: Trial reels + cover frame

**Files:**
- Modify: `scripts/instagram-poster/lib/instagram-api.mjs` (`publishReel`)
- Modify: `scripts/instagram-poster/post.mjs` (pass `trial`/`thumbOffsetMs` through)

**Step 1: Extend publishReel signature** — `publishReel(token, videoBuffer, caption, { trial = false, thumbOffsetMs = 17000 } = {})`. In container params:

```js
containerParams.set("thumb_offset", String(thumbOffsetMs)); // grid cover = the full painting at the end
if (trial) containerParams.set("trial_params", JSON.stringify({ trial_type: "STANDARD" }));
```

If container creation fails with `trial_params` mentioned in the error body, retry once *without* it (graceful degradation — trial availability varies by account):

```js
if (trial && body.includes("trial")) {
  console.warn("trial_params rejected — publishing as a normal reel");
  containerParams.delete("trial_params");
  continue; // consumes one attempt of the existing loop
}
```

**Step 2: post.mjs** — `mediaId = await publishReel(token, videoBuffer, caption, { trial: IS_TRIAL });`

**Step 3: Live trial** — dispatch `pan-reel-trial` from Actions (Task 2 added the option):

Run: `gh workflow run instagram-post.yml -f mode=pan-reel-trial && gh run watch`
Expected: green run; reel visible under Profile → Reels → Trial tab, NOT in followers' feed.

**Step 4: Commit** — `git commit -m "feat(ig-poster): trial-reel publishing and end-frame cover offset"`

**Rollout note:** run 3–4 pan-reel trials over a week; compare watch-through (analytics) vs card reels; if better, flip the default in `createReelVideoAuto` (make `--pan` opt-out via `--card-reel`) in a one-line follow-up.

---

## Phase 3 — Caption SEO + Wikipedia context

### Task 11: Focused, metadata-driven hashtags (replaces the 20–25 generic fill)

**Files:**
- Modify: `scripts/instagram-poster/lib/captions.mjs`
- Test: `scripts/instagram-poster/tests/captions.test.mjs`

2026 IG guidance: 3–5 *specific* tags beat 20+ generic ones; keyword-rich caption text is the discovery surface now.

**Step 1: Write failing tests**

```js
// tests/captions.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHashtags, buildCaption } from "../lib/captions.mjs";

const art = {
  source: "harvard", id: 1, title: "The Vanity of the Artist's Dream",
  artist: "Charles Bird King", dated: "1830", culture: "American",
  medium: "Oil and graphite on canvas", museumName: "Harvard Art Museums",
  description: "",
};

test("hashtags are 5-7 focused tags including artist slug and museum", () => {
  const tags = buildHashtags(art, () => 0.5).split(" ");
  assert.ok(tags.length >= 5 && tags.length <= 7, `got ${tags.length}`);
  assert.ok(tags.includes("#charlesbirdking"));
  assert.ok(tags.includes("#harvardartmuseums"));
  assert.ok(tags.includes("#oilpainting"));
});

test("unknown artist gets no artist tag and no crash", () => {
  const tags = buildHashtags({ ...art, artist: "Unknown artist" }, () => 0.5);
  assert.doesNotMatch(tags, /#unknownartist/);
});

test("artist slug skipped when unreasonably long", () => {
  const tags = buildHashtags({ ...art, artist: "Workshop of the Master of the Embroidered Foliage" }, () => 0.5);
  assert.doesNotMatch(tags, /#workshopofthemaster/);
});

test("caption first line block front-loads artist, medium, date (IG SEO)", () => {
  const caption = buildCaption(art, "post", () => 0.9); // rng 0.9 -> no curator note
  const head = caption.split("\n").slice(0, 4).join(" ");
  assert.match(head, /Charles Bird King/);
  assert.match(head, /Oil and graphite on canvas/);
  assert.match(head, /1830/);
});
```

**Step 2: Run** → FAIL (`buildHashtags` doesn't accept rng / counts differ).

**Step 3: Implement.** In captions.mjs:

- Add `rng = Math.random` as last param to `buildHashtags`, `buildCaption`, and use it in `pickRandom`/`pick`/curator-note rolls (fixes the untestable nondeterminism *and* the 1-in-8-vs-comment drift: set the roll to `rng() < 0.33` to match the documented intent).
- Replace the fill logic in `buildHashtags`:

```js
export function buildHashtags(art, rng = Math.random) {
  const tags = [...CORE_TAGS]; // #arttok #fineart #arthistory

  tags.push(MUSEUM_TAGS[art.source] || "#museum");

  // Artist tag — the highest-intent searchers use these
  if (art.artist && art.artist !== "Unknown artist") {
    const slug = art.artist.toLowerCase().replace(/[^a-z]/g, "");
    if (slug.length >= 4 && slug.length <= 24) tags.push(`#${slug}`);
  }

  // One medium tag (was up to 2)
  if (art.medium) {
    const mediumLower = art.medium.toLowerCase();
    for (const [keyword, tag] of Object.entries(MOVEMENT_TAGS)) {
      if (mediumLower.includes(keyword)) { tags.push(tag); break; }
    }
  }

  // One culture tag
  if (art.culture) {
    const clean = art.culture.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (clean.length > 2 && clean.length < 30) tags.push(`#${clean}`);
  }

  return [...new Set(tags)].slice(0, 7).join(" ");
}
```

Delete `ROTATING_TAGS` usage from the build (keep the constant exported for the carousel caption task if wanted, else delete — YAGNI: delete).

- Caption front-load: in the post branch the label already leads with title/artist/details — just ensure the details line precedes `museumName` and includes culture: `if (art.culture) details.push(art.culture);` before the join. (Verifies the test.)

**Step 4: Run tests** → PASS (update the existing dry-run expectations if any test asserted 20+ tags — check `tests/` first; none do today).

**Step 5: Visual check** — `node post.mjs --dry-run` → caption reads as a gallery label, hashtags are ~6 specific tags.

**Step 6: Commit** — `git commit -m "feat(ig-poster): metadata-driven focused hashtags + keyword front-loaded captions"`

---

### Task 12: Wikipedia context line for description-less artworks

**Files:**
- Create: `scripts/instagram-poster/lib/wiki.mjs`
- Test: `scripts/instagram-poster/tests/wiki.test.mjs`
- Modify: `scripts/instagram-poster/lib/captions.mjs` (accept optional `contextLine`), `scripts/instagram-poster/post.mjs` (fetch it, pass it)

**Step 1: Failing tests** (mock `fetch` via the `globalThis.fetch` pattern from `tests/fallback.test.mjs`):

```js
// tests/wiki.test.mjs
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { extractContextSentence } from "../lib/wiki.mjs";

test("accepts a clean biographical sentence", () => {
  const extract = "Charles Bird King was an American portrait artist, best known for his portrayals of Native American leaders.";
  const out = extractContextSentence(extract, "Charles Bird King");
  assert.equal(out, "Charles Bird King was an American portrait artist, best known for his portrayals of Native American leaders.");
});

test("rejects disambiguation pages", () => {
  assert.equal(extractContextSentence("Charles King may refer to:", "Charles King"), null);
});

test("rejects when artist name absent from text", () => {
  assert.equal(extractContextSentence("A completely unrelated article about geology.", "Charles Bird King"), null);
});

test("rejects too-short and too-long sentences", () => {
  assert.equal(extractContextSentence("Charles Bird King painted.", "Charles Bird King"), null);
  assert.equal(extractContextSentence(`Charles Bird King ${"x".repeat(400)}.`, "Charles Bird King"), null);
});
```

**Step 2: Run** → FAIL. **Step 3: Implement**

```js
// lib/wiki.mjs
// Optional caption enrichment: one factual sentence about the artist from
// Wikipedia's REST summary API. STRICTLY best-effort — every failure path
// returns null and the caption simply omits the line.

export function extractContextSentence(extract, artist) {
  if (!extract || /may refer to/i.test(extract)) return null;
  const lastName = artist.split(" ").pop();
  if (!extract.includes(lastName)) return null;
  const sentence = extract.split(/(?<=\.)\s+/)[0]?.trim();
  if (!sentence || sentence.length < 60 || sentence.length > 280) return null;
  return sentence;
}

export async function fetchArtistContext(artist) {
  if (!artist || artist === "Unknown artist") return null;
  try {
    const title = encodeURIComponent(artist.trim().replace(/\s+/g, "_"));
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
      { signal: AbortSignal.timeout(5000), headers: { "User-Agent": "ArtTok/1.0 (art curation bot)" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type !== "standard") return null; // skips disambiguation pages
    return extractContextSentence(data.extract, artist);
  } catch {
    return null;
  }
}
```

**Step 4: Run tests** → PASS.

**Step 5: Wire in.** `buildCaption(art, mode, rng, { contextLine = null } = {})`: in the post branch, when `!desc && contextLine`, emit the same `───────` block with `contextLine` instead. In post.mjs, before building the caption: `const contextLine = cleanDescription(art.description) ? null : await fetchArtistContext(art.artist);`

**Step 6: Dry-run a description-less artwork** — `node post.mjs --art=harvard:213930 --dry-run` → caption shows a one-sentence artist note under the divider. **Commit** — `git commit -m "feat(ig-poster): Wikipedia context line for description-less posts (best-effort)"`

---

## Phase 4 — Themed carousels

### Task 13: Themed set picker (pure, TDD)

**Files:**
- Modify: `scripts/instagram-poster/lib/cache.mjs`
- Test: append to `scripts/instagram-poster/tests/cache.test.mjs` (file exists — check name; if tests live in `fallback.test.mjs`, create `tests/carousel.test.mjs`)

**Step 1: Failing tests**

```js
// tests/carousel.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickThemedSet } from "../lib/cache.mjs";

const entry = (id, over = {}) => ({
  source: "harvard", id, title: `T${id}`, artist: `A${id}`,
  culture: "Dutch", aspect: 0.85, skip: false, tags: [], ...over,
});

test("picks 4 same-orientation entries sharing a culture", () => {
  const entries = [1, 2, 3, 4, 5].map((i) => entry(i));
  const set = pickThemedSet(entries, new Set(), { size: 4, rng: () => 0 });
  assert.equal(set.length, 4);
  assert.ok(set.every((e) => e.culture === "Dutch"));
});

test("never mixes portrait and landscape orientations", () => {
  const entries = [entry(1), entry(2), entry(3, { aspect: 1.5 }), entry(4), entry(5)];
  const set = pickThemedSet(entries, new Set(), { size: 4, rng: () => 0 });
  assert.ok(set.every((e) => e.aspect < 1.0));
});

test("returns null when no theme has enough members", () => {
  const entries = [entry(1), entry(2, { culture: "French" }), entry(3, { culture: "Italian" })];
  assert.equal(pickThemedSet(entries, new Set(), { size: 4, rng: () => 0 }), null);
});

test("excludes posted and skipped entries", () => {
  const entries = [1, 2, 3, 4, 5].map((i) => entry(i));
  entries[0].skip = true;
  const set = pickThemedSet(entries, new Set(["harvard:2"]), { size: 4, rng: () => 0 });
  assert.ok(!set.some((e) => e.id === 1 || e.id === 2));
});

test("caps at one work per artist", () => {
  const entries = [entry(1, { artist: "Same" }), entry(2, { artist: "Same" }),
    entry(3), entry(4), entry(5), entry(6)];
  const set = pickThemedSet(entries, new Set(), { size: 4, rng: () => 0 });
  assert.equal(set.filter((e) => e.artist === "Same").length, 1);
});
```

**Step 2: Run** → FAIL. **Step 3: Implement in cache.mjs**

```js
/**
 * Pick a themed carousel set: same culture (the grouping with the best data
 * coverage), same orientation (IG crops all children to the first child's
 * aspect), one work per artist, entries must have a known aspect.
 * Returns null when nothing qualifies — caller falls back to a single post.
 */
export function pickThemedSet(entries, historySet, { size = 4, minSize = 3, rng = Math.random } = {}) {
  const pool = entries.filter((e) =>
    !e.skip && e.aspect && e.culture &&
    !historySet.has(`${e.source}:${e.id}`),
  );

  const groups = new Map();
  for (const e of pool) {
    const orientation = e.aspect < 1.0 ? "portrait" : "landscape";
    const key = `${e.culture}|${orientation}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const viable = [...groups.values()]
    .map((g) => {
      const seen = new Set();
      return g.filter((e) => !seen.has(e.artist) && seen.add(e.artist));
    })
    .filter((g) => g.length >= minSize);
  if (viable.length === 0) return null;

  const group = viable[Math.floor(rng() * viable.length)];
  const shuffled = [...group].sort(() => rng() - 0.5);
  return shuffled.slice(0, Math.min(size, shuffled.length));
}
```

**Step 4: Run** → PASS. **Commit** — `git commit -m "feat(ig-poster): themed carousel set picker"`

---

### Task 14: Carousel publishing + mode

**Files:**
- Modify: `scripts/instagram-poster/lib/instagram-api.mjs` (add `publishCarousel`)
- Modify: `scripts/instagram-poster/lib/captions.mjs` (add `buildCarouselCaption`)
- Modify: `scripts/instagram-poster/post.mjs` (`--carousel` mode)
- Modify: `.github/workflows/instagram-post.yml` (dispatch option + Sunday cron)

**Step 1: publishCarousel** (reuses container/poll/publish plumbing):

```js
export async function publishCarousel(token, hostedUrls, caption) {
  if (hostedUrls.length < 2) throw new Error("carousel needs >=2 items");

  const children = [];
  for (const url of hostedUrls) {
    const params = new URLSearchParams({
      image_url: url, is_carousel_item: "true", access_token: token,
    });
    const res = await fetch(`${IG_GRAPH}/${INSTAGRAM_USER_ID}/media?${params}`, { method: "POST" });
    if (!res.ok) throw new Error(`Carousel child failed (${res.status}): ${await res.text()}`);
    children.push((await res.json()).id);
  }
  for (const id of children) await waitForContainer(token, id);

  const parentParams = new URLSearchParams({
    media_type: "CAROUSEL", children: children.join(","), caption, access_token: token,
  });
  const parentRes = await fetch(`${IG_GRAPH}/${INSTAGRAM_USER_ID}/media?${parentParams}`, { method: "POST" });
  if (!parentRes.ok) throw new Error(`Carousel container failed (${parentRes.status}): ${await parentRes.text()}`);
  const { id: parentId } = await parentRes.json();
  await waitForContainer(token, parentId);
  return publishContainer(token, parentId); // shared helper from Task 7
}
```

**Step 2: buildCarouselCaption** — numbered gallery labels, one per work:

```js
export function buildCarouselCaption(theme, arts, rng = Math.random) {
  const lines = [theme, ""];
  arts.forEach((a, i) => {
    const detail = [a.dated, a.medium].filter(Boolean).join(" · ");
    lines.push(`${i + 1}. ${a.title}${a.artist !== "Unknown artist" ? ` — ${a.artist}` : ""}`);
    if (detail) lines.push(`   ${detail}`);
  });
  lines.push("", arts[0].museumName, "", SIGN_OFF);
  return lines.join("\n");
}
```

Theme string: `"${culture} painting · a small selection"` from the set's shared culture (derive in post.mjs).

**Step 3: post.mjs `--carousel` mode** — new branch before the normal flow: pick set (`pickThemedSet(loadCache(), historySet)`); **fall back to plain post mode when null**; for each entry: fetch image (cache buffer), `prepareFeedImage`, `uploadImage` — collect `{url, path, token}`; require ≥3 survivors else fall back; `publishCarousel`; finally-delete every uploaded file; record EVERY item's artKey into history; quality entry with `mode: "carousel"`.

**Step 4: workflow** — add `carousel` to the dispatch choices + case branch (`node post.mjs --carousel`), and a Sunday slot: add cron line `- cron: "0 16 * * 0"` with a first step that exports `MODE=carousel` when `github.event.schedule == '0 16 * * 0'`:

```yaml
      - name: Resolve mode
        id: mode
        run: |
          if [ "${{ github.event.schedule }}" = "0 16 * * 0" ]; then echo "mode=carousel" >> "$GITHUB_OUTPUT";
          else echo "mode=${MODE:-auto}" >> "$GITHUB_OUTPUT"; fi
```

(and switch the `case` to `"${{ steps.mode.outputs.mode }}"` passed via env).

**Step 5: Dry-run support** — `--carousel --dry-run` writes `arttok-carousel-{1..4}.jpg` + prints the numbered caption.

Run: `node post.mjs --carousel --dry-run`
Expected: 3–4 same-orientation images from one culture + numbered label caption.

**Step 6: Run all tests, commit** — `git commit -m "feat(ig-poster): weekly themed carousels with single-post fallback"`

---

## Phase 5 — Recap story, Pinterest RSS, health monitoring

### Task 15: Weekly recap story (appended to analytics, skip-on-error)

**Files:**
- Create: `scripts/instagram-poster/recap.mjs`
- Modify: `.github/workflows/instagram-analytics.yml` (step after analytics, `continue-on-error: true`)

**Step 1: recap.mjs** — thin orchestration, all existing pieces:

```js
// Posts a 3-frame "This week at @arttok.art" story from the week's top posts.
// Every failure is non-fatal: stories are ephemeral bonus content.
import "dotenv/config";
import { fetchSpecificArtwork } from "./lib/art-fetchers.mjs";
import { publishAutoStory } from "./lib/instagram-api.mjs";
import { refreshTokenIfNeeded } from "./lib/token-refresh.mjs";
import { loadQualityLog } from "./lib/quality-log.mjs";

const QUALITY_LOG_FILE = new URL("./post-quality-log.json", import.meta.url);

async function main() {
  const token = await refreshTokenIfNeeded(process.env.INSTAGRAM_ACCESS_TOKEN);
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const week = loadQualityLog(QUALITY_LOG_FILE.pathname.replace(/^\/([A-Z]:)/, "$1"))
    .filter((e) => new Date(e.timestamp) > weekAgo && e.mediaId && e.mode !== "story");

  // Engagement isn't in the quality log; metadataScore is the best local proxy.
  const top = week.sort((a, b) => b.metadataScore - a.metadataScore).slice(0, 3);
  console.log(`Recap: ${top.length} highlights from ${week.length} posts this week`);

  for (const entry of top) {
    try {
      const art = await fetchSpecificArtwork(entry.artKey);
      await publishAutoStory(token, art, null); // already non-fatal internally
    } catch (err) {
      console.warn(`Recap frame skipped (${entry.artKey}): ${err.message}`);
    }
  }
}

main().catch((err) => { console.warn(`Recap failed (non-fatal): ${err.message}`); });
```

(Upgrade path: once analytics.mjs exposes per-media engagement, sort by that instead — one-line change, noted in code.)

**Step 2: Workflow step** after "Run analytics":

```yaml
      - name: Weekly recap story
        continue-on-error: true
        working-directory: scripts/instagram-poster
        env:
          INSTAGRAM_ACCESS_TOKEN: ${{ secrets.INSTAGRAM_ACCESS_TOKEN }}
          INSTAGRAM_USER_ID: ${{ secrets.INSTAGRAM_USER_ID }}
          META_APP_ID: ${{ secrets.META_APP_ID }}
          META_APP_SECRET: ${{ secrets.META_APP_SECRET }}
          FACEBOOK_PAGE_ID: ${{ secrets.FACEBOOK_PAGE_ID }}
          DROPBOX_REFRESH_TOKEN: ${{ secrets.DROPBOX_REFRESH_TOKEN }}
          DROPBOX_APP_KEY: ${{ secrets.DROPBOX_APP_KEY }}
          DROPBOX_APP_SECRET: ${{ secrets.DROPBOX_APP_SECRET }}
          HARVARD_API_KEY: ${{ secrets.VITE_HARVARD_API_KEY }}
        run: node recap.mjs
```

**Step 3: Commit** — `git commit -m "feat(ig-poster): weekly recap story from top quality-scored posts"`

---

### Task 16: Pinterest RSS feed (static, generated at deploy)

**Prerequisite (manual, owner):** Pinterest Business account + **claim the site** (GitHub Pages URL or custom domain). Pinterest reads the feed from the claimed domain only. Also requires the SPA 404 fallback (deploy task in the web-foundation plan) so pin links resolve.

**Files:**
- Create: `scripts/prerender/generate-rss.mjs`
- Test: `scripts/prerender/tests/rss.test.mjs` (root `npm test` won't pick this up — run with `node --test scripts/prerender/tests/`)
- Modify: `.github/workflows/deploy.yml` (step after `vite build`)

**Step 1: Failing test for the pure feed builder**

```js
// scripts/prerender/tests/rss.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRssXml } from "../generate-rss.mjs";

const items = [{
  title: "The Vanity of the Artist's Dream",
  artist: "Charles Bird King",
  description: "Oil and graphite on canvas · 1830 · Harvard Art Museums",
  imageUrl: "https://www.dropbox.com/scl/fi/abc/h-1.jpg?rlkey=k&raw=1",
  link: "https://suljkanovicamir.github.io/art-tok/artwork/harvard/213930",
}];

test("emits valid RSS 2.0 with media:content image", () => {
  const xml = buildRssXml(items, { siteUrl: "https://suljkanovicamir.github.io/art-tok/" });
  assert.match(xml, /<rss version="2.0"/);
  assert.match(xml, /xmlns:media=/);
  assert.match(xml, /<media:content url="https:\/\/www\.dropbox\.com[^"]*"/);
  assert.match(xml, /<title>The Vanity of the Artist(&apos;|')s Dream<\/title>/);
});

test("escapes XML entities in titles", () => {
  const xml = buildRssXml([{ ...items[0], title: "Love & War <study>" }], { siteUrl: "x" });
  assert.match(xml, /Love &amp; War &lt;study&gt;/);
});
```

**Step 2: Run** → FAIL. **Step 3: Implement** — `generate-rss.mjs` exports `buildRssXml(items, opts)` (pure: header + escaped `<item>` blocks with `<title>`, `<link>`, `<description>`, `<media:content>`, `<guid>`) and a `main()` that: reads `scripts/instagram-poster/posted-history.json` + `image-cache.json`, joins posted keys to cache entries (those have title/artist/medium/dated/museumName/imageUrl), builds gallery-label descriptions, writes `dist/feed.xml`. Guard `main` with `if (process.argv[1].endsWith("generate-rss.mjs"))` so the test import doesn't execute it.

**Step 4: deploy.yml step** after the build:

```yaml
      - name: Generate Pinterest RSS feed
        run: node scripts/prerender/generate-rss.mjs
```

**Step 5: Verify locally** — `npm run build && node scripts/prerender/generate-rss.mjs && npx --yes xml2js-cli dist/feed.xml >/dev/null` (or open feed.xml — well-formed, items present).

**Step 6: Commit, then (manual) connect the feed URL in Pinterest** → Settings → Bulk create Pins → RSS feed → `https://<site>/feed.xml`, one board ("Masterworks"). Pins appear within 24h.

```bash
git commit -m "feat(distribution): Pinterest RSS feed generated from posting history"
```

---

### Task 17: Health section in the weekly report

**Files:**
- Modify: `scripts/instagram-poster/analytics.mjs`

**Step 1: Append a "Pipeline health" section to the generated markdown:**

- Cache per source: `getCacheStats(loadCache(), historySet).bySource` → warn lines for any source with `available < 20`.
- Token: reuse the `debug_token` call pattern from token-refresh.mjs → report `days until expiry` (or "no expiry").
- Graph API sunset: hardcoded `const API_SUNSET = new Date("2026-10-01")` next to the version pin import → warn when < 90 days away.
- Fallback rate: count quality-log entries from the last 7 days with `fallbackFrom` set.

**Step 2: Run locally** — `node analytics.mjs` (needs .env) → report includes the health block.

**Step 3: Commit** — `git commit -m "feat(ig-poster): pipeline health section in weekly analytics"`

---

## Execution order & dependencies

```
Phase 0 (Tasks 1-3)  ── independent, ship first, pure YAML
Phase 1 (Tasks 4-7)  ── depends on nothing; Task 5 before Task 7 (both touch post.mjs publish block)
Phase 2 (Tasks 8-10) ── depends on Task 7 (fallback plumbing) + Task 2 (dispatch option)
Phase 3 (Tasks 11-12)── independent of Phase 2
Phase 4 (Tasks 13-14)── depends on Task 7 (publishContainer helper)
Phase 5 (Tasks 15-17)── Task 15 needs Task 1; Task 16 needs site claim + 404 fallback (separate web plan); Task 17 anytime
```

After each phase: dispatch one real run from Actions and watch it before starting the next phase. Per project rules: branch per phase off `develop` (`chore/workflow-hardening`, `feat/pan-reels`, …), PRs, no direct pushes to main; `npm run lint` after web-side changes.

**Explicitly out of scope (separate plan):** web-app fixes (404.html, OG tags, `/featured` page, image sizing, view tracking) — this plan is the automation track only.
