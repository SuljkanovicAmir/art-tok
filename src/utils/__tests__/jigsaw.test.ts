import { describe, expect, it } from "vitest";
import type { JigsawPainting, JigsawRecord, PieceGroup, Point, RoundState } from "../../types/jigsaw";
import {
  DAILY_PIECES,
  DIFFICULTIES,
  MIN_SNAP_PX,
  buildShareText,
  clampGroups,
  connection,
  createRound,
  dailyPainting,
  formatTime,
  gridFor,
  groupsFit,
  isComplete,
  isValidState,
  joinGroup,
  largestGroup,
  moveGroup,
  neighbours,
  parseChallenge,
  raiseGroup,
  rankForTime,
  scatter,
  snapDistance,
  tidy,
  tryPair,
} from "../jigsaw/game";
import { cellSize, cutJigsaw, pieceBounds, piecePath, allCutsPath } from "../jigsaw/geometry";
import { groupTransform, tableLayout, tableUnits } from "../jigsaw/layout";

const paintings: JigsawPainting[] = Array.from({ length: 7 }, (_, id) => ({
  id: id + 100,
  title: `Painting ${id}`,
  artist: "Artist",
  date: "ca. 1889",
  width: 1000,
  height: 800,
  color: "#336699",
}));

/** Every coordinate pair in a path, in order, with the command that owns it. */
function parsePath(path: string): { command: string; points: Point[] }[] {
  return [...path.matchAll(/([MLCZ])([^MLCZ]*)/g)].map(([, command, rest]) => {
    const numbers = rest.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const points: Point[] = [];
    for (let i = 0; i + 1 < numbers.length; i += 2) points.push({ x: numbers[i], y: numbers[i + 1] });
    return { command, points };
  });
}

/** Flat list of points, starting at the M point. Curves contribute three each. */
function flatPoints(path: string): Point[] {
  return parsePath(path).flatMap((part) => part.points);
}

function sampleCurves(path: string): Point[] {
  const samples: Point[] = [];
  let current: Point = { x: 0, y: 0 };
  for (const { command, points } of parsePath(path)) {
    if (command === "C") {
      const [a, b, c] = points;
      for (let t = 0; t <= 1; t += 0.05) {
        const u = 1 - t;
        samples.push({
          x: u ** 3 * current.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t ** 3 * c.x,
          y: u ** 3 * current.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t ** 3 * c.y,
        });
      }
      current = c;
    } else if (points.length > 0) {
      current = points[0];
      samples.push(current);
    }
  }
  return samples;
}

describe("cutJigsaw", () => {
  const grid = { cols: 5, rows: 4 };

  it("cuts identical shapes for a seed", () => {
    expect(cutJigsaw(900, 700, grid, 12)).toEqual(cutJigsaw(900, 700, grid, 12));
  });

  it("cuts different shapes for another seed", () => {
    expect(cutJigsaw(900, 700, grid, 12)).not.toEqual(cutJigsaw(900, 700, grid, 13));
  });

  it("makes one edge between each pair of neighbours", () => {
    const jigsaw = cutJigsaw(900, 700, grid, 1);
    expect(jigsaw.horizontal).toHaveLength(3);
    expect(jigsaw.horizontal[0]).toHaveLength(5);
    expect(jigsaw.vertical).toHaveLength(4);
    expect(jigsaw.vertical[0]).toHaveLength(4);
  });
});

