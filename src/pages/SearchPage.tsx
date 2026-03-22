import { type FormEvent, useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { useSearchQuery, flattenSearchPages } from "../hooks/useSearchQuery";
import type { ArtSearchParams } from "../types/art";

const FACET_LABELS: Record<string, string> = {
  culture: "Culture",
  classification: "Classification",
  century: "Century",
  medium: "Medium",
};

export default function SearchPage() {
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

  // Reset keyword search when category changes
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

  const sentinelRef = useInfiniteScroll({
    isLoading: isLoading || isFetchingNextPage,
    hasMore: hasNextPage,
    onIntersect: () => fetchNextPage(),
  });

  const headingText = categoryFilter
    ? `${FACET_LABELS[facet!] || facet}: ${decodedValue}`
    : "Search";

  return (
    <div className="search-page">
      <header className="search-page__header">
        <Link to={categoryFilter ? "/categories" : "/"} className="search-page__back">
          &larr; Back
        </Link>
        <h1 className="search-page__heading">{headingText}</h1>
      </header>

      {categoryFilter && (
        <div className="search-page__filter-tag">
          <span className="search-page__filter-tag-label">
            {FACET_LABELS[facet!] || facet}:
          </span>{" "}
          {decodedValue}
        </div>
      )}

      <form className="search-page__form" onSubmit={handleSubmit}>
        <input
          className="search-page__input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            categoryFilter
              ? `Search within ${decodedValue}...`
              : "Search artworks, artists, cultures..."
          }
        />
        <button className="search-page__submit" type="submit" aria-label="Search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </form>

      {error && (
        <div className="search-page__empty">
          <p>{error instanceof Error ? error.message : "Search failed. Please try again."}</p>
          <button
            className="search-page__submit"
            onClick={() => searchParams && setKeywordParams(keywordParams ? { ...keywordParams } : null)}
            style={{ display: "inline-flex", marginTop: "0.5rem" }}
          >
            Retry
          </button>
        </div>
      )}

      {!error && !hasSearched && (
        <div className="search-page__empty">
          <p className="search-page__empty-title">Discover masterpieces</p>
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

      {!error && hasSearched && results.length === 0 && !isLoading && (
        <div className="search-page__empty">
          No artworks found. Try different keywords.
        </div>
      )}

      {hasSearched && results.length > 0 && (
        <div className="search-page__meta">
          {totalResults.toLocaleString()} artworks found
        </div>
      )}

      {results.length > 0 && (
        <div className="search-page__results">
          {results.map((art, index) => (
            <div className="search-result-card" key={art.id} style={{ animationDelay: `${index * 50}ms` }}>
              <img
                className="search-result-card__image"
                src={art.imageUrl}
                alt={art.title}
                loading="lazy"
              />
              <div className="search-result-card__info">
                <p className="search-result-card__title">
                  <Link to={`/artwork/${art.id}`}>{art.title}</Link>
                </p>
                <p className="search-result-card__artist">{art.artist}</p>
                {(art.culture || art.dated) && (
                  <p className="search-result-card__subtitle">
                    {[art.culture, art.dated].filter(Boolean).join(" \u00B7 ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="search-page__empty">Searching...</div>
      )}

      {hasNextPage && !isLoading && (
        <div ref={sentinelRef} style={{ height: 1 }} />
      )}
    </div>
  );
}
