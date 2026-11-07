import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { Jigsaw, PieceGroup, Point } from "../types/jigsaw";
import { cellOf, cellSize, piecePath } from "../utils/jigsaw/geometry";
import { groupTransform } from "../utils/jigsaw/layout";
import type { TableLayout } from "../utils/jigsaw/layout";
import { clampPan, screenToWorld } from "../utils/jigsaw/view";
import type { View } from "../utils/jigsaw/view";
import type { TableView } from "./useTableView";

/** Movement before a press counts as a drag, so a tap never moves a chunk. */
const DRAG_THRESHOLD = 5;
/** Touch and pen get this much slack when nothing is hit exactly, in screen pixels. */
const TOUCH_REACH_PX = 16;
/** Small chunks ease up by this many cells so a finger doesn't hide them. */
const LIFT_CELLS = 0.5;
const LIFT_MS = 120;
const MAX_LIFTED_PIECES = 3;
/** A held piece can go this far past the table, so it reaches any side of an edge chunk. */
const OVERHANG_CELLS = 0.75;
/** Near a table edge while zoomed, the view follows the held chunk. */
const EDGE_ZONE_PX = 44;
const EDGE_PAN_PX_PER_S = 420;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 28;

/** The chunk in the hand, and where it was grabbed as percentages of the board. */
export interface HeldGroup {
  id: number;
  ox: number;
  oy: number;
}

interface UseTableDragOptions {
  tableRef: RefObject<HTMLElement | null>;
  jigsaw: Jigsaw;
  layout: TableLayout | null;
  view: TableView;
  getGroups: () => PieceGroup[];
  enabled: boolean;
  onRaise: (id: number) => void;
  /** A tap on a chunk, or null for a tap on empty table */
  onTap: (id: number | null) => void;
  /** Resolves once the drop, and any join animation, is finished. */
  onDrop: (id: number, x: number, y: number) => Promise<void>;
}

interface Drag {
  pointerId: number;
  /** Null when the press began on empty table */
  group: PieceGroup | null;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  lift: number;
  movedAt: number;
  moved: boolean;
  /** Set while a press on empty table is dragging the view */
  panFrom: View | null;
  raf: number;
  lastFrame: number;
  x: number;
  y: number;
  layout: TableLayout;
  rect: { left: number; top: number; width: number; height: number };
  /** Where the pointer holds the chunk, as an offset from its translation */
  grab: Point;
  /** Allowed centre of the grabbed piece, in board units */
  bounds: { x0: number; y0: number; x1: number; y1: number };
  home: Point;
  el: HTMLElement | null;
}

interface Pinch {
  distance: number;
  /** The world point under the fingers when the pinch began */
  anchor: Point;
  zoom: number;
}

export interface TableHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
}

export interface TableDrag {
  held: HeldGroup | null;
  handlers: TableHandlers;
}

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

/** The pointer's position in board units. It stays right as the view moves underneath it. */
function pointerOnBoard(drag: Drag, view: View): Point {
  const world = screenToWorld(view, drag.curX - drag.rect.left, drag.curY - drag.rect.top);
  return { x: (world.x - drag.layout.originX) / drag.layout.scale, y: (world.y - drag.layout.originY) / drag.layout.scale };
}

/** Where the held chunk should be right now, from the pointer and the lift. */
function position(drag: Drag, view: View, now: number): Point {
  const eased = easeOut(Math.min(1, (now - drag.movedAt) / LIFT_MS));
  const pointer = pointerOnBoard(drag, view);
  const { bounds, home } = drag;
  return {
    x: Math.min(Math.max(pointer.x - drag.grab.x, bounds.x0 - home.x), bounds.x1 - home.x),
    y: Math.min(Math.max(pointer.y - drag.grab.y + drag.lift * eased, bounds.y0 - home.y), bounds.y1 - home.y),
  };
}

function apply(drag: Drag, view: View, now: number): void {
  const next = position(drag, view, now);
  drag.x = next.x;
  drag.y = next.y;
  if (drag.el) drag.el.style.transform = groupTransform(drag.layout, next.x, next.y);
}

/** How fast to pan for a pointer this far from the low and high edges of the table. */
function edgeSpeed(fromLow: number, fromHigh: number): number {
  if (fromLow < EDGE_ZONE_PX) return EDGE_PAN_PX_PER_S * (1 - Math.max(fromLow, 0) / EDGE_ZONE_PX);
  if (fromHigh < EDGE_ZONE_PX) return -EDGE_PAN_PX_PER_S * (1 - Math.max(fromHigh, 0) / EDGE_ZONE_PX);
  return 0;
}

