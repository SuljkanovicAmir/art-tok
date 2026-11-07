import type { EdgeCut, GridSize, Jigsaw, PieceBounds, Point } from "../../types/jigsaw";
import { seededRandom } from "../timeline/game";

/** Tab depth, as a fraction of a cell's short side. */
const TAB = 0.105;
/** How far a piece's canvas extends past its cell, as a fraction of the short side. */
export const PIECE_PADDING = 0.36;

const round2 = (value: number): number => Math.round(value * 100) / 100;
const fmt = (point: Point): string => `${round2(point.x)} ${round2(point.y)}`;

/** Cuts the same shapes on every device for a given seed. */
export function cutJigsaw(width: number, height: number, grid: GridSize, seed: number): Jigsaw {
  const random = seededRandom(seed * 40503 + grid.cols * 7 + grid.rows);
  const spread = (amount: number): number => (random() * 2 - 1) * amount;
  const edge = (): EdgeCut => ({
    flip: random() < 0.5 ? 1 : -1,
    shift: spread(0.06),
    skew: spread(0.03),
    lift: spread(0.03),
    startBend: spread(0.03),
    endBend: spread(0.03),
  });
  const edges = (rows: number, cols: number): EdgeCut[][] =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, edge));

  return {
    ...grid,
    width,
    height,
    horizontal: edges(grid.rows - 1, grid.cols),
    vertical: edges(grid.rows, grid.cols - 1),
  };
}

export function cellSize(jigsaw: Jigsaw): { width: number; height: number } {
  return { width: jigsaw.width / jigsaw.cols, height: jigsaw.height / jigsaw.rows };
}

export function cellOf(piece: number, cols: number): { col: number; row: number } {
  return { col: piece % cols, row: Math.floor(piece / cols) };
}

/** Ten bezier points for an edge from (0,0) to (length,0). `unit` is the cell's short side. */
function edgeCurve(cut: EdgeCut, length: number, unit: number): Point[] {
  const middle = length * 0.5 + cut.shift * length;
  const across = (v: number): number => v * unit * cut.flip;
  const along = (v: number): number => middle + v * unit;
  const neck = across(TAB + cut.lift);
  const under = across(cut.lift - TAB);
  const crown = across(3 * TAB + cut.lift);
  const { skew } = cut;

  return [
    { x: 0, y: 0 },
    { x: length * 0.2, y: across(cut.startBend) },
    { x: along(skew), y: under },
    { x: along(-TAB), y: neck },
    { x: along(skew - 2 * TAB), y: crown },
    { x: along(skew + 2 * TAB), y: crown },
    { x: along(TAB), y: neck },
    { x: along(skew), y: under },
    { x: length * 0.8, y: across(cut.endBend) },
    { x: length, y: 0 },
  ];
}

/** The edge below `row` at `col`, in board coordinates, running left to right. */
function horizontalEdge(jigsaw: Jigsaw, row: number, col: number): Point[] {
  const { width, height } = cellSize(jigsaw);
  const left = col * width;
  const lineY = (row + 1) * height;
  return edgeCurve(jigsaw.horizontal[row][col], width, Math.min(width, height)).map((p) => ({
    x: round2(left + p.x),
    y: round2(lineY + p.y),
  }));
}

/** The edge right of `col` at `row`, in board coordinates, running top to bottom. */
function verticalEdge(jigsaw: Jigsaw, row: number, col: number): Point[] {
  const { width, height } = cellSize(jigsaw);
  const top = row * height;
  const lineX = (col + 1) * width;
  return edgeCurve(jigsaw.vertical[row][col], height, Math.min(width, height)).map((p) => ({
    x: round2(lineX + p.y),
    y: round2(top + p.x),
  }));
}

/** Bezier segments for a point list whose first point is already the current point. */
function curveTo(points: Point[]): string {
  const segments: string[] = [];
  for (let i = 1; i + 2 < points.length; i += 3) {
    segments.push(`C${fmt(points[i])} ${fmt(points[i + 1])} ${fmt(points[i + 2])}`);
  }
  return segments.join("");
}

/** SVG path of a piece, clockwise from its top-left corner. */
export function piecePath(jigsaw: Jigsaw, piece: number): string {
  const { col, row } = cellOf(piece, jigsaw.cols);
  const { width, height } = cellSize(jigsaw);
  const left = col * width;
  const top = row * height;
  const right = left + width;
  const bottom = top + height;
  const corner = (x: number, y: number): string => `L${fmt({ x, y })}`;

  let path = `M${fmt({ x: left, y: top })}`;
  path += row > 0 ? curveTo(horizontalEdge(jigsaw, row - 1, col)) : corner(right, top);
  path += col < jigsaw.cols - 1 ? curveTo(verticalEdge(jigsaw, row, col)) : corner(right, bottom);
  path +=
    row < jigsaw.rows - 1
      ? curveTo(horizontalEdge(jigsaw, row, col).reverse())
      : corner(left, bottom);
  path += col > 0 ? curveTo(verticalEdge(jigsaw, row, col - 1).reverse()) : corner(left, top);
  return `${path}Z`;
}

/** The cell rectangle grown on every side, so tabs fit inside a piece's canvas. */
export function pieceBounds(jigsaw: Jigsaw, piece: number): PieceBounds {
  const { col, row } = cellOf(piece, jigsaw.cols);
  const { width, height } = cellSize(jigsaw);
  const pad = Math.min(width, height) * PIECE_PADDING;
  return {
    x: col * width - pad,
    y: row * height - pad,
    width: width + pad * 2,
    height: height + pad * 2,
  };
}

/** Every inner edge as one path, for the outlines on the empty board. */
export function allCutsPath(jigsaw: Jigsaw): string {
  const parts: string[] = [];
  const add = (points: Point[]): void => {
    parts.push(`M${fmt(points[0])}${curveTo(points)}`);
  };
  for (let row = 0; row < jigsaw.rows - 1; row++) {
    for (let col = 0; col < jigsaw.cols; col++) add(horizontalEdge(jigsaw, row, col));
  }
  for (let row = 0; row < jigsaw.rows; row++) {
    for (let col = 0; col < jigsaw.cols - 1; col++) add(verticalEdge(jigsaw, row, col));
  }
  return parts.join("");
}
