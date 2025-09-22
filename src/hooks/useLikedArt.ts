import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "arttok-liked-art";

function readLikedSet(): Set<number> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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

function writeLikedSet(set: Set<number>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch (error) {
    console.warn("Failed to persist liked art to storage", error);
  }
}

export function useLikedArt(id: number) {
  const [isLiked, setIsLiked] = useState(() => readLikedSet().has(id));

  useEffect(() => {
    setIsLiked(readLikedSet().has(id));
  }, [id]);

  const toggleLike = useCallback(() => {
    const nextSet = readLikedSet();

    if (nextSet.has(id)) {
      nextSet.delete(id);
      setIsLiked(false);
    } else {
      nextSet.add(id);
      setIsLiked(true);
    }

    writeLikedSet(nextSet);
  }, [id]);

  return { isLiked, toggleLike };
}
