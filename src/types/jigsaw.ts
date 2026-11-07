export interface JigsawPainting {
  id: number;
  title: string;
  artist: string;
  /** Museum text, such as "ca. 1889" */
  date: string;
  /** Image size in pixels */
  width: number;
  height: number;
  /** Average colour, "#rrggbb" */
  color: string;
}

export interface GridSize {
  cols: number;
  rows: number;
}

/** The shape of one edge. Every value is a fraction of a cell. */
export interface EdgeCut {
  flip: 1 | -1;
  shift: number;
  skew: number;
  lift: number;
  startBend: number;
  endBend: number;
}

export interface Jigsaw extends GridSize {
  width: number;
  height: number;
  /** [row][col]: the edge below that row. rows - 1 by cols. */
  horizontal: EdgeCut[][];
  /** [row][col]: the edge right of that column. rows by cols - 1. */
  vertical: EdgeCut[][];
}

export interface Point {
  x: number;
  y: number;
}

export interface PieceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A chunk of joined pieces and one translation, in board units. (0,0) is the finished spot. */
export interface PieceGroup {
  /** The id of the group's first piece */
  id: number;
  pieces: number[];
  x: number;
  y: number;
}

export interface RoundState {
  /** Draw order, last on top */
  groups: PieceGroup[];
  moves: number;
  peeks: number;
  /** True once the Guide has been shown, even if it was switched off again */
  guided: boolean;
}

export interface JigsawRecord {
  /** null for a practice round */
  puzzle: number | null;
  totalMs: number;
  pieces: number;
  cols: number;
  moves: number;
  peeks: number;
  guided: boolean;
}

export interface JigsawProgress {
  puzzle: number;
  state: RoundState;
  elapsedMs: number;
}

export interface JigsawChallenge {
  puzzle: number;
  seconds: number;
}

export interface JigsawRound {
  /** null for a practice round */
  puzzle: number | null;
  painting: JigsawPainting;
  seed: number;
  /** Target piece count; the real count is cols * rows */
  pieces: number;
  grid: GridSize;
}

export type AssetStatus = "loading" | "ready" | "error";

export interface JigsawAssets {
  status: AssetStatus;
  image: HTMLImageElement | null;
  jigsaw: Jigsaw | null;
  pieces: HTMLCanvasElement[];
}

export type GamePhase = "preview" | "cut" | "scatter" | "play" | "finish";
