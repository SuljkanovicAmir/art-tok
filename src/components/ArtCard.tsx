import type { CSSProperties } from "react";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ArtPiece } from "../types/art";
import { useLikedArt } from "../hooks/useLikedArt";

interface ArtCardProps {
  art: ArtPiece;
}

const MAX_DESCRIPTION_LENGTH = 160;

const HeartIcon = () => (
  <svg
    className="art-card__action-svg"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.54 0 3.04 0.99 3.57 2.36h0.21C10.81 4.99 12.31 4 13.85 4 16.34 4 18.35 6 18.35 8.5c0 3.78-3.4 6.86-8.55 11.54z" />
  </svg>
);

const ShareIcon = () => (
  <svg
    className="art-card__action-svg"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12 3l5.05 5.05-1.41 1.41L13 6.83V17h-2V6.83L8.36 9.46 6.95 8.05z" />
    <path d="M5 19h14v-2H5z" />
  </svg>
);

const ExpandIcon = () => (
  <svg
    className="art-card__action-svg"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M20 3h-6v2h2.59L13 8.59 14.41 10 18 6.41V9h2z" />
    <path d="M10 13.41 8.59 12 5 15.59V13H3v6h6v-2H6.41z" />
  </svg>
);

interface Fact {
  label: string;
  value: string;
}

