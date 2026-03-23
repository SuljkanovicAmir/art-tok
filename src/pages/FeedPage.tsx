import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArtCard } from "../components/ArtCard";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { useFeedQuery, flattenFeedPages } from "../hooks/useFeedQuery";

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 0 0-7.45 5H2l3.89 3.89h0.07L10 9H6.26A6 6 0 0 1 12 6a6 6 0 0 1 4.24 10.24l1.42 1.42A8 8 0 0 0 17.65 6.35Z"
      fill="currentColor"
    />
    <path d="M12 20a8 8 0 0 0 7.45-5H22l-3.89-3.89h-0.07L14 15h3.74A6 6 0 0 1 12 18a6 6 0 0 1-4.24-10.24L6.34 6.34A8 8 0 0 0 12 20Z" fill="currentColor" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z"
      fill="currentColor"
    />
  </svg>
);

function FeedSkeleton() {
  return (
    <div className="skeleton">
      <div className="skeleton__image" />
      <div className="skeleton__info">
        <div className="skeleton__line skeleton__line--title" />
        <div className="skeleton__line skeleton__line--subtitle" />
        <div className="skeleton__line" />
        <div className="skeleton__pills">
          <div className="skeleton__pill" />
          <div className="skeleton__pill" />
          <div className="skeleton__pill" />
        </div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useFeedQuery();

  const artPieces = flattenFeedPages(data);
  const isInitialLoad = isLoading && !data;
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const loadMoreRef = useInfiniteScroll({
    isLoading: isLoading || isFetchingNextPage,
    hasMore: hasNextPage,
    onIntersect: () => fetchNextPage(),
  });

  const showEmptyState = !isLoading && !isInitialLoad && artPieces.length === 0 && !error;

  return (
    <div className="art-feed">
      <header className="art-feed__header">
        <Link to="/search" className="art-feed__header-icon" aria-label="Search artworks">
          <SearchIcon />
        </Link>
        <div className="art-feed__brand">ARTTOK</div>
        <button
          type="button"
          className="art-feed__header-icon"
          aria-label="Refresh feed"
          onClick={() => refetch()}
        >
          <RefreshIcon />
        </button>
      </header>

      <main className="art-feed__scroller" ref={scrollerRef}>
        {artPieces.map((piece) => (
          <ArtCard key={`${piece.source}:${piece.id}`} art={piece} />
        ))}

        {isInitialLoad && (
          <FeedSkeleton />
        )}

        {showEmptyState && (
          <div className="art-feed__status">No artworks available right now.</div>
        )}

        {error && !isLoading && (
          <div className="art-feed__error">
            <p>{error instanceof Error ? error.message : "Unable to load art right now."}</p>
            <button type="button" onClick={() => fetchNextPage()}>
              Try again
            </button>
          </div>
        )}

        <div className="art-feed__sentinel" ref={loadMoreRef} />

        {isFetchingNextPage && (
          <div className="art-feed__status art-feed__status--floating">Loading more art...</div>
        )}

        {!hasNextPage && !isLoading && artPieces.length > 0 && (
          <div className="art-feed__status">You're all caught up for now!</div>
        )}
      </main>
    </div>
  );
}
