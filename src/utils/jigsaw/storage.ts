import type { JigsawProgress, JigsawRecord } from "../../types/jigsaw";

const RECORDS_KEY = "arttok-jigsaw-v2";
const PROGRESS_KEY = "arttok-jigsaw-progress-v2";
const MUTED_KEY = "arttok-jigsaw-muted";
const GUIDE_KEY = "arttok-jigsaw-guide";

export function readRecords(): Record<string, JigsawRecord> {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, JigsawRecord>) : {};
  } catch {
    return {};
  }
}

/** Practice rounds (no puzzle number) are never saved. */
export function saveRecord(record: JigsawRecord): void {
  if (record.puzzle === null) return;
  try {
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({ ...readRecords(), [record.puzzle]: record }),
    );
  } catch {
    // Storage full or blocked: the round still finishes, it just won't persist.
  }
}

export function readProgress(puzzle: number): JigsawProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const progress = JSON.parse(raw) as JigsawProgress | null;
    return progress && progress.puzzle === puzzle ? progress : null;
  } catch {
    return null;
  }
}

export function saveProgress(progress: JigsawProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Unsaved progress only costs a restart after a reload.
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // Nothing to clear if storage is blocked.
  }
}

export function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
  } catch {
    // The preference just won't persist.
  }
}

export function readGuide(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveGuide(on: boolean): void {
  try {
    localStorage.setItem(GUIDE_KEY, on ? "1" : "0");
  } catch {
    // The preference just won't persist.
  }
}
