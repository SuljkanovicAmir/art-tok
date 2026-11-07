import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { prefersReducedMotion } from "../utils/jigsaw/flight";
import { HOME_VIEW, clampPan, viewTransform, worldToScreen, zoomAt } from "../utils/jigsaw/view";
import type { View } from "../utils/jigsaw/view";

const WHEEL_SPEED = 0.0016;
/** Trackpad pinches arrive as ctrl+wheel with much smaller deltas. */
const PINCH_WHEEL_SPEED = 0.012;
/** How close to the table's edge a point can be before `reveal` moves the view. */
const REVEAL_MARGIN = 48;

export interface TableView {
  /** Zoom, rounded for display. Exactly 1 at the whole table. */
  zoom: number;
  read: () => View;
  /** Moves the camera. Written straight to the element, so gestures skip React. */
  set: (next: View, easeMs?: number) => void;
  /** Multiplies the zoom around a table point, or around the centre if none is given. */
  zoomBy: (factor: number, x?: number, y?: number) => void;
  /** Zooms in to a point, or back out to the whole table. */
  toggleAt: (x: number, y: number) => void;
  reset: () => void;
  /** Re-applies the limits after the table changes size. */
  refit: () => void;
  /** Eases the camera to a world point if it's out of sight. */
  reveal: (x: number, y: number) => void;
}

/** Writes the camera to the element. Plain DOM, so a gesture never waits for React. */
function writeView(world: HTMLElement, view: View, easeMs: number, previous: number): number {
  window.clearTimeout(previous);
  world.style.transition =
    easeMs > 0 && !prefersReducedMotion() ? `transform ${easeMs}ms cubic-bezier(0.22, 1, 0.36, 1)` : "";
  world.style.transform = viewTransform(view);
  return easeMs > 0
    ? window.setTimeout(() => {
        world.style.transition = "";
      }, easeMs + 40)
    : 0;
}

export function useTableView(
  tableRef: RefObject<HTMLElement | null>,
  worldRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): TableView {
  const viewRef = useRef<View>(HOME_VIEW);
  const enabledRef = useRef(enabled);
  const easeRef = useRef(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    enabledRef.current = enabled;
  });

  const read = useCallback(() => viewRef.current, []);

  const set = useCallback(
    (next: View, easeMs = 0) => {
      const table = tableRef.current;
      const world = worldRef.current;
      if (!table || !world) return;
      const view = clampPan(next, table.clientWidth, table.clientHeight);
      viewRef.current = view;
      easeRef.current = writeView(world, view, easeMs, easeRef.current);
      setZoom(Math.round(view.zoom * 10) / 10);
    },
    [tableRef, worldRef],
  );

  const zoomBy = useCallback(
    (factor: number, x?: number, y?: number) => {
      const table = tableRef.current;
      if (!table) return;
      const width = table.clientWidth;
      const height = table.clientHeight;
      const view = viewRef.current;
      set(zoomAt(view, view.zoom * factor, x ?? width / 2, y ?? height / 2, width, height), 180);
    },
    [set, tableRef],
  );

  const toggleAt = useCallback(
    (x: number, y: number) => {
      const table = tableRef.current;
      if (!table) return;
      const view = viewRef.current;
      const target = view.zoom > 1 ? 1 : 2;
      set(zoomAt(view, target, x, y, table.clientWidth, table.clientHeight), 200);
    },
    [set, tableRef],
  );

  const reset = useCallback(() => set(HOME_VIEW, 300), [set]);
  const refit = useCallback(() => set(viewRef.current), [set]);

  const reveal = useCallback(
    (x: number, y: number) => {
      const table = tableRef.current;
      const view = viewRef.current;
      if (!table || view.zoom <= 1) return;
      const width = table.clientWidth;
      const height = table.clientHeight;
      const spot = worldToScreen(view, x, y);
      const inside =
        spot.x > REVEAL_MARGIN &&
        spot.y > REVEAL_MARGIN &&
        spot.x < width - REVEAL_MARGIN &&
        spot.y < height - REVEAL_MARGIN;
      if (inside) return;
      set({ zoom: view.zoom, panX: width / 2 - x * view.zoom, panY: height / 2 - y * view.zoom }, 220);
    },
    [set, tableRef],
  );

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const onWheel = (event: WheelEvent) => {
      // Always claimed, so a trackpad pinch can't zoom the whole page instead.
      event.preventDefault();
      if (!enabledRef.current) return;
      const rect = table.getBoundingClientRect();
      const speed = event.ctrlKey ? PINCH_WHEEL_SPEED : WHEEL_SPEED;
      const view = viewRef.current;
      set(
        zoomAt(
          view,
          view.zoom * Math.exp(-event.deltaY * speed),
          event.clientX - rect.left,
          event.clientY - rect.top,
          table.clientWidth,
          table.clientHeight,
        ),
      );
    };
    table.addEventListener("wheel", onWheel, { passive: false });
    return () => table.removeEventListener("wheel", onWheel);
  }, [set, tableRef]);

  return { zoom, read, set, zoomBy, toggleAt, reset, refit, reveal };
}