export const ArtCard = forwardRef<HTMLDivElement, ArtCardProps>(({ art }, ref) => {
  const { isLiked, toggleLike } = useLikedArt(art.id);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [showTapLike, setShowTapLike] = useState(false);
  const [areDetailsExpanded, setAreDetailsExpanded] = useState(false);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const likeBurstTimeoutRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }

      if (likeBurstTimeoutRef.current) {
        window.clearTimeout(likeBurstTimeoutRef.current);
      }
    };
  }, []);

  const shouldTruncateDescription = Boolean(
    art.description && art.description.length > MAX_DESCRIPTION_LENGTH,
  );

  const displayDescription = useMemo(() => {
    if (!art.description) {
      return null;
    }

    if (isDescriptionExpanded || !shouldTruncateDescription) {
      return art.description;
    }

    const truncated = art.description.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd();
    return `${truncated}...`;
  }, [art.description, isDescriptionExpanded, shouldTruncateDescription]);

  const handleToggleDescription = useCallback(() => {
    setIsDescriptionExpanded((previous) => !previous);
  }, []);

  const triggerLikeBurst = useCallback(() => {
    setShowTapLike(true);

    if (likeBurstTimeoutRef.current) {
      window.clearTimeout(likeBurstTimeoutRef.current);
    }

    likeBurstTimeoutRef.current = window.setTimeout(() => {
      setShowTapLike(false);
    }, 700);
  }, []);

  const handleLikeButtonClick = useCallback(() => {
    if (!isLiked) {
      toggleLike();
      triggerLikeBurst();
      return;
    }

    toggleLike();
    setShowTapLike(false);
  }, [isLiked, toggleLike, triggerLikeBurst]);

  const handleShare = useCallback(async () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }

    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }

    const urlToShare = art.url || window.location.href;
    const shareTitle = art.title;
    const shareText = `Check out "${art.title}" by ${art.artist}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url: urlToShare });
        setShareFeedback("Shared");
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(urlToShare);
        setShareFeedback("Link copied");
      } else {
        setShareFeedback("Copy not supported");
      }
    } catch (error) {
      console.error("Share action failed", error);
      setShareFeedback("Share canceled");
    }

    feedbackTimeoutRef.current = window.setTimeout(() => {
      setShareFeedback(null);
    }, 2000);
  }, [art.artist, art.title, art.url]);

  const detailFacts = useMemo(() => {
    const facts: Fact[] = [];
    const addFact = (label: string, value: string | undefined) => {
      if (!value) {
        return;
      }
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }
      facts.push({ label, value: trimmed });
    };

    addFact("Created", art.dated);
    addFact("Culture", art.culture);
    addFact("Classification", art.classification);
    addFact("Medium", art.medium);
    addFact("Dimensions", art.dimensions);

    return facts;
  }, [art.classification, art.culture, art.dated, art.dimensions, art.medium]);

  const quickFacts = useMemo(() => {
    return detailFacts.filter((fact) => fact.value.length <= 42).slice(0, 3);
  }, [detailFacts]);

  const accentStyle = useMemo(() => {
    const hue = Math.abs(art.id) % 360;
    const accent = `hsl(${hue}, 74%, 58%)`;
    const accentSoft = `hsla(${hue}, 86%, 62%, 0.32)`;
    const accentSurface = `hsla(${hue}, 92%, 68%, 0.16)`;

    return {
      "--art-card-accent": accent,
      "--art-card-accent-soft": accentSoft,
      "--art-card-accent-surface": accentSurface,
    } as CSSProperties;
  }, [art.id]);

  const detailsId = useMemo(() => `art-details-${art.id}`, [art.id]);

  const trendingLabel = useMemo(() => {
    const highlight = art.culture || art.classification || art.medium || art.dated;
    if (!highlight) {
      return null;
    }

    return highlight.split(",")[0].trim();
  }, [art.classification, art.culture, art.dated, art.medium]);

  const trendingTag = useMemo(() => {
    if (!trendingLabel) {
      return null;
    }

    const condensed = trendingLabel.replace(/[^a-z0-9]+/gi, "");
    return condensed ? `#${condensed}` : `#${trendingLabel.replace(/\s+/g, "")}`;
  }, [trendingLabel]);

  const handleDoubleTapLike = useCallback(() => {
    if (!isLiked) {
      toggleLike();
    }
    triggerLikeBurst();
  }, [isLiked, toggleLike, triggerLikeBurst]);

  const handleMediaTouchEnd = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      handleDoubleTapLike();
    }
    lastTapRef.current = now;
  }, [handleDoubleTapLike]);

  const toggleDetails = useCallback(() => {
    setAreDetailsExpanded((previous) => !previous);
  }, []);

  return (
    <article className="art-card" ref={ref} style={accentStyle}>
      <div
        className="art-card__media"
        onDoubleClick={handleDoubleTapLike}
        onTouchEnd={handleMediaTouchEnd}
      >
        <img
          className="art-card__image"
          src={art.imageUrl}
          alt={`${art.title} by ${art.artist}`}
          loading="lazy"
        />
        {trendingTag && <span className="art-card__badge">{trendingTag}</span>}
        {showTapLike && (
          <span className="art-card__like-burst" aria-hidden="true">
            <HeartIcon />
          </span>
        )}
      </div>

      <div className="art-card__info">
        <div className="art-card__title-group">
          <h2 className="art-card__title">{art.title}</h2>
          <p className="art-card__artist">{art.artist}</p>
        </div>

        {displayDescription && (
          <p className={`art-card__description ${isDescriptionExpanded ? "is-expanded" : ""}`.trim()}>
            {displayDescription}
            {shouldTruncateDescription && (
              <button
                type="button"
                className="art-card__description-toggle"
                onClick={handleToggleDescription}
              >
                {isDescriptionExpanded ? "Show less" : "Read more"}
              </button>
            )}
          </p>
        )}

        {quickFacts.length > 0 && (
          <ul className="art-card__quick-facts">
            {quickFacts.map((fact) => (
              <li key={`${fact.label}-${fact.value}`}>
                <span className="art-card__quick-facts-label">{fact.label}</span>
                <span className="art-card__quick-facts-value">{fact.value}</span>
              </li>
            ))}
          </ul>
        )}

        {detailFacts.length > 0 && (
          <section className={`art-card__details ${areDetailsExpanded ? "is-open" : ""}`}>
            <button
              type="button"
              className="art-card__details-toggle"
              aria-expanded={areDetailsExpanded}
              aria-controls={detailsId}
              onClick={toggleDetails}
            >
              {areDetailsExpanded ? "Hide artwork details" : "Artwork details"}
            </button>
            {areDetailsExpanded && (
              <dl className="art-card__details-grid" id={detailsId}>
                {detailFacts.map((fact) => (
                  <div key={`${fact.label}-${fact.value}`} className="art-card__details-item">
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        )}

        {art.url && (
          <a
            className="art-card__museum-link"
            href={art.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View at Harvard Art Museums
          </a>
        )}
      </div>

      <div className="art-card__actions" aria-label="Artwork actions">
        <div className="art-card__action">
          <button
            type="button"
            className={`art-card__action-button ${isLiked ? "is-active" : ""}`.trim()}
            aria-pressed={isLiked}
            aria-label={isLiked ? "Unlike artwork" : "Like artwork"}
            onClick={handleLikeButtonClick}
          >
            <HeartIcon />
          </button>
          <span className="art-card__action-label">{isLiked ? "Saved" : "Save"}</span>
        </div>

        <div className="art-card__action">
          <button
            type="button"
            className="art-card__action-button"
            aria-label="Share artwork"
            onClick={handleShare}
          >
            <ShareIcon />
          </button>
          <span className="art-card__action-label">Share</span>
          {shareFeedback && <span className="art-card__share-feedback">{shareFeedback}</span>}
        </div>

        <div className="art-card__action">
          <a
            className="art-card__action-button art-card__action-button--link"
            href={art.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open artwork image in a new tab"
          >
            <ExpandIcon />
          </a>
          <span className="art-card__action-label">Full size</span>
        </div>
      </div>
    </article>
  );
});

ArtCard.displayName = "ArtCard";
