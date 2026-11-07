import type {
  GridSize,
  Jigsaw,
  JigsawChallenge,
  JigsawPainting,
  JigsawRecord,
  PieceGroup,
  Point,
  RoundState,
} from "../../types/jigsaw";
import { seededRandom } from "../timeline/game";
import { cellOf, cellSize, pieceBounds } from "./geometry";

export const DAILY_PIECES = 20;
/** Two chunks fit when their gap is within this fraction of a cell's short side. */
export const SNAP_CELLS = 0.16;
/** ...but never tighter than this many screen pixels. */
export const MIN_SNAP_PX = 9;

export const DIFFICULTIES: { label: string; pieces: number }[] = [
  { label: "Easy", pieces: 12 },
  { label: "Medium", pieces: 20 },
  { label: "Hard", pieces: 35 },
  { label: "Expert", pieces: 48 },
];

/** The table's size in board units. The board is centred on it. */
export interface Table {
  width: number;
  height: number;
}

export interface Placement {
  piece: number;
  x: number;
  y: number;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function shuffled(count: number, random: () => number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Today's painting. Each cycle is a shuffle of the whole list, so every painting
 * appears before any repeats, and a cycle never opens with the previous one's last.
 */
export function dailyPainting(puzzle: number, paintings: JigsawPainting[]): JigsawPainting {
  const count = paintings.length;
  const day = puzzle - 1;
  const cycle = Math.floor(day / count);

  let previousLast = -1;
  let order: number[] = [];
  for (let c = 0; c <= cycle; c++) {
    order = shuffled(count, seededRandom((c + 1) * 2654435761));
    if (count > 1 && order[0] === previousLast) {
      [order[0], order[1]] = [order[1], order[0]];
    }
    previousLast = order[count - 1];
  }
  return paintings[order[day - cycle * count]];
}

export function gridFor(width: number, height: number, pieces: number): GridSize {
  const rows = Math.max(2, Math.round(Math.sqrt((pieces * height) / width)));
  const cols = Math.max(2, Math.round(pieces / rows));
  return { cols, rows };
}

/** How close two chunks must be to join, in board units. `scale` is screen pixels per unit. */
export function snapDistance(jigsaw: Jigsaw, scale: number): number {
  const { width, height } = cellSize(jigsaw);
  return Math.max(Math.min(width, height) * SNAP_CELLS, MIN_SNAP_PX / scale);
}

/** The pieces that touch this one, up to four. */
export function neighbours(piece: number, jigsaw: Jigsaw): number[] {
  const { col, row } = cellOf(piece, jigsaw.cols);
  const found: number[] = [];
  if (row > 0) found.push(piece - jigsaw.cols);
  if (col > 0) found.push(piece - 1);
  if (col < jigsaw.cols - 1) found.push(piece + 1);
  if (row < jigsaw.rows - 1) found.push(piece + jigsaw.cols);
  return found;
}

function touches(a: PieceGroup, b: PieceGroup, jigsaw: Jigsaw): boolean {
  return a.pieces.some((piece) => neighbours(piece, jigsaw).some((other) => b.pieces.includes(other)));
}

/** Chunks fit when they hold neighbouring pieces and sit at nearly the same translation. */
export function groupsFit(a: PieceGroup, b: PieceGroup, jigsaw: Jigsaw, tolerance: number): boolean {
  return touches(a, b, jigsaw) && Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;
}

/**
 * Merges every chunk that fits the given one, until nothing else does. The chunk that was
 * already there stays still and the dropped one adopts its translation.
 */
export function joinGroup(
  state: RoundState,
  id: number,
  jigsaw: Jigsaw,
  tolerance: number,
): { state: RoundState; joined: number } {
  let groups = state.groups;
  let current = groups.find((group) => group.id === id);
  let joined = 0;

  while (current) {
    const held: PieceGroup = current;
    const other = groups.find((group) => group !== held && groupsFit(held, group, jigsaw, tolerance));
    if (!other) break;
    const pieces = [...held.pieces, ...other.pieces].sort((a, b) => a - b);
    const merged: PieceGroup = { id: pieces[0], pieces, x: other.x, y: other.y };
    groups = [...groups.filter((group) => group !== held && group !== other), merged];
    current = merged;
    joined++;
  }
  return joined === 0 ? { state, joined } : { state: { ...state, groups }, joined };
}

function setGroup(state: RoundState, id: number, change: (group: PieceGroup) => PieceGroup): RoundState {
  const target = state.groups.find((group) => group.id === id);
  if (!target) return state;
  return { ...state, groups: [...state.groups.filter((group) => group !== target), change(target)] };
}

/** Puts a chunk down at a translation, on top. Counts as a move. */
export function moveGroup(state: RoundState, id: number, x: number, y: number): RoundState {
  const moved = setGroup(state, id, (group) => ({ ...group, x, y }));
  return { ...moved, moves: state.moves + 1 };
}

export function raiseGroup(state: RoundState, id: number): RoundState {
  const last = state.groups[state.groups.length - 1];
  if (!last || last.id === id) return state;
  return setGroup(state, id, (group) => group);
}

export function isComplete(state: RoundState): boolean {
  return state.groups.length === 1;
}

/**
 * Tap and keyboard joining: moves `a` onto `b` and joins them. Returns null when the two
 * chunks don't truly touch, and the caller counts that as a move.
 */
export function tryPair(
  state: RoundState,
  a: number,
  b: number,
  jigsaw: Jigsaw,
  tolerance = 0,
): RoundState | null {
  const first = state.groups.find((group) => group.id === a);
  const second = state.groups.find((group) => group.id === b);
  if (!first || !second || first === second || !touches(first, second, jigsaw)) return null;
  const moved = moveGroup(state, a, second.x, second.y);
  return joinGroup(moved, a, jigsaw, tolerance).state;
}

const homeCentre = (jigsaw: Jigsaw, piece: number): Point => {
  const { col, row } = cellOf(piece, jigsaw.cols);
  const { width, height } = cellSize(jigsaw);
  return { x: (col + 0.5) * width, y: (row + 0.5) * height };
};

const pieceRect = (jigsaw: Jigsaw, piece: number, x: number, y: number): Rect => {
  const bounds = pieceBounds(jigsaw, piece);
  return { x0: bounds.x + x, y0: bounds.y + y, x1: bounds.x + bounds.width + x, y1: bounds.y + bounds.height + y };
};

/** Board units covered by a chunk, tabs included. */
const groupRect = (jigsaw: Jigsaw, group: PieceGroup): Rect => {
  const rects = group.pieces.map((piece) => pieceRect(jigsaw, piece, group.x, group.y));
  return {
    x0: Math.min(...rects.map((r) => r.x0)),
    y0: Math.min(...rects.map((r) => r.y0)),
    x1: Math.max(...rects.map((r) => r.x1)),
    y1: Math.max(...rects.map((r) => r.y1)),
  };
};

interface Slot {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

/**
 * Lays pieces out on the table, one per cell of a jittered grid. Cells are chosen as fractions of
 * the table first, so a given seed gives the same arrangement on every screen. No piece starts
 * where it would join a true neighbour. `fixed` chunks stay put, and `avoid` areas are left
 * clear where there is room.
 */
export function scatter(
  jigsaw: Jigsaw,
  seed: number,
  table: Table,
  pieces: number[],
  scale = 0.5,
  fixed: PieceGroup[] = [],
  avoid: Rect[] = [],
): Placement[] {
  const count = pieces.length;
  if (count === 0) return [];
  const random = seededRandom(seed * 2246822519 + 17 + count);
  const first = pieceBounds(jigsaw, 0);
  const left = (jigsaw.width - table.width) / 2;
  const top = (jigsaw.height - table.height) / 2;
  const wide = table.width / table.height / (first.width / first.height);

  const gridOf = (rows: number): Slot[] => {
    const cols = Math.max(Math.ceil(count / rows), Math.ceil(wide * rows));
    return Array.from({ length: rows * cols }, (_, i) => ({ col: i % cols, row: Math.floor(i / cols), cols, rows }));
  };
  const centreOf = (slot: Slot): Point => ({
    x: left + ((slot.col + 0.5) / slot.cols) * table.width,
    y: top + ((slot.row + 0.5) / slot.rows) * table.height,
  });
  const blocked = (slot: Slot): boolean => {
    const c = centreOf(slot);
    return avoid.some(
      (r) =>
        c.x > r.x0 - first.width * 0.3 &&
        c.x < r.x1 + first.width * 0.3 &&
        c.y > r.y0 - first.height * 0.3 &&
        c.y < r.y1 + first.height * 0.3,
    );
  };

  const baseRows = Math.max(1, Math.round(Math.sqrt(count / wide)));
  let slots = gridOf(baseRows);
  if (avoid.length > 0) {
    for (let rows = baseRows; rows <= baseRows + 6; rows++) {
      slots = gridOf(rows).filter((slot) => !blocked(slot));
      if (slots.length >= count) break;
    }
    if (slots.length < count) slots = gridOf(baseRows);
  }

  const clampAxis = (value: number, low: number, size: number, piece: number): number =>
    size <= piece ? low + size / 2 : Math.min(Math.max(value, low + piece / 2), low + size - piece / 2);
  const onTable = (c: Point): Point => ({
    x: clampAxis(c.x, left, table.width, first.width),
    y: clampAxis(c.y, top, table.height, first.height),
  });

  const centres = shuffled(slots.length, random)
    .slice(0, count)
    .map((index) => {
      const slot = slots[index];
      const c = centreOf(slot);
      return onTable({
        x: c.x + (random() * 2 - 1) * 0.15 * (table.width / slot.cols),
        y: c.y + (random() * 2 - 1) * 0.15 * (table.height / slot.rows),
      });
    });

  const translation = (i: number): Point => {
    const home = homeCentre(jigsaw, pieces[i]);
    return { x: centres[i].x - home.x, y: centres[i].y - home.y };
  };

  const tolerance = snapDistance(jigsaw, scale);
  const conflicts = (i: number): boolean => {
    const mine = translation(i);
    return neighbours(pieces[i], jigsaw).some((other) => {
      const j = pieces.indexOf(other);
      if (j !== -1 && j !== i) {
        const theirs = translation(j);
        return Math.hypot(mine.x - theirs.x, mine.y - theirs.y) <= tolerance;
      }
      const group = fixed.find((g) => g.pieces.includes(other));
      return group !== undefined && Math.hypot(mine.x - group.x, mine.y - group.y) <= tolerance;
    });
  };

  // Reseat any piece that landed where it would join a neighbour, by swapping seats.
  for (let attempt = 0; attempt < 400; attempt++) {
    const bad = pieces.findIndex((_, i) => conflicts(i));
    if (bad === -1) break;
    const other = Math.floor(random() * count);
    if (other === bad) {
      centres[bad] = onTable({ x: centres[bad].x + tolerance * 2, y: centres[bad].y + tolerance });
    } else {
      [centres[bad], centres[other]] = [centres[other], centres[bad]];
    }
  }

  return pieces.map((piece, i) => ({ piece, ...translation(i) }));
}

/** Every piece loose on the table. */
export function createRound(jigsaw: Jigsaw, seed: number, table: Table, scale = 0.5): RoundState {
  const total = jigsaw.cols * jigsaw.rows;
  const pieces = Array.from({ length: total }, (_, i) => i);
  const groups = scatter(jigsaw, seed, table, pieces, scale).map(
    ({ piece, x, y }): PieceGroup => ({ id: piece, pieces: [piece], x, y }),
  );
  return { groups, moves: 0, peeks: 0, guided: false };
}

/** Re-spreads loose pieces, steering clear of chunks. Chunks stay still and it costs no move. */
export function tidy(state: RoundState, jigsaw: Jigsaw, seed: number, table: Table, scale = 0.5): RoundState {
  const loose = state.groups.filter((group) => group.pieces.length === 1);
  if (loose.length === 0) return state;
  const chunks = state.groups.filter((group) => group.pieces.length > 1);
  const placements = scatter(
    jigsaw,
    seed + state.moves * 31 + 5,
    table,
    loose.map((group) => group.id),
    scale,
    chunks,
    chunks.map((group) => groupRect(jigsaw, group)),
  );
  const byPiece = new Map(placements.map((placement) => [placement.piece, placement]));
  return {
    ...state,
    groups: state.groups.map((group) => {
      const placement = group.pieces.length === 1 ? byPiece.get(group.id) : undefined;
      return placement ? { ...group, x: placement.x, y: placement.y } : group;
    }),
  };
}

/** The translation that keeps a whole chunk on the table. The finished painting always fits. */
export function clampGroup(group: PieceGroup, jigsaw: Jigsaw, table: Table): Point {
  const left = (jigsaw.width - table.width) / 2;
  const top = (jigsaw.height - table.height) / 2;
  const fit = (value: number, low: number, high: number): number =>
    low > high ? (low + high) / 2 : Math.min(Math.max(value, low), high);
  // Measured by cells, not tabs, so a chunk in its true place is never pushed out of it.
  const cell = cellSize(jigsaw);
  const cells = group.pieces.map((piece) => cellOf(piece, jigsaw.cols));
  const x0 = Math.min(...cells.map(({ col }) => col)) * cell.width;
  const y0 = Math.min(...cells.map(({ row }) => row)) * cell.height;
  const x1 = (Math.max(...cells.map(({ col }) => col)) + 1) * cell.width;
  const y1 = (Math.max(...cells.map(({ row }) => row)) + 1) * cell.height;
  return {
    x: fit(group.x, left - x0, left + table.width - x1),
    y: fit(group.y, top - y0, top + table.height - y1),
  };
}

/** Pulls chunks back onto the table, for a saved round on a different screen. */
export function clampGroups(state: RoundState, jigsaw: Jigsaw, table: Table): RoundState {
  let changed = false;
  const groups = state.groups.map((group) => {
    const { x, y } = clampGroup(group, jigsaw, table);
    if (x === group.x && y === group.y) return group;
    changed = true;
    return { ...group, x, y };
  });
  return changed ? { ...state, groups } : state;
}

/** Saved progress is only trusted when every piece appears exactly once. */
export function isValidState(state: RoundState, total: number): boolean {
  if (!state || !Array.isArray(state.groups)) return false;
  const seen = new Set<number>();
  for (const group of state.groups) {
    if (!group || !Array.isArray(group.pieces) || !Number.isFinite(group.x) || !Number.isFinite(group.y)) {
      return false;
    }
    for (const piece of group.pieces) {
      if (!Number.isInteger(piece) || piece < 0 || piece >= total || seen.has(piece)) return false;
      seen.add(piece);
    }
  }
  return (
    seen.size === total &&
    state.groups.length > 1 &&
    Number.isFinite(state.moves) &&
    Number.isFinite(state.peeks)
  );
}

/** The size of the biggest chunk. */
export function largestGroup(state: RoundState): number {
  return Math.max(0, ...state.groups.map((group) => group.pieces.length));
}

/** 0 when every piece is loose, 1 when the painting is whole. */
export function connection(state: RoundState, total: number): number {
  return total <= 1 ? 1 : (total - state.groups.length) / (total - 1);
}

export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function rankForTime(totalMs: number, pieces: number): string {
  const perPiece = totalMs / 1000 / pieces;
  if (perPiece <= 5) return "Master Restorer";
  if (perPiece <= 9) return "Conservator";
  if (perPiece <= 15) return "Studio Apprentice";
  return "Patient Visitor";
}

/** Reads a friend's challenge from a link like `?p=12&vs=102`. */
export function parseChallenge(search: string, today: number): JigsawChallenge | null {
  const params = new URLSearchParams(search);
  const puzzle = Number(params.get("p"));
  const seconds = Number(params.get("vs"));
  const isValid =
    Number.isInteger(puzzle) &&
    puzzle >= 1 &&
    puzzle <= today &&
    params.has("vs") &&
    Number.isInteger(seconds) &&
    seconds >= 1 &&
    seconds <= 86_400;
  return isValid ? { puzzle, seconds } : null;
}

/** A spoiler-free summary, so sharing doesn't give away the painting. */
export function buildShareText(puzzle: number | null, record: JigsawRecord): string {
  const name = puzzle === null ? "ArtTok Jigsaw" : `ArtTok Jigsaw No. ${puzzle}`;
  return [
    name,
    `${formatTime(record.totalMs)}, ${record.pieces} pieces`,
    ...(record.guided ? ["With the Guide on"] : []),
    "Can you beat me?",
  ].join("\n");
}