describe("piecePath", () => {
  const jigsaw = cutJigsaw(900, 700, { cols: 5, rows: 4 }, 7);
  const cols = jigsaw.cols;

  it("shares one curve between neighbours", () => {
    const left = 1 * cols + 2;
    const right = left + 1;
    const below = left + cols;
    const a = flatPoints(piecePath(jigsaw, left));
    const b = flatPoints(piecePath(jigsaw, right));
    const c = flatPoints(piecePath(jigsaw, below));
    // Interior piece: M, then 9 more points per side: top, right, bottom, left.
    expect(a.slice(9, 19)).toEqual([...b.slice(27, 37)].reverse());
    expect(a.slice(18, 28)).toEqual([...c.slice(0, 10)].reverse());
  });

  it("gives corners two straight sides", () => {
    const lastRow = (jigsaw.rows - 1) * cols;
    for (const piece of [0, cols - 1, lastRow, lastRow + cols - 1]) {
      const lines = parsePath(piecePath(jigsaw, piece)).filter((part) => part.command === "L");
      expect(lines).toHaveLength(2);
    }
    expect(parsePath(piecePath(jigsaw, cols + 1)).filter((part) => part.command === "L")).toHaveLength(0);
  });

  it("closes every path where it started", () => {
    for (let piece = 0; piece < cols * jigsaw.rows; piece++) {
      const path = piecePath(jigsaw, piece);
      const points = flatPoints(path);
      expect(path.endsWith("Z")).toBe(true);
      expect(points[points.length - 1]).toEqual(points[0]);
    }
  });

  it.each([
    [900, 700, { cols: 5, rows: 4 }],
    [1200, 700, { cols: 7, rows: 3 }],
    [700, 1100, { cols: 3, rows: 6 }],
    [1000, 1000, { cols: 6, rows: 6 }],
  ])("keeps tabs inside the piece bounds (%i x %i)", (width, height, grid) => {
    for (let seed = 1; seed <= 12; seed++) {
      const cut = cutJigsaw(width, height, grid, seed);
      for (let piece = 0; piece < grid.cols * grid.rows; piece++) {
        const bounds = pieceBounds(cut, piece);
        for (const point of sampleCurves(piecePath(cut, piece))) {
          expect(point.x).toBeGreaterThanOrEqual(bounds.x);
          expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.width);
          expect(point.y).toBeGreaterThanOrEqual(bounds.y);
          expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.height);
        }
      }
    }
  });

  it("draws every inner edge in allCutsPath", () => {
    const moves = allCutsPath(jigsaw).match(/M/g) ?? [];
    expect(moves).toHaveLength(3 * 5 + 4 * 4);
  });
});

