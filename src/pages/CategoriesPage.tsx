import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { artRegistry } from "../services/registry";
import type { FacetItem } from "../services/types";

interface FacetSection {
  label: string;
  facet: "culture" | "classification" | "century";
  items: FacetItem[];
}

export default function CategoriesPage() {
  const [sections, setSections] = useState<FacetSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFacets() {
      setIsLoading(true);
      setError(null);

      try {
        const [cultures, classifications, centuries] = await Promise.all([
          artRegistry.fetchFacet("culture", 40),
          artRegistry.fetchFacet("classification", 40),
          artRegistry.fetchFacet("century", 30),
        ]);

        if (cancelled) return;

        setSections([
          { label: "By Culture", facet: "culture", items: cultures },
          { label: "By Classification", facet: "classification", items: classifications },
          { label: "By Century", facet: "century", items: centuries },
        ]);
      } catch {
        if (!cancelled) {
          setError("Failed to load categories. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadFacets();
    return () => {
      cancelled = true;
    };
  }, []);

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
        <div className="categories-page__status">{error}</div>
      )}

      {!isLoading && !error && sections.map((section) => (
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
