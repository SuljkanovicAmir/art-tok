import { Link } from "react-router-dom";
import { useFacetsQuery } from "../hooks/useFacetsQuery";

export default function CategoriesPage() {
  const { data: sections, isLoading, error } = useFacetsQuery();

  return (
    <div className="categories-page">
      <header className="categories-page__header">
        <Link to="/" className="categories-page__back">
          &larr; Back
        </Link>
        <h1 className="categories-page__heading">Browse</h1>
      </header>

      {isLoading && (
        <div className="categories-page__status">Loading categories...</div>
      )}

      {error && (
        <div className="categories-page__status">Failed to load categories. Please try again.</div>
      )}

      {sections?.map((section) => (
        <section key={section.facet} className="categories-page__section">
          <h2 className="categories-page__section-title">{section.label}</h2>
          <div className="categories-page__chips">
            {section.items
              .filter((item) => item.name && item.count > 0)
              .map((item) => (
                <Link
                  key={item.name}
                  to={`/categories/${section.facet}/${encodeURIComponent(item.name)}`}
                  className="categories-page__chip"
                >
                  {item.name}
                  <span className="categories-page__chip-count">
                    {item.count.toLocaleString()}
                  </span>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
