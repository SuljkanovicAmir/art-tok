# Daily Jigsaw: implementation plan (2026-11-07)

Daily game at `/jigsaw`: rebuild the day's painting from interlocking pieces, then challenge a
friend to beat your time. Browser only, no backend. Sits beside Timeline, and copies its
conventions (`src/pages/TimelinePage.tsx`, `src/components/timeline/`, `src/utils/timeline/`).

Worktree: `D:\Projects\arttok-jigsaw`, branch `feature/daily-jigsaw`, based on `origin/main`.

## Product rules (from the owner's feedback)

- One gesture, no skill barrier. The owner rejected a previous game as too hard.
- Competition between friends through challenge links.
- Feedback appears beside where the player is looking.
- Minimal liquid-glass dark UI. Icon buttons carry `aria-label`. No emoji.
- Copy is plain and gallery-label in tone.

## Working rules for every agent

- Read `CLAUDE.md`. Async/await only, no `.then()`. Typed interfaces in `src/types/`. Props
  interfaces next to components. Files under 500 lines. All styles in `src/App.css`.
- The React Compiler lint is on as an error. No `try/finally` inside components or hooks, no
  ref reads during render. Put awkward async work in plain functions outside components.
- Run npm through PowerShell (the Git Bash npm shim is broken). `npm run lint`, `npm test`,
  `npx tsc -b`, `npm run build`.
- Create files with the Write tool, not shell heredocs.
- Do not commit, push or open PRs. Do not touch `D:\Projects\arttok` (the main checkout).

## Stage A: core (no UI)

### Timeline changes (only these two)

In `src/utils/timeline/game.ts`: `export` `seededRandom`, and widen `currentStreak`'s first
parameter to `Record<string, unknown>`. Drop any import this leaves unused.

### `src/types/jigsaw.ts`

```ts
JigsawPainting { id; title; artist; date: string /* museum text, "ca. 1889" */;
                 width; height /* image px */; color: string /* average, "#rrggbb" */ }
GridSize { cols; rows }
EdgeCut { flip: 1 | -1; shift; skew; lift; startBend; endBend }  // fractions of a cell
Jigsaw extends GridSize { width; height;
  horizontal: EdgeCut[][]; // [row][col], the edge below that row; rows-1 by cols
  vertical: EdgeCut[][];   // [row][col], the edge right of that col; rows by cols-1
}
Point { x; y }
PieceBounds { x; y; width; height }
RoundState { queue: number[]; hand: number[]; placed: number[];
             slips: Record<number, number>; hints: number; peeks: number }
DropOutcome = { kind: "place" } | { kind: "slip"; cell: number } | { kind: "cancel" }
JigsawRecord { puzzle; totalMs; pieces; cols; slips; hints; peeks; marks: boolean[] }
  // marks[pieceId] is true when that piece was placed with no slip
JigsawProgress { puzzle; state: RoundState; elapsedMs }
JigsawChallenge { puzzle; seconds }
```

Piece ids run row by row: `id = row * cols + col`. A piece's home cell has the same number.

### `src/utils/jigsaw/geometry.ts`

Constants: `TAB = 0.105`; exported `PIECE_PADDING = 0.36`.

- `cutJigsaw(width, height, grid, seed): Jigsaw`. `random = seededRandom(seed * 40503 +
  grid.cols * 7 + grid.rows)`. Each edge: `flip` 50/50; `shift` ±0.06; `skew`, `lift`,
  `startBend`, `endBend` ±0.03. The same seed must give identical shapes on every device.
- `cellSize(jigsaw)`, `cellOf(piece, cols) -> {col,row}`.
- Private `edgeCurve(cut, length, unit)`: `unit` is the cell's short side, so tabs stay round
  on non-square cells. Returns 10 bezier points for an edge from (0,0) to (length,0):

  ```
  middle = length*0.5 + cut.shift*length
  across(v) = v*unit*cut.flip        along(v) = middle + v*unit
  neck  = across(TAB + lift)   under = across(lift - TAB)   crown = across(3*TAB + lift)

  (0,0)
  (length*0.2, across(startBend))   (along(skew), under)            (along(-TAB), neck)
  (along(skew-2*TAB), crown)        (along(skew+2*TAB), crown)      (along(TAB), neck)
  (along(skew), under)              (length*0.8, across(endBend))   (length, 0)
  ```

