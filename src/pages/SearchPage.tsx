import { observer } from "mobx-react";
import { type FormEvent, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import searchStore from "../stores/SearchStore";

const SearchPage = observer(function SearchPage() {
  const [input, setInput] = useState(searchStore.query);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed) return;
      searchStore.search({ keyword: trimmed });
    },
    [input]
  );

  const sentinelRef = useInfiniteScroll({
    isLoading: searchStore.isLoading,
    hasMore: searchStore.hasMore,
    onIntersect: searchStore.loadMore,
  });

  const hasSearched = searchStore.totalResults > 0 || searchStore.error !== null || searchStore.query !== "";

  return (
    <div className="search-page">
      <header className="search-page__header">
        <Link to="/" className="search-page__back">
          &larr; Back
        </Link>
        <h1 className="search-page__heading">Search</h1>
      </header>

      <form className="search-page__form" onSubmit={handleSubmit}>
        <input
          className="search-page__input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search artworks, artists, cultures..."
        />
        <button className="search-page__submit" type="submit" aria-label="Search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </form>

      {searchStore.error && (
        <div className="search-page__empty">
          <p>{searchStore.error}</p>
          <button
            className="search-page__submit"
            onClick={() => searchStore.search({ keyword: searchStore.query })}
            style={{ display: "inline-flex", marginTop: "0.5rem" }}
          >
            Retry
          </button>
        </div>
      )}

      {!searchStore.error && !hasSearched && (
        <div className="search-page__empty">
          Discover artworks by keyword, artist, or culture
        </div>
      )}

      {!searchStore.error && hasSearched && searchStore.results.length === 0 && !searchStore.isLoading && (
        <div className="search-page__empty">
          No artworks found. Try different keywords.
        </div>
      )}

      {hasSearched && searchStore.results.length > 0 && (
        <div className="search-page__meta">
          {searchStore.totalResults.toLocaleString()} artworks found
        </div>
      )}

      {searchStore.results.length > 0 && (
        <div className="search-page__results">
          {searchStore.results.map((art) => (
            <div className="search-result-card" key={art.id}>
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

      {searchStore.isLoading && (
        <div className="search-page__empty">Searching...</div>
      )}

      {searchStore.hasMore && !searchStore.isLoading && (
        <div ref={sentinelRef} style={{ height: 1 }} />
      )}
    </div>
  );
});

export default SearchPage;
