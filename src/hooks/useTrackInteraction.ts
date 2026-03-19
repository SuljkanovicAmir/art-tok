import { useCallback, useEffect, useRef } from "react";
import type { ArtPiece } from "../types/art";
import { recordInteraction } from "../utils/preferenceEngine";

export function useTrackInteraction(artwork: ArtPiece | null) {
  const viewRecorded = useRef(false);

  useEffect(() => {
    if (!artwork) return;
    viewRecorded.current = false;

    const timer = setTimeout(() => {
      if (!viewRecorded.current) {
        recordInteraction(artwork, "view");
        viewRecorded.current = true;
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [artwork]);

  const trackLike = useCallback(() => {
    if (artwork) recordInteraction(artwork, "like");
  }, [artwork]);

  const trackShare = useCallback(() => {
    if (artwork) recordInteraction(artwork, "share");
  }, [artwork]);

  const trackDetail = useCallback(() => {
    if (artwork) recordInteraction(artwork, "detail");
  }, [artwork]);

  const trackSkip = useCallback(() => {
    if (artwork && !viewRecorded.current) recordInteraction(artwork, "skip");
  }, [artwork]);

  return { trackLike, trackShare, trackDetail, trackSkip };
}
