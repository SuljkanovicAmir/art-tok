# Daily Jigsaw (2026-11-07)

A daily browser game at `/jigsaw`. Players rebuild today's painting from about 20 interlocking
pieces, against the clock, then challenge a friend to beat their time. It runs in the browser
with no backend.

It sits beside Timeline and follows the same conventions: one gesture, no drawing skill, and
a challenge link that shares the same round.

## How it works

- **Round:** the painting is cut into about 20 pieces (the grid follows the painting's shape). Every
  piece starts loose on a blank table, scattered by a seeded layout, so everyone gets the same
  arrangement. There is no frame and no tray: pieces lie on the page's tinted background.
- **Chunks:** a chunk is a set of pieces plus one translation. A piece is drawn at its home
  position plus its chunk's translation, so a translation of (0, 0) is the finished spot. Two
  chunks join when they hold neighbouring pieces and their translations are nearly equal. That is
  the whole rule: no per-piece angle or side checks. The tolerance is 0.16 of a cell's short side,
  never less than 9 screen pixels, which is about 10px on a phone. A wrong piece never joins at any
  distance.
- **Moving:** drag a piece or chunk, and let go near its neighbour. Pickup tests each piece's real
  outline, from the top chunk down, so transparent corners never steal a press. On touch, a chunk of
  up to three pieces floats half a cell above the finger. A join eases the last few pixels, plays a
  click, buzzes, and glows along the new seam.
- **Table edges:** while held, a piece can go 0.75 of a cell past the table, so it reaches any side
  of a chunk against an edge. Every drop then eases the chunk fully back on the table, measured by
  cells, not tabs, so a chunk in its true place is never pushed out of it.
- **Zoom:** 1x to 3x, using the buttons on the table, a pinch, the mouse wheel, a double tap on empty
  table, or the `+`, `-` and `0` keys. When zoomed, dragging empty table pans, and carrying a chunk
  to an edge moves the view. Zoom isn't saved, and the view returns to 1x for the finish. A pinch
  never moves a piece. Maths is in `src/utils/jigsaw/view.ts`.
- **Tap and keyboard:** tap a chunk to select it, then tap another to connect them. If they touch,
  the first flies over and joins; if not, it shakes and stays selected. A hidden list of buttons
  gives every chunk a place in the tab order. `Escape` deselects, hold `P` to peek, `G` toggles the
  Guide.
- **Scoring:** the clock alone. A piece that doesn't fit simply doesn't join. Moves are counted and
  shown on the result, but they don't change the time.
- **Peek:** hold to show the whole painting over a dark scrim. The clock keeps running.
- **Guide:** shows a faded copy of the painting and the cut lines under the pieces, and snaps a
  chunk to its true spot when it is dropped close. Turning it on marks the round as guided for good,
  even if it is switched off again. Guided times say so on the result and in the share text, and
  best time counts unguided rounds first. The on/off choice is remembered.
- **Tidy:** spreads the loose pieces out again, steering clear of chunks. It rescues pieces buried in
  a pile and costs no move.
- **Start and finish:** the painting shows for 2.2s, the cut lines draw on, then each piece flies
  from its home to its place on the table, and the clock starts when they land. On the last join the
  clock stops, the chunk eases to its spot, and a wave, a clean image fade and a sheen lead to the
  result. Reduced motion skips the animation.
- **Fairness:** everyone gets the same painting, the same cuts and the same scatter, because they
  are seeded by the puzzle number. The puzzle number counts UTC days from 2026-11-07.
- **Pause:** the timer button pauses the clock. Leaving the tab also pauses it. While paused, the
  table and dock are fully blurred, so a pause can't be used to study the painting.
- **Progress:** an unfinished daily round is saved after every drop, and on pause, hide and leave.
  A reload keeps the chunks and the time so far. Saved chunks are pulled back onto the table if the
  screen has changed. Progress is only trusted when every piece appears exactly once.
- **Practice:** a new round uses a random painting and random cuts, at Easy (12), Medium (20),
  Hard (35) or Expert (48) pieces. Practice saves no record and
  does not touch the streak.
- **Ranks:** by seconds per piece: 5 or less is Master Restorer, 9 Conservator, 15 Studio
  Apprentice, otherwise Patient Visitor. They are untuned estimates.

## Files

- `src/pages/JigsawPage.tsx`: round setup, intro, game and result screens
- `src/pages/GamesPage.tsx`: the games hub at `/games`
- `src/components/jigsaw/`: the intro, the game, the table, peek and the result
- `src/hooks/useTableDrag.ts`: picking up, dragging and dropping chunks
- `src/hooks/useGameClock.ts`: the clock, which can resume from saved time
- `src/hooks/useJigsawAssets.ts`: loads the image, cuts it and renders the pieces
- `src/utils/jigsaw/`: the rules (`game.ts`), geometry, table layout, storage, sound and the
  painting list (`paintings.json`)
- `scripts/jigsaw/`: `build-paintings.mjs` and `paintings.source.json`

Saved data uses `arttok-jigsaw-v2` (records), `arttok-jigsaw-progress-v2`, `arttok-jigsaw-muted`
and `arttok-jigsaw-guide`.

## Paintings

50 public-domain works from the Met's open-access collection. Images are self-hosted in
`public/jigsaw-paintings/`, at up to 1200px on the long side. The set totals 9.65 MB, so the
game does not depend on a museum API at runtime.

The source list, `scripts/jigsaw/paintings.source.json`, holds object IDs. An entry can also
carry a crop, which trims extra margin after the automatic trim. To grow the set, add IDs to
`paintings.source.json` and rerun `build-paintings.mjs`. This changes future daily picks,
because the daily painting is chosen from the full list.

The build needs node-canvas. Run `npm ci` in `scripts/instagram-poster` first, or set
`NODE_PATH` so the script can resolve it.

## Games hub

Timeline and Jigsaw both sit behind `/games`. The bottom nav already has five icons, which is
the most that fits, so the Timeline item became Games. Each card shows that game's daily
painting, a one-line description and today's state, such as "Played, 1:42" or "Today's round
is waiting". Today's Jigsaw painting stays blurred on the hub until that day's round is finished,
so the card can't spoil the puzzle.

## Not built yet

- The ranks are untuned estimates. They should be adjusted once real players have tried the
  game.
- A global leaderboard needs a backend.
- Wallpaper unlocks are not built.
- `trackEvent` analytics are not wired into the game yet.
- The snap tolerance is an estimate too, and is one constant in `game.ts` (`SNAP_CELLS`).
- Not yet tried on a real phone: touch, pinch, vibration. Double-tap zoom, edge panning while
  carrying a piece, tap-to-join, holding Peek, sound and the share button have not been tested in
  a browser either.