/** Slides the view when a chunk is carried to the edge of a zoomed table. */
function panAtEdge(drag: Drag, tableView: TableView, seconds: number): void {
  const view = tableView.read();
  if (view.zoom <= 1) return;
  const x = drag.curX - drag.rect.left;
  const y = drag.curY - drag.rect.top;
  const speedX = edgeSpeed(x, drag.rect.width - x);
  const speedY = edgeSpeed(y, drag.rect.height - y);
  if (speedX === 0 && speedY === 0) return;
  tableView.set({ zoom: view.zoom, panX: view.panX + speedX * seconds, panY: view.panY + speedY * seconds });
}

/** Moves the held chunk on every frame, straight on the element and never through React. */
function follow(drag: Drag, tableView: TableView): void {
  const now = performance.now();
  panAtEdge(drag, tableView, Math.min(now - drag.lastFrame, 50) / 1000);
  drag.lastFrame = now;
  apply(drag, tableView.read(), now);
  drag.raf = requestAnimationFrame(() => follow(drag, tableView));
}

interface Hit {
  group: PieceGroup;
  piece: number;
}

/** Walks the chunks from the top and tests each piece's real outline. */
function hitTest(
  ctx: CanvasRenderingContext2D,
  paths: Path2D[],
  groups: PieceGroup[],
  x: number,
  y: number,
  reach: number,
): Hit | null {
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    for (const piece of group.pieces) {
      if (ctx.isPointInPath(paths[piece], x - group.x, y - group.y)) return { group, piece };
    }
  }
  if (reach <= 0) return null;
  ctx.lineWidth = reach * 2;
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    for (const piece of group.pieces) {
      if (ctx.isPointInStroke(paths[piece], x - group.x, y - group.y)) return { group, piece };
    }
  }
  return null;
}

