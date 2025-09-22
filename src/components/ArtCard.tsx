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

export const ArtCard = forwardRef<HTMLDivElement, ArtCardProps>(({ art }, ref) => {
  const { isLiked, toggleLike } = useLikedArt(art.id);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
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
      setShareFeedback("Share canceled");
    }

    feedbackTimeoutRef.current = window.setTimeout(() => {
      setShareFeedback(null);
    }, 2000);
  }, [art.artist, art.title, art.url]);

  const metaDetails = useMemo(() => {
    const meta: string[] = [];
    if (art.culture) {
      meta.push(art.culture);
    }
    if (art.dated) {
      meta.push(art.dated);
    }
    if (art.medium) {
      meta.push(art.medium);
    }
    if (art.classification) {
      meta.push(art.classification);
    }
    return meta;
  }, [art.classification, art.culture, art.dated, art.medium]);

  return (
    <article className="art-card" ref={ref}>
      <div className="art-card__media">
        <img
          className="art-card__image"
          src={art.imageUrl}
          alt={`${art.title} by ${art.artist}`}
          loading="lazy"
        />
      </div>

      <div className="art-card__info">
        <h2 className="art-card__title">{art.title}</h2>
        <p className="art-card__artist">{art.artist}</p>

        {displayDescription && (
          <p className={`art-card__description ${isDescriptionExpanded ? "is-expanded" : ""}`}>
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

        {metaDetails.length > 0 && (
          <ul className="art-card__meta">
            {metaDetails.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="art-card__actions" aria-label="Artwork actions">
        <button
          type="button"
          className={`art-card__action-button ${isLiked ? "is-active" : ""}`}
          aria-pressed={isLiked}
          aria-label={isLiked ? "Unlike artwork" : "Like artwork"}
          onClick={toggleLike}
        >
          <HeartIcon />
        </button>

        <button
          type="button"
          className="art-card__action-button"
          aria-label="Share artwork"
          onClick={handleShare}
        >
          <ShareIcon />
        </button>

        {shareFeedback && <span className="art-card__share-feedback">{shareFeedback}</span>}
      </div>
    </article>
  );
});

ArtCard.displayName = "ArtCard";
