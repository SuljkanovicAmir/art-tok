import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, RefreshCw } from "lucide-react";
import { ArtCard } from "../components/ArtCard";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { useFeedQuery, flattenFeedPages } from "../hooks/useFeedQuery";
import { useArtOfTheDay, dismissArtOfTheDay } from "../hooks/useArtOfTheDay";
import { sourceName } from "../utils/artKey";

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

  const { data: aotd } = useArtOfTheDay();
  const [aotdExpanded, setAotdExpanded] = useState(false);
  const [aotdDismissed, setAotdDismissed] = useState(false);

  const artPieces = flattenFeedPages(data);
  const isInitialLoad = isLoading && !data;
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const loadMoreRef = useInfiniteScroll({
    isLoading: isLoading || isFetchingNextPage,
    hasMore: hasNextPage,
    onIntersect: () => fetchNextPage(),
  });

  const showEmptyState = !isLoading && !isInitialLoad && artPieces.length === 0 && !error;

  const handleDismissAotd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dismissArtOfTheDay();
    setAotdDismissed(true);
    setAotdExpanded(false);
  };

  return (
    <div className="art-feed">
      <header className="art-feed__header">
        <Link to="/search" className="art-feed__header-icon" aria-label="Search artworks">
          <Search size={22} strokeWidth={2} />
        </Link>
        <div className="art-feed__brand">ARTTOK</div>
        <button
          type="button"
          className="art-feed__header-icon"
          aria-label="Refresh feed"
          onClick={() => refetch()}
        >
          <RefreshCw size={22} strokeWidth={2} />
        </button>
      </header>

      {aotd && !aotdDismissed && (
        <>
          <button
            type="button"
            className="aotd-fab"
            onClick={() => setAotdExpanded(!aotdExpanded)}
            aria-label="Art of the Day"
          >
            <img className="aotd-fab__thumb" src={aotd.imageUrl} alt="" />
          </button>

          {aotdExpanded && (
            <Link
              to={`/artwork/${aotd.source}/${aotd.id}`}
              className="aotd-banner"
              aria-label={`Art of the Day: ${aotd.title}`}
            >
              <img className="aotd-banner__thumb" src={aotd.imageUrl} alt="" />
              <div className="aotd-banner__text">
                <span className="aotd-banner__label">Art of the Day</span>
                <span className="aotd-banner__title">{aotd.title}</span>
                <span className="aotd-banner__artist">{aotd.artist} · {sourceName(aotd.source)}</span>
              </div>
              <button
                type="button"
                className="aotd-banner__close"
                onClick={handleDismissAotd}
                aria-label="Dismiss"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </Link>
          )}
        </>
      )}

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