export function useTableDrag(options: UseTableDragOptions): TableDrag {
  const [held, setHeld] = useState<HeldGroup | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const busyRef = useRef(false);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const optionsRef = useRef(options);
  const pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<Pinch | null>(null);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });

  useEffect(() => {
    optionsRef.current = options;
  });

  const paths = useMemo(
    () => Array.from({ length: options.jigsaw.cols * options.jigsaw.rows }, (_, p) => new Path2D(piecePath(options.jigsaw, p))),
    [options.jigsaw],
  );

  /** The two fingers' midpoint on the table, and how far apart they are. */
  const fingers = useCallback(() => {
    const table = optionsRef.current.tableRef.current;
    const [a, b] = [...pointersRef.current.values()];
    if (!table || !a || !b) return null;
    const rect = table.getBoundingClientRect();
    return {
      x: (a.x + b.x) / 2 - rect.left,
      y: (a.y + b.y) / 2 - rect.top,
      distance: Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1),
    };
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const { tableRef, jigsaw, layout, view, getGroups, enabled, onRaise } = optionsRef.current;
      const table = tableRef.current;
      if (!table || !layout || !enabled || busyRef.current) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      table.setPointerCapture(event.pointerId);

      if (pointersRef.current.size > 1) {
        // A second finger means pinch, unless a chunk is already in the hand.
        const current = dragRef.current;
        if (current?.moved) return;
        dragRef.current = null;
        const spot = fingers();
        if (spot) {
          pinchRef.current = {
            distance: spot.distance,
            anchor: screenToWorld(view.read(), spot.x, spot.y),
            zoom: view.read().zoom,
          };
        }
        return;
      }

      ctxRef.current ??= document.createElement("canvas").getContext("2d");
      const ctx = ctxRef.current;
      if (!ctx) return;
      const rect = table.getBoundingClientRect();
      const camera = view.read();
      const world = screenToWorld(camera, event.clientX - rect.left, event.clientY - rect.top);
      const x = (world.x - layout.originX) / layout.scale;
      const y = (world.y - layout.originY) / layout.scale;
      const touch = event.pointerType !== "mouse";
      const reach = touch ? TOUCH_REACH_PX / (layout.scale * camera.zoom) : 0;
      const hit = hitTest(ctx, paths, getGroups(), x, y, reach);

      const { width: cellW, height: cellH } = cellSize(jigsaw);
      const { col, row } = cellOf(hit?.piece ?? 0, jigsaw.cols);
      const tableW = layout.width / layout.scale;
      const tableH = layout.height / layout.scale;
      const left = (jigsaw.width - tableW) / 2;
      const top = (jigsaw.height - tableH) / 2;
      const overX = cellW * OVERHANG_CELLS;
      const overY = cellH * OVERHANG_CELLS;
      const group = hit?.group ?? null;

      dragRef.current = {
        pointerId: event.pointerId,
        group,
        startX: event.clientX,
        startY: event.clientY,
        curX: event.clientX,
        curY: event.clientY,
        lift: touch && group && group.pieces.length <= MAX_LIFTED_PIECES ? -LIFT_CELLS * Math.min(cellW, cellH) : 0,
        movedAt: 0,
        moved: false,
        panFrom: null,
        raf: 0,
        lastFrame: 0,
        x: group?.x ?? 0,
        y: group?.y ?? 0,
        layout,
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        grab: { x: x - (group?.x ?? 0), y: y - (group?.y ?? 0) },
        bounds: { x0: left - overX, y0: top - overY, x1: left + tableW + overX, y1: top + tableH + overY },
        home: { x: (col + 0.5) * cellW, y: (row + 0.5) * cellH },
        el: group ? table.querySelector<HTMLElement>(`[data-group="${group.id}"]`) : null,
      };
      if (group) onRaise(group.id);
    },
    [fingers, paths],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (pointersRef.current.has(event.pointerId)) {
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      const { view, jigsaw, tableRef } = optionsRef.current;

      const pinch = pinchRef.current;
      if (pinch) {
        const spot = fingers();
        const table = tableRef.current;
        if (spot && table) {
          const zoom = (pinch.zoom * spot.distance) / pinch.distance;
          view.set(
            clampPan(
              { zoom, panX: spot.x - pinch.anchor.x * zoom, panY: spot.y - pinch.anchor.y * zoom },
              table.clientWidth,
              table.clientHeight,
            ),
          );
        }
        return;
      }

      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.curX = event.clientX;
      drag.curY = event.clientY;
      const dx = drag.curX - drag.startX;
      const dy = drag.curY - drag.startY;

      if (!drag.group) {
        if (!drag.panFrom) {
          if (view.read().zoom <= 1 || Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          drag.panFrom = view.read();
        }
        view.set({ zoom: drag.panFrom.zoom, panX: drag.panFrom.panX + dx, panY: drag.panFrom.panY + dy });
        return;
      }

      if (drag.moved || Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      // Re-find the element: pressing raised the chunk, which may have re-ordered the DOM.
      drag.el = tableRef.current?.querySelector<HTMLElement>(`[data-group="${drag.group.id}"]`) ?? drag.el;
      drag.moved = true;
      drag.movedAt = performance.now();
      drag.lastFrame = drag.movedAt;
      setHeld({
        id: drag.group.id,
        ox: (drag.grab.x / jigsaw.width) * 100,
        oy: (drag.grab.y / jigsaw.height) * 100,
      });
      follow(drag, view);
    },
    [fingers],
  );

  const finish = useCallback(async (event: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    pointersRef.current.delete(event.pointerId);
    if (pinchRef.current) {
      if (pointersRef.current.size < 2) pinchRef.current = null;
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const { onTap, onDrop, view } = optionsRef.current;

    if (drag.panFrom) return;
    if (!drag.moved || !drag.group) {
      if (cancelled) return;
      if (!drag.group) {
        const last = lastTapRef.current;
        const now = performance.now();
        const isDouble =
          now - last.time < DOUBLE_TAP_MS && Math.hypot(drag.curX - last.x, drag.curY - last.y) < DOUBLE_TAP_PX;
        lastTapRef.current = isDouble ? { time: 0, x: 0, y: 0 } : { time: now, x: drag.curX, y: drag.curY };
        if (isDouble) view.toggleAt(drag.curX - drag.rect.left, drag.curY - drag.rect.top);
      }
      onTap(drag.group ? drag.group.id : null);
      return;
    }
    cancelAnimationFrame(drag.raf);
    apply(drag, view.read(), performance.now());
    busyRef.current = true;
    await onDrop(drag.group.id, drag.x, drag.y);
    busyRef.current = false;
    setHeld(null);
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => void finish(event, false), [finish]);
  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => void finish(event, true), [finish]);

  return { held, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
