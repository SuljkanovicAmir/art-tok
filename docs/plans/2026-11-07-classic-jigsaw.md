# Classic Jigsaw rebuild: implementation plan (2026-11-07)

Replaces the tray-over-faded-image play in `2026-11-07-daily-jigsaw.md`. The owner chose a real
jigsaw: every piece scattered on a blank table, pieces joined to each other into growing chunks.
The working rules in that plan still apply. Nothing has shipped, so no save migration is needed.

Keep unchanged: piece cutting (`geometry.ts`, `renderPieces.ts`), paintings, sound, pause and its
blur, `useGameClock`, `useJigsawAssets`, intro, finish sequence, challenge links, streaks, hub.

Remove: tray, hand and queue, seats, slips, penalties, the mark grid, hints, the empty-cell
buttons, and any code left unused by that (`resolveDrop`, `cellAt`, `HAND_SIZE`, `dealOrder`,
`JigsawTray`, `JigsawBoardView`, `useJigsawDrag`, `flight.ts` helpers that lose their callers).

## The key idea

A chunk is a set of pieces plus one translation. A piece is drawn at
`homePosition + chunk.translation`, in board units (image pixels). Translation (0,0) means the
piece sits exactly where it belongs in the finished painting, centred on the table.

Two chunks fit when they contain neighbouring pieces **and** their translations are nearly equal.
This one rule needs no per-piece angle or side checks, and it makes joining pure and testable.

## Types (`src/types/jigsaw.ts`)

```ts
PieceGroup { id: number; pieces: number[]; x: number; y: number }  // translation, board units
RoundState { groups: PieceGroup[] /* draw order, last on top */; moves: number;
             peeks: number; guided: boolean }
JigsawRecord { puzzle; totalMs; pieces; cols; moves; peeks; guided }
```

`group.id` is the id of the group's first piece. Remove `DropOutcome`, `slips`, `hints`, `marks`.

## Rules (`src/utils/jigsaw/game.ts`)

