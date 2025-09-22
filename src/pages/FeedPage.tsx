import { useEffect } from "react";
import { observer } from "mobx-react";
import artImagesStore from "../stores/ArtImagesStore";
import { ArtCard } from "../components/ArtCard";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

const FeedPage = observer(function FeedPage() {
  const { artPieces, isLoading, isInitialLoad, hasMore, error } = artImagesStore;

  useEffect(() => {
    if (!artImagesStore.artPieces.length) {
      artImagesStore.fetchNextPage();
    }
  }, []);

  const loadMoreRef = useInfiniteScroll({
    isLoading,
    hasMore,
    onIntersect: artImagesStore.fetchNextPage,
  });

  const showEmptyState = !isLoading && !isInitialLoad && artPieces.length === 0;

  return (
    <div className="art-feed">
      <header className="art-feed__header">
        <div className="art-feed__brand">ArtTok</div>
        <button
          type="button"
          className="art-feed__refresh"
          onClick={() => {
            artImagesStore.resetFeed();
            artImagesStore.fetchNextPage();
          }}
        >
          Refresh
        </button>
      </header>

      <main className="art-feed__scroller">
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
    </div>
  );
});

export default FeedPage;
