import { describe, expect, it } from "vitest";
import type { PieceGroup, RoundState } from "../../types/jigsaw";
import { clampGroup, clampGroups, joinGroup, snapDistance } from "../jigsaw/game";
import { cellSize, cutJigsaw } from "../jigsaw/geometry";
import { tableLayout, tableUnits } from "../jigsaw/layout";
import { HOME_VIEW, MAX_ZOOM, clampPan, clampZoom, screenToWorld, worldToScreen, zoomAt } from "../jigsaw/view";

const WIDTH = 390;
const HEIGHT = 700;

describe("clampZoom", () => {
  it("stays in range and settles near 1 to exactly 1", () => {
    expect(clampZoom(0.4)).toBe(1);
    expect(clampZoom(1.01)).toBe(1);
    expect(clampZoom(2)).toBe(2);
    expect(clampZoom(9)).toBe(MAX_ZOOM);
  });
});

describe("clampPan", () => {
  it("never shows a gap past the table, at any zoom", () => {
    for (const zoom of [1, 1.5, 2, 3]) {
      for (const pan of [-5000, -100, 0, 300]) {
        const view = clampPan({ zoom, panX: pan, panY: pan }, WIDTH, HEIGHT);
        expect(view.panX).toBeLessThanOrEqual(0);
        expect(view.panY).toBeLessThanOrEqual(0);
        expect(view.panX + WIDTH * view.zoom).toBeGreaterThanOrEqual(WIDTH - 1e-9);
        expect(view.panY + HEIGHT * view.zoom).toBeGreaterThanOrEqual(HEIGHT - 1e-9);
      }
    }
  });

  it("has no room to pan at the whole table", () => {
    const view = clampPan({ zoom: 1, panX: -80, panY: 40 }, WIDTH, HEIGHT);
    expect(view.panX === 0 && view.panY === 0).toBe(true);
  });
});

describe("zoomAt", () => {
  it("keeps the anchor point still when no limit gets in the way", () => {
    const start = zoomAt(HOME_VIEW, 2, 200, 300, WIDTH, HEIGHT);
    const before = screenToWorld(start, 180, 340);
    const after = screenToWorld(zoomAt(start, 2.5, 180, 340, WIDTH, HEIGHT), 180, 340);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("returns to the whole table when zooming fully out", () => {
    const view = zoomAt(zoomAt(HOME_VIEW, 3, 40, 60, WIDTH, HEIGHT), 1, 300, 500, WIDTH, HEIGHT);
    expect(view).toEqual(HOME_VIEW);
  });
});

describe("screenToWorld", () => {
  it("round-trips with worldToScreen", () => {
    const view = { zoom: 2.2, panX: -310, panY: -95 };
    const world = screenToWorld(view, 123, 456);
    const screen = worldToScreen(view, world.x, world.y);
    expect(screen.x).toBeCloseTo(123);
    expect(screen.y).toBeCloseTo(456);
  });
});

describe("clampGroup", () => {
  const shapes = [
    { width: 1200, height: 800, grid: { cols: 5, rows: 4 } },
    { width: 808, height: 1200, grid: { cols: 4, rows: 6 } },
  ];

  it("keeps a chunk of any size fully on the table", () => {
    for (const { width, height, grid } of shapes) {
      const jigsaw = cutJigsaw(width, height, grid, 4);
      const table = tableUnits(tableLayout(jigsaw, WIDTH, HEIGHT));
      const left = (width - table.width) / 2;
      const top = (height - table.height) / 2;
      const cell = cellSize(jigsaw);
      const total = grid.cols * grid.rows;
      for (let size = 1; size <= total; size++) {
        for (const push of [-5000, 5000]) {
          const pieces = Array.from({ length: size }, (_, piece) => piece);
          const group: PieceGroup = { id: 0, pieces, x: push, y: push };
          const { x, y } = clampGroup(group, jigsaw, table);
          const rows = Math.ceil(size / grid.cols);
          const cols = size >= grid.cols ? grid.cols : size;
          expect(x).toBeGreaterThanOrEqual(left - 1e-6);
          expect(y).toBeGreaterThanOrEqual(top - 1e-6);
          expect(x + cols * cell.width).toBeLessThanOrEqual(left + table.width + 1e-6);
          expect(y + rows * cell.height).toBeLessThanOrEqual(top + table.height + 1e-6);
        }
      }
    }
  });

  it("leaves a chunk that's already on the table alone", () => {
    const jigsaw = cutJigsaw(1200, 800, { cols: 5, rows: 4 }, 4);
    const table = tableUnits(tableLayout(jigsaw, WIDTH, HEIGHT));
    const state: RoundState = {
      groups: [{ id: 0, pieces: [0], x: 10, y: 20 }],
      moves: 0,
      peeks: 0,
      guided: false,
    };
    expect(clampGroups(state, jigsaw, table)).toBe(state);
  });
});

describe("snap sensitivity", () => {
  const jigsaw = cutJigsaw(1200, 800, { cols: 5, rows: 4 }, 4);
  const scale = tableLayout(jigsaw, WIDTH, HEIGHT).scale;
  const tolerance = snapDistance(jigsaw, scale);
  const pair = (gap: number): RoundState => ({
    groups: [
      { id: 0, pieces: [0], x: 0, y: 0 },
      { id: 1, pieces: [1], x: gap, y: 0 },
    ],
    moves: 0,
    peeks: 0,
    guided: false,
  });

  it("needs pieces lined up to within a small share of a piece on a phone", () => {
    const shortSide = Math.min(cellSize(jigsaw).width, cellSize(jigsaw).height);
    expect(tolerance / shortSide).toBeLessThanOrEqual(0.2);
    expect(tolerance * scale).toBeLessThanOrEqual(12);
  });

  it("joins just inside the limit and not just outside it", () => {
    expect(joinGroup(pair(tolerance * 0.95), 1, jigsaw, tolerance).joined).toBe(1);
    expect(joinGroup(pair(tolerance * 1.05), 1, jigsaw, tolerance).joined).toBe(0);
  });
});
