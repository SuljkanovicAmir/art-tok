import { useSyncExternalStore } from "react";
import {
  LIKED_ART_STORAGE_EVENT,
  LIKED_ART_STORAGE_KEY,
  readLikedSet,
  writeLikedSet,
} from "../utils/likedArtStorage";

function subscribe(callback: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === LIKED_ART_STORAGE_KEY) callback();
  };

  window.addEventListener(LIKED_ART_STORAGE_EVENT, callback);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(LIKED_ART_STORAGE_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function getServerSnapshot() {
  return false;
}

/**
 * @param artKey Composite key: "harvard:12345", "met:678", etc.
 */
export function useLikedArt(artKey: string) {
  const isLiked = useSyncExternalStore(
    subscribe,
    () => readLikedSet().has(artKey),
    getServerSnapshot,
  );

  const toggleLike = () => {
    const nextSet = readLikedSet();
    if (nextSet.has(artKey)) {
      nextSet.delete(artKey);
    } else {
      nextSet.add(artKey);
    }
    writeLikedSet(nextSet);
  };

  return { isLiked, toggleLike };
}
