import type { Point } from "../../types/jigsaw";

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

/** The camera over the table. A world point shows at `pan + world * zoom` on screen. */
export interface View {
  zoom: number;
  panX: number;
  panY: number;
}

export const HOME_VIEW: View = { zoom: 1, panX: 0, panY: 0 };

/** Values this close to 1 count as 1, so a pinch can always settle back to the whole table. */
const ZOOM_SNAP = 1.02;

export function clampZoom(zoom: number): number {
  const limited = Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
  return limited < ZOOM_SNAP ? MIN_ZOOM : limited;
}

/** Keeps the table covered, so zooming and panning never show a gap at the edge. */
export function clampPan(view: View, width: number, height: number): View {
  const zoom = clampZoom(view.zoom);
  return {
    zoom,
    panX: Math.min(Math.max(view.panX, width * (1 - zoom)), 0),
    panY: Math.min(Math.max(view.panY, height * (1 - zoom)), 0),
  };
}

export const screenToWorld = (view: View, x: number, y: number): Point => ({
  x: (x - view.panX) / view.zoom,
  y: (y - view.panY) / view.zoom,
});

export const worldToScreen = (view: View, x: number, y: number): Point => ({
  x: view.panX + x * view.zoom,
  y: view.panY + y * view.zoom,
});

/** Changes zoom while the world point under (x, y) stays under (x, y). */
export function zoomAt(view: View, zoom: number, x: number, y: number, width: number, height: number): View {
  const anchor = screenToWorld(view, x, y);
  const next = clampZoom(zoom);
  return clampPan({ zoom: next, panX: x - anchor.x * next, panY: y - anchor.y * next }, width, height);
}

export const viewTransform = (view: View): string =>
  `translate3d(${Math.round(view.panX * 100) / 100}px, ${Math.round(view.panY * 100) / 100}px, 0) scale(${
    Math.round(view.zoom * 1000) / 1000
  })`;
