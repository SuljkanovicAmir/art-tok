import { useState } from "react";
import { Link } from "react-router-dom";
import { useFacetsQuery } from "../hooks/useFacetsQuery";

const HERO_COUNT = 6;

export default function CategoriesPage() {
  const { data: sections, isLoading, error } = useFacetsQuery();
  const [filter, setFilter] = useState("");

  const filterLower = filter.toLowerCase();

  return (
    <div className="categories-page">
      <header className="categories-page__header glass-noise">
        <Link to="/" className="categories-page__back" aria-label="Back to feed">
          &larr;
        </Link>
        <h1 className="categories-page__heading">Browse</h1>
      </header>

      <div className="categories-page__filter">
        <input
          className="categories-page__filter-input"
          type="text"
          placeholder="Filter categories..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {isLoading && (
        <div className="categories-page__status">Loading categories...</div>
      )}

      {error && (
        <div className="categories-page__status">Failed to load categories.</div>
      )}

      {sections?.map((section) => {
        const filtered = section.items.filter(
          (item) => item.name && item.count > 0 && item.name.toLowerCase().includes(filterLower),
        );
        if (filtered.length === 0) return null;

        const heroItems = filter ? [] : filtered.slice(0, HERO_COUNT);
        const chipItems = filter ? filtered : filtered.slice(HERO_COUNT);

        return (
          <section key={section.facet} className="categories-page__section">
            <h2 className="categories-page__section-title">{section.label}</h2>

            {heroItems.length > 0 && (
              <div className="categories-page__heroes">
                {heroItems.map((item) => (
                  <Link
                    key={item.name}
                    to={`/categories/${section.facet}/${encodeURIComponent(item.name)}`}
                    className="categories-page__hero-card glass-noise"
                  >
                    <span className="categories-page__hero-name">{item.name}</span>
                    <span className="categories-page__hero-count">{item.count.toLocaleString()}</span>
                  </Link>
                ))}
              </div>
            )}

            {chipItems.length > 0 && (
              <div className="categories-page__chips">
                {chipItems.map((item) => {
                  const sizeClass =
                    item.count > 5000 ? "categories-page__chip--lg" :
                    item.count < 1000 ? "categories-page__chip--sm" : "";
                  return (
                    <Link
                      key={item.name}
                      to={`/categories/${section.facet}/${encodeURIComponent(item.name)}`}
                      className={`categories-page__chip ${sizeClass}`.trim()}
                    >
                      {item.name}
                      <span className="categories-page__chip-count">
                        {item.count.toLocaleString()}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
