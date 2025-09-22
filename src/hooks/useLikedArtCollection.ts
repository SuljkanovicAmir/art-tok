import { useEffect, useState } from "react";
import artImagesStore from "../stores/ArtImagesStore";
import type { ArtPiece } from "../types/art";
import {
  LIKED_ART_STORAGE_EVENT,
  LIKED_ART_STORAGE_KEY,
  readLikedSet,
} from "../utils/likedArtStorage";

export function useLikedArtCollection() {
  const [likedIds, setLikedIds] = useState<number[]>(() => Array.from(readLikedSet()));

  useEffect(() => {
    const syncFromStorage = () => {
      setLikedIds(Array.from(readLikedSet()));
    };

    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LIKED_ART_STORAGE_KEY) {
        syncFromStorage();
      }
    };

    window.addEventListener(LIKED_ART_STORAGE_EVENT, syncFromStorage);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(LIKED_ART_STORAGE_EVENT, syncFromStorage);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const piecesById = new Map(artImagesStore.artPieces.map((piece) => [piece.id, piece]));
  const likedPieces = likedIds
    .map((id) => piecesById.get(id) ?? null)
    .filter((piece): piece is ArtPiece => Boolean(piece));

  return {
    likedPieces,
    likedIds,
  };
}
