export const LIKED_ART_STORAGE_KEY = "arttok-liked-art";
export const LIKED_ART_STORAGE_EVENT = "liked-art:updated";

/**
 * Read liked art keys. Keys are composite strings: "harvard:12345".
 * Migrates legacy numeric-only data to "harvard:{id}" on first read.
 */
export function readLikedSet(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(LIKED_ART_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }

    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const migrated = new Set<string>();
      let needsMigration = false;

      for (const value of parsed) {
        if (typeof value === "string") {
          migrated.add(value);
        } else if (typeof value === "number") {
          // Legacy: numeric IDs are from Harvard
          migrated.add(`harvard:${value}`);
          needsMigration = true;
        }
      }

      // Persist migrated data
      if (needsMigration) {
        writeLikedSet(migrated);
      }

      return migrated;
    }
  } catch (error) {
    console.warn("Failed to read liked art from storage", error);
  }

  return new Set();
}

export function writeLikedSet(set: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      LIKED_ART_STORAGE_KEY,
      JSON.stringify(Array.from(set)),
    );
    window.dispatchEvent(new Event(LIKED_ART_STORAGE_EVENT));
  } catch (error) {
    console.warn("Failed to persist liked art to storage", error);
  }
}
