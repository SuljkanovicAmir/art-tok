import { useCallback, useEffect, useRef, useState } from "react";

export interface GameClock {
  /** Milliseconds on the clock, refreshed four times a second */
  elapsed: number;
  running: boolean;
  start: () => void;
  stop: () => void;
  /** The exact time right now, for saving and scoring */
  read: () => number;
}

/** A stopwatch built on performance.now, so it survives re-renders and can resume. */
export function useGameClock(initialMs = 0): GameClock {
  const [elapsed, setElapsed] = useState(initialMs);
  const [running, setRunning] = useState(false);
  const baseRef = useRef(initialMs);
  const startedRef = useRef<number | null>(null);

  const read = useCallback(
    () => baseRef.current + (startedRef.current === null ? 0 : performance.now() - startedRef.current),
    [],
  );

  const start = useCallback(() => {
    if (startedRef.current !== null) return;
    startedRef.current = performance.now();
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    if (startedRef.current === null) return;
    baseRef.current = read();
    startedRef.current = null;
    setRunning(false);
    setElapsed(baseRef.current);
  }, [read]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setElapsed(read()), 250);
    return () => window.clearInterval(timer);
  }, [running, read]);

  return { elapsed, running, start, stop, read };
}
