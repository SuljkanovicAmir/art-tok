import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import artImagesStore from "../stores/ArtImagesStore";
import { ArtCard } from "../components/ArtCard";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { LikedArtPanel } from "../components/LikedArtPanel";

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 0 0-7.45 5H2l3.89 3.89h0.07L10 9H6.26A6 6 0 0 1 12 6a6 6 0 0 1 4.24 10.24l1.42 1.42A8 8 0 0 0 17.65 6.35Z"
      fill="currentColor"
    />
    <path d="M12 20a8 8 0 0 0 7.45-5H22l-3.89-3.89h-0.07L14 15h3.74A6 6 0 0 1 12 18a6 6 0 0 1-4.24-10.24L6.34 6.34A8 8 0 0 0 12 20Z" fill="currentColor" />
  </svg>
);

const CollectionIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3 9.24 3 10.91 3.81 12 5.09 13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54Z"
      fill="currentColor"
    />
  </svg>
);

const FeedPage = observer(function FeedPage() {
  const { artPieces, isLoading, isInitialLoad, hasMore, error } = artImagesStore;
  const [isLikedPanelOpen, setIsLikedPanelOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const closeLikedPanel = useCallback(() => setIsLikedPanelOpen(false), []);
  const toggleLikedPanel = useCallback(
    () => setIsLikedPanelOpen((previous) => !previous),
    [],
  );

  const togglePanelFromSwipe = useCallback(
    (direction: "left" | "right") => {
      if (direction === "left" && !isLikedPanelOpen) {
        setIsLikedPanelOpen(true);
      } else if (direction === "right" && isLikedPanelOpen) {
        setIsLikedPanelOpen(false);
      }
    },
    [isLikedPanelOpen],
  );

  useEffect(() => {
    if (!artImagesStore.artPieces.length) {
      artImagesStore.fetchNextPage();
    }
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    let touchStartX: number | null = null;
    let touchStartY: number | null = null;

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (touchStartX === null || touchStartY === null) {
        return;
      }

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = Math.abs(touch.clientY - touchStartY);

      if (Math.abs(deltaX) > 70 && deltaY < 60) {
        togglePanelFromSwipe(deltaX < 0 ? "left" : "right");
      }

      touchStartX = null;
      touchStartY = null;
    };

    scroller.addEventListener("touchstart", handleTouchStart);
    scroller.addEventListener("touchend", handleTouchEnd);

    return () => {
      scroller.removeEventListener("touchstart", handleTouchStart);
      scroller.removeEventListener("touchend", handleTouchEnd);
    };
  }, [togglePanelFromSwipe]);

  const loadMoreRef = useInfiniteScroll({
    isLoading,
    hasMore,
    onIntersect: artImagesStore.fetchNextPage,
  });

  const showEmptyState = !isLoading && !isInitialLoad && artPieces.length === 0;

  return (
    <div className={`art-feed ${isLikedPanelOpen ? "has-liked-panel" : ""}`.trim()}>
      <header className="art-feed__header">
        <div className="art-feed__brand">ArtTok</div>
        <div className="art-feed__header-actions">
          <button
            type="button"
            className="art-feed__icon-button"
            aria-label="Refresh feed"
            onClick={() => {
              artImagesStore.resetFeed();
              artImagesStore.fetchNextPage();
            }}
          >
            <RefreshIcon />
          </button>
          <button
            type="button"
            className={`art-feed__icon-button ${isLikedPanelOpen ? "is-active" : ""}`.trim()}
            aria-pressed={isLikedPanelOpen}
            aria-label="Open liked art collection"
            onClick={toggleLikedPanel}
          >
            <CollectionIcon />
          </button>
        </div>
      </header>

      <main className="art-feed__scroller" ref={scrollerRef}>
        {artPieces.map((piece) => (
          <ArtCard key={piece.id} art={piece} />
        ))}

        {(isLoading && isInitialLoad) && (
          <div className="art-feed__status">Loading artworks...</div>
        )}

        {showEmptyState && (
          <div className="art-feed__status">No artworks available right now.</div>
        )}

        {error && !isLoading && (
          <div className="art-feed__error">
            <p>{error}</p>
            <button type="button" onClick={artImagesStore.fetchNextPage}>
              Try again
            </button>
          </div>
        )}

        <div className="art-feed__sentinel" ref={loadMoreRef} />

        {isLoading && !isInitialLoad && (
          <div className="art-feed__status art-feed__status--floating">Loading more art...</div>
        )}

        {!hasMore && !isLoading && artPieces.length > 0 && (
          <div className="art-feed__status">You\'re all caught up for now!</div>
        )}
      </main>

      {isLikedPanelOpen && (
        <button
          type="button"
          className="liked-panel__backdrop"
          aria-label="Close liked art overlay"
          onClick={closeLikedPanel}
        />
      )}
      <LikedArtPanel isOpen={isLikedPanelOpen} onClose={closeLikedPanel} />
    </div>
  );
});

export default FeedPage;
