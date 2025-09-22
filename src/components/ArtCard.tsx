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

const EyeIcon = () => (
  <svg
    className="art-card__action-svg"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12 4.5C6.75 4.5 2.23 8 1 12c1.23 4 5.75 7.5 11 7.5s9.77-3.5 11-7.5c-1.23-4-5.75-7.5-11-7.5zm0 12c-2.5 0-4.5-2.01-4.5-4.5S9.5 7.5 12 7.5s4.5 2.01 4.5 4.5-2 4.5-4.5 4.5zm0-7c-1.38 0-2.5 1.12-2.5 2.5S10.62 14.5 12 14.5s2.5-1.12 2.5-2.5S13.38 9.5 12 9.5z" />
  </svg>
);

const formatMetric = (value: number) => {
  if (value >= 1_000_000) {
    const rounded = value >= 10_000_000 ? Math.round(value / 1_000_000) : value / 1_000_000;
    return `${rounded.toFixed(rounded >= 10 ? 0 : 1)}M`;
  }

  if (value >= 1_000) {
    const rounded = value >= 10_000 ? Math.round(value / 1_000) : value / 1_000;
    return `${rounded.toFixed(rounded >= 10 ? 0 : 1)}K`;
  }

  return value.toString();
};

const createHandle = (value: string | undefined) => {
  if (!value) {
    return "@unknown";
  }

  const sanitized = value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
  if (!sanitized) {
    return "@unknown";
  }

  return `@${sanitized.slice(0, 18)}`;
};

export const ArtCard = forwardRef<HTMLDivElement, ArtCardProps>(({ art }, ref) => {
  const { isLiked, toggleLike } = useLikedArt(art.id);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showTapLike, setShowTapLike] = useState(false);
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

  const handleFollowToggle = useCallback(() => {
    setIsFollowing((previous) => !previous);
  }, []);

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

  const artistHandle = useMemo(() => createHandle(art.artist), [art.artist]);

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

  const { likeCount, shareCount, viewCount } = useMemo(() => {
    const base = Math.abs(art.id);
    return {
      likeCount: 1_200 + ((base * 73) % 12_000),
      shareCount: 40 + ((base * 19) % 800),
      viewCount: 4_000 + ((base * 101) % 60_000),
    };
  }, [art.id]);

  const soundLabel = useMemo(() => {
    const medium = art.medium || art.classification || art.culture;
    const dated = art.dated ? ` • ${art.dated}` : "";
    if (medium) {
      return `${medium}${dated}`;
    }

    return art.dated ? `Timeless • ${art.dated}` : "ArtTok mix";
  }, [art.classification, art.culture, art.dated, art.medium]);

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
        <div className="art-card__header">
          <div className="art-card__title-group">
            <h2 className="art-card__title">{art.title}</h2>
            <p className="art-card__artist">
              <span className="art-card__artist-handle">{artistHandle}</span>
              <span className="art-card__artist-separator" aria-hidden="true">
                •
              </span>
              <span className="art-card__artist-name">{art.artist}</span>
            </p>
          </div>
          <button
            type="button"
            className={`art-card__follow ${isFollowing ? "is-following" : ""}`.trim()}
            aria-pressed={isFollowing}
            onClick={handleFollowToggle}
          >
            {isFollowing ? "Following" : "Follow"}
          </button>
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

        <div className="art-card__sound" aria-label="Artwork medium and era">
          <div className="art-card__sound-disc">
            <img src={art.imageUrl} alt="" aria-hidden="true" loading="lazy" />
          </div>
          <p className="art-card__sound-text">{soundLabel}</p>
        </div>

        {metaDetails.length > 0 && (
          <ul className="art-card__meta">
            {metaDetails.map((detail) => (
              <li key={detail} title={detail}>
                #{detail.replace(/\s+/g, "").toLowerCase()}
              </li>
            ))}
          </ul>
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
          <span className="art-card__action-count">{formatMetric(likeCount)}</span>
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
          <span className="art-card__action-count">{formatMetric(shareCount)}</span>
          {shareFeedback && <span className="art-card__share-feedback">{shareFeedback}</span>}
        </div>

        <div className="art-card__action art-card__action--static" aria-hidden="true">
          <div className="art-card__action-button is-static">
            <EyeIcon />
          </div>
          <span className="art-card__action-count">{formatMetric(viewCount)}</span>
          <span className="art-card__action-label">Views</span>
        </div>
      </div>
    </article>
  );
});

ArtCard.displayName = "ArtCard";