- Horizontal edges map local (x,y) to (left+x, lineY+y). Vertical edges map local (x,y) to
  (lineX+y, top+x).
- `piecePath(jigsaw, piece): string`: SVG path, clockwise from the top-left corner. Top uses the
  horizontal edge of `row-1` forwards, right uses the vertical edge of `col` forwards, bottom
  uses horizontal `row` reversed, left uses vertical `col-1` reversed. Border sides are `L`
  lines. Round coordinates to 2 decimals. Neighbouring pieces must share exactly the same
  curve, so reverse the point list and never recompute it.
- `pieceBounds(jigsaw, piece)`: cell rect grown by `shortSide * PIECE_PADDING` on every side.
- `allCutsPath(jigsaw)`: every inner edge as one path, for the outlines on the empty board.

### `src/utils/jigsaw/game.ts`

Constants: `DAILY_PIECES = 20`, `HAND_SIZE = 5`, `SLIP_PENALTY_MS = 3000`,
`HINT_PENALTY_MS = 10000`, private `SNAP_RADIUS = 0.6` cells, `BOARD_MARGIN = 0.25` cells.
`DIFFICULTIES`: 12 Easy, 20 Medium, 35 Hard, 48 Expert.

- `dailyPainting(puzzle, paintings)`: `day = puzzle-1`, `cycle = floor(day/count)`. Each cycle
  is a seeded shuffle of indexes (`seededRandom((cycle+1)*2654435761)`), so every painting
  appears before any repeat. If a cycle's first entry equals the previous cycle's last, swap
  its first two.
- `gridFor(width, height, pieces)`: `rows = max(2, round(sqrt(pieces*height/width)))`,
  `cols = max(2, round(pieces/rows))`.
- `dealOrder(seed, count)`: seeded shuffle of piece ids. Same seed, same deal, so times are fair.
- `createRound(order)`: first `HAND_SIZE` are the hand, the rest the queue.
- `placePiece(state, piece)`: moves the piece to `placed`. The next queued piece takes its exact
  seat in `hand`, so other pieces do not shift under the finger. An empty queue shrinks the hand.
- `recordSlip(state, piece)`, `slipCount(state)`, `penaltyMs(state)`.
- `cellAt(jigsaw, center, board)`: the clamped cell under a board-relative pixel point.
- `resolveDrop(jigsaw, piece, center, board, placed)`, with `center` in board-relative pixels:
  1. Within `SNAP_RADIUS` cells of the piece's home centre: `place`.
  2. Beyond `BOARD_MARGIN` cells outside the board: `cancel`.
  3. Over an already filled cell: `cancel` (bumping finished work is not a wrong guess).
  4. Otherwise: `slip` with that cell.
- `formatTime(ms)`: `m:ss`, flooring seconds.
- `rankForTime(totalMs, pieces)` by seconds per piece: <=3.5 Master Restorer, <=6 Conservator,
  <=10 Studio Apprentice, otherwise Patient Visitor.
- `parseChallenge(search, today)`: `?p=12&vs=102`. Valid when `p` is an integer in 1..today and
  `vs` is present and an integer in 1..86400. Mirror Timeline's version.
- `buildShareText(puzzle, record)`, spoiler free:
  ```
  ArtTok Jigsaw No. 3
  1:42, 20 pieces
  ■■■■□
  ■■■■■
  ...one row per board row, □ where a piece slipped...
  Can you beat me?
  ```
  Practice rounds (`puzzle === null`) use the name `ArtTok Jigsaw`.

### `src/utils/jigsaw/storage.ts`

All access in try/catch, like `src/utils/timeline/storage.ts`.
Keys: `arttok-jigsaw-v1` (records by puzzle), `arttok-jigsaw-progress-v1`,
`arttok-jigsaw-muted`.
`readRecords`, `saveRecord`, `readProgress(puzzle)` (null if it belongs to another puzzle),
`saveProgress`, `clearProgress`, `readMuted`, `saveMuted`.

### `src/utils/jigsaw/sound.ts`

Web Audio, synthesised, no files. Lazily create the context on first use and resume it.
Fail silently where audio is unavailable.
- `playSnap(progress)`: a wood-click: a 30ms high-passed noise burst plus a short low sine, with
  pitch rising slightly as `progress` goes 0..1.
