import { useEffect } from "react";
import type { RefObject } from "react";

/** Latest versions of what the game does in response to the keyboard and the page. */
export interface GameEvents {
  deselect: () => void;
  toggleGuide: () => void;
  startPeek: () => void;
  endPeek: () => void;
  zoom: (factor: number) => void;
  resetZoom: () => void;
  pause: () => void;
  persist: () => void;
}

const ZOOM_STEP = 1.4;

/** Keyboard shortcuts, plus pausing and saving when the page is hidden or left. */
export function useGameEvents(events: RefObject<GameEvents>): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "escape") events.current.deselect();
      else if (key === "p" && !event.repeat) events.current.startPeek();
      else if (key === "g" && !event.repeat) events.current.toggleGuide();
      else if (key === "+" || key === "=") events.current.zoom(ZOOM_STEP);
      else if (key === "-") events.current.zoom(1 / ZOOM_STEP);
      else if (key === "0") events.current.resetZoom();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "p") events.current.endPeek();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") events.current.pause();
      events.current.persist();
    };
    const onPageHide = () => events.current.persist();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onHide);
    const current = events.current;
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onHide);
      current.persist();
    };
  }, [events]);
}
