import { useEffect } from "react";
import type { RefObject } from "react";
import type { GamePhase } from "../types/jigsaw";
import { prefersReducedMotion } from "../utils/jigsaw/flight";
import { SCATTER_MS, SCATTER_STAGGER_MS } from "../utils/jigsaw/timing";

const PREVIEW_MS = 2200;
const CUT_MS = 600;
const FINISH_MS = 2300;

export type TableMotion = "tidying" | "settling";

interface GameSteps {
  advance: (from: GamePhase) => void;
  endMotion: (motion: TableMotion) => void;
}

/** Runs the opening sequence, table animations and the finish, each to its own clock. */
export function useGameTimers(
  steps: RefObject<GameSteps>,
  phase: GamePhase,
  motion: TableMotion | null,
  total: number,
  onComplete: () => void,
): void {
  useEffect(() => {
    if (phase !== "preview" && phase !== "cut" && phase !== "scatter") return;
    const wait = phase === "preview" ? PREVIEW_MS : phase === "cut" ? CUT_MS : SCATTER_MS + total * SCATTER_STAGGER_MS;
    const timer = window.setTimeout(() => steps.current.advance(phase), wait);
    return () => window.clearTimeout(timer);
  }, [phase, steps, total]);

  useEffect(() => {
    if (!motion) return;
    const timer = window.setTimeout(() => steps.current.endMotion(motion), motion === "tidying" ? 350 : 380);
    return () => window.clearTimeout(timer);
  }, [motion, steps]);

  useEffect(() => {
    if (phase !== "finish") return;
    const timer = window.setTimeout(onComplete, prefersReducedMotion() ? 800 : FINISH_MS);
    return () => window.clearTimeout(timer);
  }, [phase, onComplete]);
}