- `playSlip()`: a soft low thud.
- `playFinish()`: three soft sine notes rising, with long decay.
Each takes effect only when not muted. Also `vibrate(ms)`, guarded for iOS.

### `src/utils/jigsaw/renderPieces.ts`

`renderPieces(image, jigsaw): HTMLCanvasElement[]`, one per piece. Canvas size is
`pieceBounds` in image pixels. `translate(-bounds.x, -bounds.y)`, clip to `new Path2D(path)`,
`drawImage(image, 0, 0, jigsaw.width, jigsaw.height)`. Then emboss while still clipped: stroke
the path 2.5px at `rgba(255,255,255,0.28)` shifted (+1,+1), then at `rgba(0,0,0,0.4)` shifted
(-1,-1). Scale line widths with `jigsaw.width / 900`. `jigsaw.width/height` should equal the
image's natural size.

### Tests: `src/utils/__tests__/jigsaw.test.ts`

- Seeded determinism of `cutJigsaw`, `dealOrder` and `dailyPainting`.
- Neighbouring pieces share a curve: the right side of one is the reverse of the left of its
  neighbour (assert on `piecePath` coordinates).
- Corner pieces have two straight sides, and every path closes.
- All tabs stay inside `pieceBounds` for several seeds and non-square grids (sample the beziers).
- `gridFor` stays near the target for aspects 0.65 to 1.7.
- `dailyPainting` covers every painting in a cycle with no repeat, and no repeat across seams
  over many cycles.
- `placePiece` keeps seats still, and finishes with an empty hand and queue, no duplicates.
- `resolveDrop` covers all four outcomes, including a near-miss that still places.
- `penaltyMs`, `formatTime`, `rankForTime` boundaries, `parseChallenge` valid and invalid,
  `buildShareText` for daily and practice.
- Manifest check on `paintings.json`, skipped while the file does not exist yet is not an option:
  write this test in Stage B, once the file exists.

## Stage B: paintings

Candidates are crawled to the scratchpad: `cands.json` (id, title, artist, date, cls, dept, w, h,
aspect, orig, distinct, lum) and `cand/<id>.jpg`. `distinct` is how different the cells of a 5x4
cut are, `lum` the mean brightness.

1. Rank by `distinct`, drop `lum` under about 55 and works under 1000px on the long side at
   source. Build contact sheets (node-canvas from
   `D:/Projects/arttok/scripts/instagram-poster`, via `createRequire`) and look at them.
2. Choose 40 to 50 works. Want: colour, light, varied detail across the whole surface,
   landscapes, gardens, harbours, Japanese prints, American and Impressionist works, and a mix
   of periods and places. Reject: dark portraits, large flat skies or backgrounds, repetitive
   texture, gilded frames in the photo, and works with visible mounts or paper margins that
   can't be cropped. Nudes are out, as this is a family-friendly daily game.
3. Add `scripts/jigsaw/build-paintings.mjs` and `paintings.source.json`, following
   `scripts/timeline/build-paintings.mjs` (including its margin trim, and its pause between
   requests, as the Met blocks bursts). It confirms `isPublicDomain`, downloads `primaryImage`,
   falling back to `primaryImageSmall`, resizes so the long side is 1200px at most (never
   upscales), writes JPEG quality 0.8 to `public/jigsaw-paintings/<id>.jpg`, computes the average
   colour and writes `src/utils/jigsaw/paintings.json`, sorted by id. Write `date` from
   `objectDate`. Strip parentheticals from title and artist as Timeline does. Use the header
   `User-Agent: Mozilla/5.0 (ArtTok game build)`; do not add an email.
4. Aspect must be within 0.62 to 1.7. Report total image size. Aim for under 250KB per image.
5. Review the final set by eye, re-cropping or swapping anything with leftover margins.

## Stage C: UI

### Flow

