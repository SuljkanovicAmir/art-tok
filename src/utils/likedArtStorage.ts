export const LIKED_ART_STORAGE_KEY = "arttok-liked-art";
export const LIKED_ART_STORAGE_EVENT = "liked-art:updated";

export function readLikedSet(): Set<number> {
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
      return new Set(parsed.filter((value) => typeof value === "number"));
    }
  } catch (error) {
    console.warn("Failed to read liked art from storage", error);
  }

  return new Set();
}

export function writeLikedSet(set: Set<number>) {
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
