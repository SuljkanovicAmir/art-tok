import type { Jigsaw } from "../../types/jigsaw";
import type { Table } from "./game";

/** Where the finished painting sits on the table, in screen pixels. */
export interface TableLayout {
  width: number;
  height: number;
  /** Screen pixels per board unit */
  scale: number;
  originX: number;
  originY: number;
  boardWidth: number;
  boardHeight: number;
}

/** The finished painting always fits the table, centred, with a little air around it. */
export function tableLayout(jigsaw: Jigsaw, width: number, height: number): TableLayout {
  const scale = Math.min(width / jigsaw.width, height / jigsaw.height) * 0.96;
  const boardWidth = jigsaw.width * scale;
  const boardHeight = jigsaw.height * scale;
  return {
    width,
    height,
    scale,
    originX: (width - boardWidth) / 2,
    originY: (height - boardHeight) / 2,
    boardWidth,
    boardHeight,
  };
}

export const tableUnits = (layout: TableLayout): Table => ({
  width: layout.width / layout.scale,
  height: layout.height / layout.scale,
});

/** The transform that puts a group at a translation in board units. */
export const groupTransform = (layout: TableLayout, x: number, y: number): string =>
  `translate3d(${Math.round((layout.originX + x * layout.scale) * 100) / 100}px, ${
    Math.round((layout.originY + y * layout.scale) * 100) / 100
  }px, 0)`;