`JigsawPage` holds: today's puzzle, optional challenge, the round (`{puzzle|null, painting, seed,
pieces}`), saved progress and the finished record. Seed for a daily round is the puzzle number.
Practice uses `Math.random`, and neither saves records nor touches the streak.

Screens: intro, game, result. Reopening a finished daily goes straight to its result. An
unfinished daily shows Continue on the intro with the time so far. A challenge link plays that
puzzle, and the intro reads "Your friend took 1:42. Can you beat it?".

`src/hooks/useJigsawAssets.ts` loads the image (`img.decode()`), cuts it and renders the pieces.
It returns `{status: "loading"|"ready"|"error", image, jigsaw, pieces}`. Play is disabled while
loading ("Preparing the pieces"), and an error shows a Try again button. Image URL:
`${import.meta.env.BASE_URL}jigsaw-paintings/${id}.jpg`.

`src/hooks/useGameClock.ts`: `start`, `stop`, `read()`, and an `elapsed` state ticking every
250ms, based on `performance.now()`. Starts from saved elapsed time.

### Intro

A background tinted by the painting's `color`. Five real cut pieces float in a loose fan with a
slow bob, like Timeline's fan, on a dark radial glow. Kicker `No. 3`, display-italic title
"Jigsaw", rules line "Rebuild today's painting, 20 pieces, against the clock.", and Play.

### Game layout

Full screen, `position: fixed` like `.timeline`. Column: bar, stage, tools, tray.

- **Bar:** close (to `/games`), center kicker plus large tabular-nums timer, sound toggle
  (`Volume2`/`VolumeX`). The timer is a button that pauses.
- **Stage:** `container-type: size`. Board width is
  `min(100cqw, calc(100cqh * var(--aspect)))` with `aspect-ratio: var(--aspect)`.
- **Board:** rounded recessed glass surface with an inner shadow. Layers, bottom to top: ghost
  painting at about 0.16 opacity; an SVG `viewBox="0 0 W H"` with `allCutsPath` as hairline
  strokes at about 0.12 white; placed pieces; empty-cell buttons; effects SVG; peek image.
- **Pieces on the board** are absolutely positioned using percentages of `pieceBounds`. Each is a
  `PieceCanvas`, which copies its master canvas in `useLayoutEffect`.
- **Progress:** a thin bar above the tray with `placed/total` as text.
- **Tools:** Peek (`Eye`) and Hint (`Lightbulb`) icon buttons in a row beside the progress.
- **Tray:** five seats in a row. Pieces use `object-fit`-style contained sizing, so all are drawn
  at one scale. No scrolling, which removes the scroll-against-drag conflict. Seats stay put, and
  a new piece springs in to the emptied seat.
- **Desktop (min-width 900px and landscape):** board on the left, tools and tray in a right rail.
- **Short phones (max-height 680px):** tighten the bar and tray so the board stays large.

### Start of a round

1. **Preview:** the full painting on the board for 2.2s. A tap skips it.
2. **Cut:** `allCutsPath` draws on with `pathLength=1` dash animation over about 0.5s.
3. **Scatter:** all pieces fly from the board towards the tray with a stagger, fading out over
   about 0.6s, using `--sx/--sy/--delay` per piece. The hand then pops in, staggered.
4. **Clock starts** when the scatter ends.

A continued round skips all of this. Reduced motion skips 2 and 3.

### Moving a piece

Create `src/hooks/useJigsawDrag.ts`. Pointer events, one active pointer only.
`touch-action: none` on tray pieces. Press scales the tray piece a little. Beyond 5px of
movement a fixed-position ghost appears at board scale, with a quick lift-in animation and
`filter: drop-shadow`. While dragging, update the ghost's `transform` directly through a ref,
never through React state, to hold 60fps. For touch and pen, float the ghost 0.7 cells above the
finger, so the finger doesn't hide it. Mouse keeps it centred. `hoverCell` state changes only
when the empty cell under the piece changes, and lights that cell softly.

On release, call `resolveDrop` with the ghost's centre, not the pointer:
- **place:** ghost flies to home in 150ms with the Web Animations API (`await
  animation.finished`, in a plain helper outside the component), then commit. On commit: a soft
  brightness flash on the piece, a glowing stroke of its `piecePath` that fades in 500ms,
  `playSnap(progress)`, `vibrate(10)`.
- **slip:** the cell flashes red, a `+3s` label floats up from the cell, the ghost shakes briefly
  and flies back to its seat, `playSlip()`, `vibrate([20,40,20])`.
- **cancel:** flies back with no penalty and no sound.

Block new drags while a flight is running. Clear the ghost if a pointer cancels.

### Tap and keyboard play

Dragging is not required.
- Tray pieces are `<button>`s. A tap or Enter selects one (a raised ring shows it), and another
  press deselects. Empty cells are `<button>`s over the board; pressing one tries that cell, using
  the same flight and outcomes. Filled cells have no button.
- Keys: `1`-`5` select a tray seat, `Escape` deselects, hold `P` to peek. Arrow keys move around
  the empty cells with a roving `tabindex`.
- `aria-label`s: "Row 2, column 3", and "Piece 2 of 5". A visually hidden `role="status"` region
  announces outcomes, such as "Placed, 12 of 20" and "Wrong place, 3 seconds added".
- `contextmenu` is prevented on the board and tray, and `-webkit-touch-callout: none` and
  `user-select: none` are set, so a long press doesn't open a phone menu.

### Tools

- **Peek:** press and hold shows the full painting over the board. Free, but the clock keeps
  running. Count one peek for each press. Works from pointer, and Space/Enter key down and up.
- **Hint:** the selected piece, or else the first in the tray. Its home cell pulses for 1.6s and
  the piece gets a ring. Adds `HINT_PENALTY_MS`, shown with a `+10s` float.

### Pausing and saving

Pause on the timer button and on `visibilitychange` to hidden. While paused the board and tray
blur fully, so a pause can't be used to study, and an overlay shows Resume. Save progress for
daily rounds after every placement, and on pause, on hide and on leaving, with elapsed time, so a
reload neither resets the clock nor loses work. The clock stops on the last piece. Clear
progress when a record is saved.

### Finish

Displayed and scored time is clock plus `penaltyMs`. Sequence, about 2s, tap to skip:
1. The last piece snaps and `playFinish()` plays.
2. A diagonal wave passes through the pieces (brightness and tiny lift, delayed by `col + row`).
3. The clean full image fades in over the pieces, so the seams vanish.
4. A soft specular sheen sweeps across, then go to the result.

Reduced motion: a plain crossfade.

### Result

`src/components/jigsaw/JigsawResult.tsx`, scrollable, same bar. Top down:
- The whole painting, in a thin glass frame, linking to `/artwork/met/<id>`, with a gallery-style
  caption of title, artist, date.
- Time in large display italic, and the rank.
- Stats line: slips, hints, peeks, each only when above zero. Penalties shown as "includes +6s".
- The mark grid as small squares in board shape.
- The versus line: "You beat your friend's 1:42", or "You tied", or "Your friend wins with 1:42".
- Primary action Challenge a friend (`Send`), using `navigator.share` or clipboard, as Timeline
  does, with a link to `.../jigsaw?p=<n>&vs=<seconds>`. Secondary New round (`Shuffle`), which
  opens the difficulty chooser of `DIFFICULTIES`, each showing its piece count.
- Footer stats: streak, days played, best time. A live countdown: "Next painting in 7:12:33",
  UTC midnight.

### Games hub

Without this the game can't be reached: five nav icons are already the most that fits.

- `src/pages/GamesPage.tsx` at `/games`: heading "Games", then two large cards, Jigsaw and
  Timeline. Each shows a piece of art, a one-line description, and today's state ("Played, 1:42"
  or "5/7", or "Today's round is waiting"), with the streak when above 1.
- `BottomNav`: replace the Timeline item with path `/games`, label "Games", icon `Puzzle` from
  lucide-react, same weights. Hide the nav on `/timeline` and `/jigsaw`, not on `/games`.
- Routes in `src/App.tsx`: `/games`, `/jigsaw`.
- The close buttons in Timeline (three places) go to `/games` rather than `/`.

### CSS

A `/* ── Jigsaw game ── */` section in `src/App.css`, BEM `.jigsaw__*`, plus `.games__*`. Use the
tokens (`--glass-l*`, `--text-*`, `--ease-*`, `--font-display`, `--radius-*`). Reuse
`.timeline__action`, `__action--primary` and `__close` patterns by matching their values. Reduced
motion rules at the end. Respect `env(safe-area-inset-*)`. Tint the page through a `--paint`
custom property set inline from `painting.color`.

## Stage D: finish

`docs/2026-11-07-daily-jigsaw.md`, MEMORY updates and game ideas status. Handled by the lead.