Constants: `SNAP_CELLS = 0.3` (of the cell's short side), `MIN_SNAP_PX = 14`.

- `snapDistance(jigsaw, scale)`: board units. `max(shortSide * SNAP_CELLS, MIN_SNAP_PX / scale)`.
  So tolerance never drops below 14 screen pixels on small pieces.
- `neighbours(piece, jigsaw)`: up to 4 piece ids.
- `groupsFit(a, b, jigsaw, tolerance)`: some piece in `a` neighbours some piece in `b`, and
  `hypot(a.x-b.x, a.y-b.y) <= tolerance`.
- `joinGroup(state, id, jigsaw, tolerance)`: merges every group that fits the given one, in a loop
  until nothing else fits, since a merge can create a new fit. The other chunk stays still and the
  dropped chunk adopts its translation. Returns `{state, joined: number}`. The merged group goes on
  top of the draw order.
- `moveGroup(state, id, x, y)`: sets the translation, raises it to the top, adds 1 to `moves`.
- `raiseGroup(state, id)`.
- `isComplete(state)`: one group left.
- `tryPair(state, a, b, jigsaw)`: for tap and keyboard joining. If any piece of `a` truly neighbours
  any of `b`, move `a` onto `b`'s translation, run `joinGroup`, and return the state. Otherwise
  return null. Adds 1 to `moves` either way.
- `createRound(jigsaw, seed, table)`: every piece in its own group, positions from `scatter`.
- `scatter(jigsaw, seed, table, pieces)`, where `table` is the table size in board units:
  divide the table into a grid with at least as many cells as pieces, sized to the piece aspect;
  seeded-shuffle the cells; place each piece's centre in a cell with seeded jitter of up to 0.15
  of a cell, clamped so a piece stays fully on the table. Work in fractions of the table first,
  then multiply, so the arrangement matches across screen sizes. No piece may start within
  `snapDistance` of fitting a true neighbour: reseat any that do.
- `tidy(state, jigsaw, seed, table)`: runs `scatter` for single loose pieces only, avoiding the
  bounding boxes of chunks where it can. Chunks stay still. Counts as no move.
- `DIFFICULTIES` gets `desktopOnly: true` on Expert.
- `rankForTime` by seconds per piece: <=5 Master Restorer, <=9 Conservator, <=15 Studio Apprentice,
  otherwise Patient Visitor. Still estimates.
- `buildShareText(puzzle, record)`: spoiler free, no grid:
  ```
  ArtTok Jigsaw No. 3
  1:42, 20 pieces
  Can you beat me?
  ```
  Add a line `With the Guide on` before the last line when `guided`.

Scoring is the clock alone. A piece that doesn't fit just doesn't join, with no penalty.

## The table

New `src/components/jigsaw/JigsawTable.tsx`, replacing the board view. It fills all space between
the bar and a slim bottom dock. No frame or recessed surface: pieces lie directly on the page's
tinted dark background. Measured with a `ResizeObserver`.

- `scale = min(tableW / jigsaw.width, tableH / jigsaw.height) * 0.96`: the finished painting always
  fits, centred.
- Each group is one element, sized to the board, positioned by
  `translate(centreX + x*scale, centreY + y*scale)`. Pieces inside use the existing percentage
  layout. While dragging, set the group's `transform` directly through a ref, never React state.
  `will-change: transform` only on the held group.
- Pieces don't take pointer events. A single handler on the table does hit testing, so transparent
  corners never steal a press.

### Picking up

`src/hooks/useTableDrag.ts`. Walk groups from top to bottom and test each piece's `Path2D` with
`isPointInPath`, on one shared offscreen context, in board units. For touch and pen, if nothing is
hit exactly, take the piece whose path passes within 16 screen pixels (`isPointInStroke` with that
line width), so a small piece near a finger is still caught. One active pointer only. `touch-action:
none` on the table. Beyond 5px of movement it's a drag.

Keep the grab offset, so a chunk doesn't jump to the finger. For touch and pen, chunks of up to 3
pieces also ease up by 0.5 cells over 120ms, so the finger doesn't hide them. Larger chunks don't,
as they're visible around the finger. Clamp so at least the grabbed piece's centre stays on the
table.

The held group gets `filter: drop-shadow(...)` and a tiny scale. A press raises the group at once.

### Dropping

1. `moveGroup`, then, if the Guide is on and the group is within `snapDistance` of (0,0), snap it
   to (0,0).
2. `joinGroup`. If `joined > 0`: animate the held group the last few pixels in 120ms with the Web
   Animations API, `playSnap(progress)`, `vibrate(10)`, a glowing stroke along the joined pieces
   fading in 500ms, and announce "Joined, 7 of 20 connected".
3. No join: settle with no sound. There is no slip feedback.

`progress` and the meter measure connected pieces: `pieces - groups + 1 - 1` over `pieces - 1`, so
it starts at 0 and reaches 100% on the last join. Text reads like "7/20", where the first number is
the size of the largest chunk.

Joins must be visible and satisfying, as they're the game's main reward. Avoid other effects on
ordinary drops.

### Tap and keyboard play

- A tap with no drag selects a chunk: a raised, softly glowing outline. Tapping it again deselects.
  Tapping another chunk calls `tryPair`: on success the selected chunk flies to it and joins; on
  failure the selected one gives a tiny shake and stays selected, with no sound or penalty.
- Tapping empty table deselects.
- A visually hidden list of `<button>`s, one per group, in stable order, sits in the DOM for
  keyboard and screen readers. Labels: "Piece, row 2, column 3", or "Group of 4 pieces". When a
  button has focus, show the same outline on that group. Enter or Space behaves as a tap. Each chunk
  keeps its place in the tab order. Announce "Those pieces don't connect".
- `Escape` deselects, hold `P` peeks, `G` toggles the Guide.

## Dock

A slim row below the table: progress bar, count, then three icon buttons.
- **Peek** (`Eye`), as now: press and hold shows the whole painting centred, over the table with a
  dark scrim.
- **Guide** (`Image` from lucide-react): toggles a faded image at the centred board position, at
  about 0.16 opacity, under the pieces, with `allCutsPath` hairlines. `aria-pressed`. Off by
  default. Turning it on sets `guided: true` for the round, permanently, even if it's turned off
  again. Times aren't comparable with it, so the result and share text say so. Remember the on/off
  choice in `arttok-jigsaw-guide`.
- **Tidy** (`Shuffle`... pick `LayoutGrid`): `tidy` with pieces animating to their new places over
  300ms. It rescues pieces hidden in pile-ups.

Desktop (min-width 900px and landscape): the dock sits as a slim row under the table, centred, not a
side rail, so the table gets the full width. Short phones: keep the dock under 3.25rem.

## Start and finish

- Preview and cut lines as now. Then each piece flies from its home to its scattered position, with
  the existing stagger. The clock starts when they land. Use `--sx/--sy/--delay`, or the same
  transition on group transforms.
- Continuing a round skips this. Saved groups are clamped to the current table in case the screen
  changed. Reduced motion skips animation.
- On the last join, stop the clock, ease the single group to (0,0) in 350ms, then run the existing
  finish sequence.

## Result

Remove the mark grid and the "includes +Ns" line. Stats line: "63 moves", peeks when above zero, and
"With the Guide on" when guided. Best time only counts rounds without the Guide; if none, show the
fastest with a small "Guide" marker. Difficulty chooser: hide Expert when
`matchMedia("(min-width: 900px) and (pointer: fine)")` doesn't match. Labels stay "About N pieces".

## Storage

Bump keys to `arttok-jigsaw-v2` and `arttok-jigsaw-progress-v2`. Progress is trusted only when every
piece appears exactly once across `groups`. Save after every drop, on pause, hide and leave.

## Tests (`src/utils/__tests__/jigsaw.test.ts`)

Replace tests for removed rules. Add:
- `scatter` is deterministic, keeps pieces on the table, and starts with no fitting neighbours, for
  all four difficulties and portrait and landscape tables.
- `groupsFit` needs both adjacency and near-equal translation: a non-neighbour at the same
  translation doesn't fit, nor does a neighbour outside tolerance.
- `joinGroup` adopts the still chunk's translation, chains through several groups, and keeps every
  piece exactly once.
- Joining in any order ends with one group, from a randomised playthrough.
- `tryPair` succeeds for true neighbours in any position, and returns null otherwise.
- `snapDistance` floor, `tidy` moves only single pieces, `isComplete`, ranks, share text with and
  without the Guide, and progress validation.

## Zoom and table edges (added after browser testing)

- Snap tightened from 0.3 of a cell and a 14px floor to 0.16 and 9px, at the owner's request, so
  pieces must be properly lined up.
- `clampGroup` keeps a chunk's cells on the table after every drop. A held piece may overhang by
  0.75 of a cell, so it can reach any side of an edge chunk.
- Camera: `.jigsaw__world` carries `translate + scale`, zoom 1 to 3, written directly to the
  element during gestures. Pointer conversions go through `screenToWorld`; on-screen limits stay in
  screen pixels.
- Expert returned to phones, as zoom makes 48 pieces workable.

## Docs

Update `docs/2026-11-07-daily-jigsaw.md` to describe this game, removing tray, slips and hints.
