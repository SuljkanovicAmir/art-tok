import { useSyncExternalStore } from "react";
import type { ArtPiece } from "../types/art";
import { artKey } from "../utils/artKey";
import {
  LIKED_ART_STORAGE_EVENT,
  LIKED_ART_STORAGE_KEY,
  readLikedSet,
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

function getSnapshot() {
  return JSON.stringify(Array.from(readLikedSet()));
}

function getServerSnapshot() {
  return "[]";
}

export function useLikedArtCollection(availablePieces: ArtPiece[]) {
  const likedKeysJson = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const likedKeys: string[] = JSON.parse(likedKeysJson);

  const piecesByKey = new Map(availablePieces.map((piece) => [artKey(piece), piece]));
  const likedPieces = likedKeys
    .map((key) => piecesByKey.get(key) ?? null)
    .filter((piece): piece is ArtPiece => Boolean(piece));

  return { likedPieces, likedKeys };
}
