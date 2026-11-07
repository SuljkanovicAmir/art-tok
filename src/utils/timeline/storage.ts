import type { TimelineRecord } from "../../types/timeline";

const STORAGE_KEY = "arttok-timeline-v1";

export function readRecords(): Record<string, TimelineRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, TimelineRecord>) : {};
  } catch {
    return {};
  }
}

export function saveRecord(record: TimelineRecord): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readRecords(), [record.puzzle]: record }),
    );
  } catch {
    // Storage full or blocked: the round still finishes, it just won't persist.
  }
}
