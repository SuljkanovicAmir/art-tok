import { type FormEvent, useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { useSearchQuery, flattenSearchPages } from "../hooks/useSearchQuery";
import type { ArtSearchParams } from "../types/art";

const FACET_LABELS: Record<string, string> = {
  culture: "Culture",
  classification: "Classification",
  century: "Century",
  medium: "Medium",
};

const GLOW_CLASSES = ["glow-gold", "glow-blue", "glow-green", "glow-red"];

export default function SearchPage() {
  const navigate = useNavigate();
  const { facet, value } = useParams<{ facet?: string; value?: string }>();
  const decodedValue = value ? decodeURIComponent(value) : undefined;

  const categoryFilter = useMemo<ArtSearchParams | null>(() => {
    if (!facet || !decodedValue) return null;
    const filter: ArtSearchParams = {};
    if (facet === "culture") filter.culture = decodedValue;
    else if (facet === "classification") filter.classification = decodedValue;
    else if (facet === "century") filter.century = decodedValue;
    else if (facet === "medium") filter.medium = decodedValue;
    else return null;
    return filter;
  }, [facet, decodedValue]);

  const [input, setInput] = useState("");
  const [keywordParams, setKeywordParams] = useState<ArtSearchParams | null>(null);

  const searchParams = useMemo<ArtSearchParams | null>(() => {
    if (categoryFilter && keywordParams) {
      return { ...categoryFilter, ...keywordParams };
    }
    if (categoryFilter) return categoryFilter;
    return keywordParams;
  }, [categoryFilter, keywordParams]);

  useEffect(() => {
    setInput("");
    setKeywordParams(null);
  }, [facet, decodedValue]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useSearchQuery(searchParams);

  const results = flattenSearchPages(data);
  const totalResults = data?.pages[0]?.totalResults ?? 0;
  const hasSearched = searchParams !== null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed && !categoryFilter) return;
    setKeywordParams(trimmed ? { keyword: trimmed } : null);
  };

  const handleClear = () => {
    setInput("");
    if (!categoryFilter) {
      setKeywordParams(null);
    }
  };

  const sentinelRef = useInfiniteScroll({
    isLoading: isLoading || isFetchingNextPage,
    hasMore: hasNextPage,
    onIntersect: () => fetchNextPage(),
  });

  const headingText = categoryFilter
    ? `${decodedValue}`
    : hasSearched && keywordParams?.keyword
      ? "Curated Results"
      : "Discover";

  const displayQuery = categoryFilter
    ? decodedValue
    : keywordParams?.keyword || "";

  return (
    <div className="search-page">
      {/* Fixed transparent header */}
      <header className="search-page__topbar">
        <div className="search-page__topbar-left">
          <button
            className="search-page__topbar-icon"
            onClick={() => navigate(categoryFilter ? "/categories" : "/")}
            aria-label="Go back"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="search-page__brand">ARTTOK</span>
        </div>
        <button
          className="search-page__topbar-icon"
          onClick={() => {
            if (searchParams) {
              setKeywordParams(keywordParams ? { ...keywordParams } : null);
            }
          }}
          aria-label="Refresh results"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </header>

      {/* Floating glass search pill */}
      <div className="search-page__search-wrap">
        <form className="search-page__pill" onSubmit={handleSubmit}>
          <svg className="search-page__pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-page__pill-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              categoryFilter
                ? `Search within ${decodedValue}...`
                : "Search artworks, artists, cultures..."
            }
          />
          {(input || displayQuery) && (
            <button
              type="button"
              className="search-page__pill-clear"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </form>
      </div>

      {/* Category filter tag */}
      {categoryFilter && (
        <div className="search-page__filter-tag">
          <span className="search-page__filter-tag-label">
            {FACET_LABELS[facet!] || facet}:
          </span>{" "}
          {decodedValue}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="search-page__empty">
          <p>{error instanceof Error ? error.message : "Search failed. Please try again."}</p>
          <button
            className="search-page__retry-btn"
            onClick={() => searchParams && setKeywordParams(keywordParams ? { ...keywordParams } : null)}
          >
            Retry
          </button>
        </div>
      )}

      {/* Suggestions (no search yet) */}
      {!error && !hasSearched && (
        <div className="search-page__discover">
          <h2 className="search-page__section-title">Discover</h2>
          <div className="search-page__accent-line" />
          <p className="search-page__discover-sub">Explore masterpieces across centuries</p>
          <div className="search-page__suggestions">
            {["Impressionism", "Japanese", "Rembrandt", "Sculpture", "Renaissance"].map((term) => (
              <button
                key={term}
                type="button"
                className="search-page__suggestion"
                onClick={() => { setInput(term); setKeywordParams({ keyword: term }); }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {!error && hasSearched && results.length === 0 && !isLoading && (
        <div className="search-page__empty">
          No artworks found. Try different keywords.
        </div>
      )}

      {/* Section heading & results count */}
      {hasSearched && results.length > 0 && (
        <div className="search-page__section-header">
          <h2 className="search-page__section-title">{headingText}</h2>
          <div className="search-page__accent-line" />
          <p className="search-page__meta">
            {totalResults.toLocaleString()} artworks found
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="search-page__loading">
          <div className="search-page__loading-dots">
            <span /><span /><span />
          </div>
          <p>Searching...</p>
        </div>
      )}

      {/* Staggered bento results grid */}
      {results.length > 0 && (
        <div className="search-page__grid">
          {results.map((art, index) => (
            <div
              className={`search-card ${GLOW_CLASSES[index % GLOW_CLASSES.length]}`}
              key={`${art.source}:${art.id}`}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <Link to={`/artwork/${art.source}/${art.id}`} className="search-card__link">
                <div className="search-card__image-wrap">
                  <img
                    className="search-card__image"
                    src={art.imageUrl}
                    alt={art.title}
                    loading="lazy"
                  />
                </div>
                <div className="search-card__info">
                  <h3 className="search-card__title">{art.title}</h3>
                  <p className="search-card__artist">
                    {[art.artist, art.dated].filter(Boolean).join(" \u00B7 ")}
                  </p>
                  {art.culture && (
                    <p className="search-card__culture">{art.culture}</p>
                  )}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Loading more */}
      {isFetchingNextPage && (
        <div className="search-page__loading search-page__loading--more">
          <div className="search-page__loading-dots">
            <span /><span /><span />
          </div>
        </div>
      )}

      {hasNextPage && !isLoading && (
        <div ref={sentinelRef} style={{ height: 1 }} />
      )}
    </div>
  );
}
