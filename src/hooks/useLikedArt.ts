import { useCallback, useEffect, useState } from "react";
import {
  LIKED_ART_STORAGE_EVENT,
  LIKED_ART_STORAGE_KEY,
  readLikedSet,
  writeLikedSet,
} from "../utils/likedArtStorage";

export function useLikedArt(id: number) {
  const [isLiked, setIsLiked] = useState(() => readLikedSet().has(id));

  useEffect(() => {
    const syncLikeState = () => {
      setIsLiked(readLikedSet().has(id));
    };

    syncLikeState();

    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LIKED_ART_STORAGE_KEY) {
        syncLikeState();
      }
    };

    window.addEventListener(LIKED_ART_STORAGE_EVENT, syncLikeState);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(LIKED_ART_STORAGE_EVENT, syncLikeState);
      window.removeEventListener("storage", handleStorage);
    };
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
