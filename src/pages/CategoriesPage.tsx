import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFacetsQuery } from "../hooks/useFacetsQuery";

const HERO_COUNT = 10;
const GLOW_CLASSES = ["glow-gold", "glow-blue", "glow-green", "glow-red"];

const TAB_LABELS: Record<string, string> = {
  culture: "Culture",
  classification: "Type",
  century: "Era",
};

export default function CategoriesPage() {
  const navigate = useNavigate();
  const { data: sections, isLoading, error } = useFacetsQuery();
  const [activeTab, setActiveTab] = useState<string>("culture");

  const activeSection = sections?.find((s) => s.facet === activeTab);
  const heroItems = activeSection?.items.slice(0, HERO_COUNT) ?? [];

  return (
    <div className="categories-page">
      {/* Fixed transparent header */}
      <header className="categories-page__topbar">
        <div className="categories-page__topbar-left">
          <button
            className="categories-page__topbar-icon"
            onClick={() => navigate("/")}
            aria-label="Go back"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="categories-page__brand">ARTTOK</span>
        </div>
      </header>

      {/* Page title */}
      <div className="categories-page__title-wrap">
        <h1 className="categories-page__title">Browse</h1>
        <div className="categories-page__accent-line" />
        <p className="categories-page__subtitle">Explore by culture, medium, and era</p>
      </div>

      {/* Tab pills */}
      {sections && (
        <div className="categories-page__tabs">
          {sections.map((section) => (
            <button
              key={section.facet}
              className={`categories-page__tab ${activeTab === section.facet ? "categories-page__tab--active" : ""}`}
              onClick={() => setActiveTab(section.facet)}
            >
              {TAB_LABELS[section.facet] || section.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="categories-page__status">
          <div className="categories-page__loading-dots">
            <span /><span /><span />
          </div>
          <p>Loading categories...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="categories-page__status">Failed to load categories.</div>
      )}

      {/* Active section heroes */}
      {activeSection && (
        <section className="categories-page__section">
          <h2 className="categories-page__section-title">{activeSection.label}</h2>
          <div className="categories-page__section-line" />

          <div className="categories-page__heroes">
            {heroItems.map((item, index) => (
              <Link
                key={item.name}
                to={`/categories/${activeSection.facet}/${encodeURIComponent(item.name)}`}
                className={`categories-page__hero-card ${GLOW_CLASSES[index % GLOW_CLASSES.length]}`}
              >
                <span className="categories-page__hero-name">{item.name}</span>
                <span className="categories-page__hero-count">
                  {item.count.toLocaleString()} works
                </span>
              </Link>
            ))}
          </div>

          {/* View all link → opens search with facet pre-filtered */}
          {activeSection.items.length > HERO_COUNT && (
            <Link
              to={`/search`}
              className="categories-page__view-all"
              state={{ facet: activeSection.facet }}
            >
              View all {activeSection.items.length} {TAB_LABELS[activeSection.facet]?.toLowerCase() || activeSection.facet} categories
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