describe("gridFor", () => {
  it("stays near the target for every difficulty and aspect", () => {
    for (const { pieces } of DIFFICULTIES) {
      for (let aspect = 0.65; aspect <= 1.7; aspect += 0.05) {
        const { cols, rows } = gridFor(aspect * 1000, 1000, pieces);
        expect(Math.abs(cols * rows - pieces) / pieces).toBeLessThanOrEqual(0.2);
        expect(Math.min(cols, rows)).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("makes a 5 by 4 board of a landscape painting", () => {
    expect(gridFor(1000, 800, DAILY_PIECES)).toEqual({ cols: 5, rows: 4 });
  });
});

describe("dailyPainting", () => {
  it("gives everyone the same painting for a puzzle", () => {
    expect(dailyPainting(9, paintings)).toEqual(dailyPainting(9, paintings));
  });

  it("shows every painting once per cycle", () => {
    for (let cycle = 0; cycle < 5; cycle++) {
      const ids = Array.from(
        { length: paintings.length },
        (_, i) => dailyPainting(cycle * paintings.length + i + 1, paintings).id,
      );
      expect(new Set(ids).size).toBe(paintings.length);
    }
  });

  it("never repeats a painting on consecutive days", () => {
    for (let puzzle = 1; puzzle < 700; puzzle++) {
      expect(dailyPainting(puzzle, paintings).id).not.toBe(dailyPainting(puzzle + 1, paintings).id);
    }
  });
});

const grids = DIFFICULTIES.map(({ pieces }) => gridFor(1000, 800, pieces));
const tables = [
  { name: "portrait", width: 1500, height: 2400 },
  { name: "landscape", width: 2600, height: 1300 },
];

const single = (id: number, x: number, y: number): PieceGroup => ({ id, pieces: [id], x, y });
const stateOf = (groups: PieceGroup[]): RoundState => ({ groups, moves: 0, peeks: 0, guided: false });
const pieceCount = (state: RoundState): number => state.groups.reduce((sum, g) => sum + g.pieces.length, 0);

describe("scatter", () => {
  it.each(grids.flatMap((grid) => tables.map((table) => [grid, table] as const)))(
    "is deterministic, on the table and clear of neighbours (%j, %j)",
    (grid, table) => {
      const jigsaw = cutJigsaw(1000, 800, grid, 3);
      const total = grid.cols * grid.rows;
      const all = Array.from({ length: total }, (_, i) => i);
      for (const seed of [1, 2, 3, 40]) {
        const first = scatter(jigsaw, seed, table, all);
        expect(scatter(jigsaw, seed, table, all)).toEqual(first);

        const left = (jigsaw.width - table.width) / 2;
        const top = (jigsaw.height - table.height) / 2;
        const { width, height } = cellSize(jigsaw);
        for (const { piece, x, y } of first) {
          const cx = ((piece % grid.cols) + 0.5) * width + x;
          const cy = (Math.floor(piece / grid.cols) + 0.5) * height + y;
          expect(cx).toBeGreaterThanOrEqual(left);
          expect(cx).toBeLessThanOrEqual(left + table.width);
          expect(cy).toBeGreaterThanOrEqual(top);
          expect(cy).toBeLessThanOrEqual(top + table.height);
        }

        const state = stateOf(first.map(({ piece, x, y }) => single(piece, x, y)));
        const tolerance = snapDistance(jigsaw, 0.5);
        for (const a of state.groups) {
          for (const b of state.groups) {
            if (a !== b) expect(groupsFit(a, b, jigsaw, tolerance)).toBe(false);
          }
        }
      }
    },
  );

  it("arranges the same way on different screens, as fractions of the table", () => {
    const jigsaw = cutJigsaw(1000, 800, { cols: 5, rows: 4 }, 1);
    const all = Array.from({ length: 20 }, (_, i) => i);
    const small = scatter(jigsaw, 9, { width: 1200, height: 1000 }, all);
    const large = scatter(jigsaw, 9, { width: 2400, height: 2000 }, all);
    expect(small.map((p) => p.piece)).toEqual(large.map((p) => p.piece));
  });
});

describe("groupsFit", () => {
  const jigsaw = cutJigsaw(1000, 800, { cols: 5, rows: 4 }, 2);

  it("needs adjacency and a near-equal translation", () => {
    expect(groupsFit(single(0, 50, 50), single(1, 52, 49), jigsaw, 10)).toBe(true);
    // Neighbours, but too far apart.
    expect(groupsFit(single(0, 50, 50), single(1, 90, 50), jigsaw, 10)).toBe(false);
    // Same translation, but not neighbours (diagonal and distant).
    expect(groupsFit(single(0, 50, 50), single(6, 50, 50), jigsaw, 10)).toBe(false);
    expect(groupsFit(single(0, 50, 50), single(19, 50, 50), jigsaw, 10)).toBe(false);
  });

  it("lists up to four neighbours", () => {
    expect(neighbours(0, jigsaw).sort()).toEqual([1, 5]);
    expect(neighbours(6, jigsaw).sort((a, b) => a - b)).toEqual([1, 5, 7, 11]);
  });
});

describe("joinGroup", () => {
  const jigsaw = cutJigsaw(1000, 800, { cols: 5, rows: 4 }, 2);

  it("lets the dropped chunk adopt the still chunk's translation", () => {
    const state = stateOf([single(0, 100, 100), single(1, 103, 98)]);
    const { state: next, joined } = joinGroup(state, 1, jigsaw, 10);
    expect(joined).toBe(1);
    expect(next.groups).toEqual([{ id: 0, pieces: [0, 1], x: 100, y: 100 }]);
  });

  it("chains through several chunks and keeps every piece once", () => {
    const state = stateOf([single(0, 100, 100), single(2, 100, 100), single(1, 102, 101), single(7, 500, 0)]);
    const { state: next, joined } = joinGroup(state, 1, jigsaw, 10);
    expect(joined).toBe(2);
    expect(next.groups).toHaveLength(2);
    expect(pieceCount(next)).toBe(4);
    expect(next.groups[next.groups.length - 1].pieces).toEqual([0, 1, 2]);
  });

  it("changes nothing when nothing fits", () => {
    const state = stateOf([single(0, 0, 0), single(1, 300, 0)]);
    expect(joinGroup(state, 0, jigsaw, 10)).toEqual({ state, joined: 0 });
  });

  it("always ends with one group from a randomised playthrough", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const table = tables[seed % 2];
      let state = createRound(jigsaw, seed, table);
      let n = seed * 7919;
      const random = () => (n = (n * 1103515245 + 12345) % 2147483648) / 2147483648;
      let guard = 0;
      while (!isComplete(state) && guard++ < 2000) {
        const group = state.groups[Math.floor(random() * state.groups.length)];
        const partner = state.groups.find(
          (other) =>
            other !== group &&
            other.pieces.some((p) => group.pieces.some((q) => neighbours(q, jigsaw).includes(p))),
        );
        if (!partner) continue;
        // Drop it near, but not exactly on, where it belongs.
        state = joinGroup(moveGroup(state, group.id, partner.x + 4, partner.y - 3), group.id, jigsaw, 12).state;
        expect(pieceCount(state)).toBe(20);
      }
      expect(isComplete(state)).toBe(true);
    }
  });
});

describe("tryPair", () => {
  const jigsaw = cutJigsaw(1000, 800, { cols: 5, rows: 4 }, 2);

  it("joins true neighbours wherever they are", () => {
    const state = stateOf([single(6, -300, 200), single(7, 410, -90), single(18, 5, 5)]);
    const next = tryPair(state, 6, 7, jigsaw);
    expect(next).not.toBeNull();
    expect(next?.groups).toContainEqual({ id: 6, pieces: [6, 7], x: 410, y: -90 });
    expect(next?.moves).toBe(1);
  });

  it("returns null for pieces that don't touch", () => {
    const state = stateOf([single(6, 0, 0), single(8, 0, 0)]);
    expect(tryPair(state, 6, 8, jigsaw)).toBeNull();
    expect(tryPair(state, 6, 6, jigsaw)).toBeNull();
  });
});

describe("chunk moves", () => {
  it("moves and raises a chunk, counting a move", () => {
    const state = stateOf([single(0, 1, 1), single(1, 2, 2), single(2, 3, 3)]);
    const moved = moveGroup(state, 0, 9, 8);
    expect(moved.groups.map((g) => g.id)).toEqual([1, 2, 0]);
    expect(moved.groups[2]).toMatchObject({ x: 9, y: 8 });
    expect(moved.moves).toBe(1);
    const raised = raiseGroup(state, 1);
    expect(raised.groups.map((g) => g.id)).toEqual([0, 2, 1]);
    expect(raised.moves).toBe(0);
    expect(raiseGroup(raised, 1)).toBe(raised);
  });

  it("knows when the painting is whole", () => {
    expect(isComplete(stateOf([{ id: 0, pieces: [0, 1], x: 0, y: 0 }]))).toBe(true);
    expect(isComplete(stateOf([single(0, 0, 0), single(1, 0, 0)]))).toBe(false);
  });

  it("measures the biggest chunk and the connection", () => {
    const state = stateOf([{ id: 0, pieces: [0, 1, 2], x: 0, y: 0 }, single(3, 0, 0), single(4, 0, 0)]);
    expect(largestGroup(state)).toBe(3);
    expect(connection(state, 5)).toBe(0.5);
    expect(connection(stateOf(Array.from({ length: 5 }, (_, i) => single(i, 0, 0))), 5)).toBe(0);
    expect(connection(stateOf([{ id: 0, pieces: [0, 1, 2, 3, 4], x: 0, y: 0 }]), 5)).toBe(1);
  });
});

describe("snapDistance", () => {
  const jigsaw = cutJigsaw(1000, 800, { cols: 5, rows: 4 }, 2);

  it("uses a share of the cell, and never less than the pixel floor", () => {
    expect(snapDistance(jigsaw, 1)).toBeCloseTo(32);
    expect(snapDistance(jigsaw, 0.1)).toBeCloseTo(MIN_SNAP_PX / 0.1);
  });
});

describe("tidy", () => {
  const jigsaw = cutJigsaw(1000, 800, { cols: 5, rows: 4 }, 2);
  const table = { width: 1600, height: 1800 };

  it("moves only loose pieces and costs no move", () => {
    const chunk: PieceGroup = { id: 0, pieces: [0, 1], x: 200, y: 300 };
    const state: RoundState = {
      groups: [chunk, single(5, 10, 10), single(9, 20, 20), single(14, 30, 30)],
      moves: 4,
      peeks: 0,
      guided: false,
    };
    const next = tidy(state, jigsaw, 3, table);
    expect(next.groups[0]).toBe(chunk);
    expect(next.moves).toBe(4);
    expect(next.groups.map((g) => g.id)).toEqual([0, 5, 9, 14]);
    expect(next.groups.slice(1).some((g, i) => g.x !== state.groups[i + 1].x)).toBe(true);
  });

  it("returns the same state when nothing is loose", () => {
    const state = stateOf([{ id: 0, pieces: [0, 1], x: 0, y: 0 }]);
    expect(tidy(state, jigsaw, 3, table)).toBe(state);
  });
});

describe("clampGroups and progress", () => {
  const jigsaw = cutJigsaw(1000, 800, { cols: 5, rows: 4 }, 2);

  it("pulls chunks back onto a smaller table", () => {
    const state = stateOf([single(0, 5000, -4000)]);
    const table = { width: 1200, height: 1000 };
    const next = clampGroups(state, jigsaw, table);
    const cell = cellSize(jigsaw);
    expect(next.groups[0].x + cell.width).toBeLessThanOrEqual((1000 - 1200) / 2 + 1200 + 0.001);
    expect(next.groups[0].y).toBeGreaterThanOrEqual((800 - 1000) / 2 - 0.001);
    expect(clampGroups(next, jigsaw, table)).toBe(next);
  });

  it("trusts saved progress only when every piece appears once", () => {
    const whole = Array.from({ length: 20 }, (_, i) => single(i, 0, 0));
    const merged: PieceGroup[] = [{ id: 0, pieces: [0, 1], x: 0, y: 0 }, ...whole.slice(2)];
    expect(isValidState(stateOf(merged), 20)).toBe(true);
    expect(isValidState(stateOf(whole.slice(1)), 20)).toBe(false);
    expect(isValidState(stateOf([...merged, single(1, 0, 0)]), 20)).toBe(false);
    expect(isValidState(stateOf([{ ...merged[0], x: Number.NaN }, ...merged.slice(1)]), 20)).toBe(false);
    expect(isValidState({ ...stateOf(merged), groups: "no" as unknown as PieceGroup[] }, 20)).toBe(false);
    const finished = [{ id: 0, pieces: Array.from({ length: 20 }, (_, i) => i), x: 0, y: 0 }];
    expect(isValidState(stateOf(finished), 20)).toBe(false);
  });
});

describe("table layout", () => {
  const jigsaw = cutJigsaw(1000, 800, { cols: 5, rows: 4 }, 2);

  it("fits and centres the finished painting", () => {
    const layout = tableLayout(jigsaw, 400, 800);
    expect(layout.boardWidth).toBeLessThanOrEqual(400);
    expect(layout.originX).toBeCloseTo((400 - layout.boardWidth) / 2);
    expect(tableUnits(layout).width).toBeCloseTo(400 / layout.scale);
    expect(groupTransform(layout, 0, 0)).toContain(`${Math.round(layout.originX * 100) / 100}px`);
  });
});

describe("results", () => {
  it("formats time as m:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(59_999)).toBe("0:59");
    expect(formatTime(102_400)).toBe("1:42");
    expect(formatTime(3_725_000)).toBe("62:05");
  });

  it("ranks by seconds per piece", () => {
    expect(rankForTime(100_000, 20)).toBe("Master Restorer");
    expect(rankForTime(100_001, 20)).toBe("Conservator");
    expect(rankForTime(180_000, 20)).toBe("Conservator");
    expect(rankForTime(180_001, 20)).toBe("Studio Apprentice");
    expect(rankForTime(300_000, 20)).toBe("Studio Apprentice");
    expect(rankForTime(300_001, 20)).toBe("Patient Visitor");
  });
});

describe("parseChallenge", () => {
  it("reads a valid link", () => {
    expect(parseChallenge("?p=3&vs=102", 10)).toEqual({ puzzle: 3, seconds: 102 });
    expect(parseChallenge("?p=10&vs=86400", 10)).toEqual({ puzzle: 10, seconds: 86_400 });
  });

  it.each(["", "?p=3", "?vs=5", "?p=11&vs=5", "?p=0&vs=5", "?p=3&vs=0", "?p=3&vs=86401", "?p=3&vs=1.5", "?p=x&vs=y"])(
    "ignores %s",
    (search) => {
      expect(parseChallenge(search, 10)).toBeNull();
    },
  );
});

describe("buildShareText", () => {
  const record: JigsawRecord = {
    puzzle: 3,
    totalMs: 102_000,
    pieces: 20,
    cols: 5,
    moves: 40,
    peeks: 1,
    guided: false,
  };

  it("shares a daily time without giving away the painting", () => {
    expect(buildShareText(3, record)).toBe("ArtTok Jigsaw No. 3\n1:42, 20 pieces\nCan you beat me?");
  });

  it("says when the Guide was on", () => {
    expect(buildShareText(3, { ...record, guided: true })).toBe(
      "ArtTok Jigsaw No. 3\n1:42, 20 pieces\nWith the Guide on\nCan you beat me?",
    );
  });

  it("names a practice round plainly", () => {
    expect(buildShareText(null, { ...record, puzzle: null }).startsWith("ArtTok Jigsaw\n1:42")).toBe(true);
  });
});
