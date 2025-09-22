import { useCallback, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import type { ArtPiece } from "../types/art";
import { useLikedArt } from "../hooks/useLikedArt";
import { useLikedArtCollection } from "../hooks/useLikedArtCollection";

interface LikedArtPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"
      fill="currentColor"
    />
  </svg>
);

const HeartFilledIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.54 0 3.04 0.99 3.57 2.36h0.21C10.81 4.99 12.31 4 13.85 4 16.34 4 18.35 6 18.35 8.5c0 3.78-3.4 6.86-8.55 11.54z"
      fill="currentColor"
    />
  </svg>
);

function LikedArtListItem({ piece }: { piece: ArtPiece }) {
  const { toggleLike } = useLikedArt(piece.id);

  return (
    <li className="liked-panel__item">
      <div className="liked-panel__thumb">
        <img src={piece.imageUrl} alt={`${piece.title} by ${piece.artist}`} loading="lazy" />
        <button
          type="button"
          className="liked-panel__thumb-like"
          aria-label={`Remove ${piece.title} from liked art`}
          onClick={toggleLike}
        >
          <HeartFilledIcon />
        </button>
      </div>
      <div className="liked-panel__details">
        <p className="liked-panel__title">{piece.title}</p>
        <p className="liked-panel__artist">{piece.artist}</p>
      </div>
    </li>
  );
}

export const LikedArtPanel = observer(function LikedArtPanel({ isOpen, onClose }: LikedArtPanelProps) {
  const { likedPieces, likedIds } = useLikedArtCollection();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const handleSwipeClose = useCallback(
    (event: TouchEvent) => {
      const panel = panelRef.current;
      if (!panel) {
        return;
      }

      const touchStart = event.touches[0];
      if (!touchStart) {
        return;
      }

      const startX = touchStart.clientX;
      const startY = touchStart.clientY;

      const handleTouchEnd = (endEvent: TouchEvent) => {
        const touchEnd = endEvent.changedTouches[0];
        const deltaX = touchEnd.clientX - startX;
        const deltaY = Math.abs(touchEnd.clientY - startY);

        if (deltaX > 70 && deltaY < 60) {
          onClose();
        }

        panel.removeEventListener("touchend", handleTouchEnd);
      };

      panel.addEventListener("touchend", handleTouchEnd, { once: true });
    },
    [onClose],
  );

  useEffect(() => {
    const panel = panelRef.current;

    if (!isOpen || !panel) {
      return;
    }

    panel.addEventListener("touchstart", handleSwipeClose);

    return () => {
      panel.removeEventListener("touchstart", handleSwipeClose);
    };
  }, [handleSwipeClose, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  const missingCount = likedIds.length - likedPieces.length;

  return (
    <aside
      className={`liked-panel ${isOpen ? "is-open" : ""}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
      aria-live="polite"
    >
      <div className="liked-panel__container" ref={panelRef}>
        <header className="liked-panel__header">
          <div>
            <p className="liked-panel__eyebrow">Your collection</p>
            <h2 className="liked-panel__heading">Liked art</h2>
          </div>
          <button type="button" className="liked-panel__close" onClick={onClose} aria-label="Close liked art">
            <CloseIcon />
          </button>
        </header>

        {likedPieces.length > 0 ? (
          <ul className="liked-panel__list">
            {likedPieces.map((piece) => (
              <LikedArtListItem key={piece.id} piece={piece} />
            ))}
          </ul>
        ) : (
          <div className="liked-panel__empty">
            <p>No liked artworks yet.</p>
            <p>Tap the heart on pieces you love to build your collection.</p>
          </div>
        )}

        {missingCount > 0 && (
          <p className="liked-panel__hint">
            {missingCount === 1
              ? "One liked artwork isn't loaded in this feed yet. Keep scrolling to see it."
              : `${missingCount} liked artworks aren't loaded in this feed yet. Keep scrolling to see them.`}
          </p>
        )}
      </div>
    </aside>
  );
});
