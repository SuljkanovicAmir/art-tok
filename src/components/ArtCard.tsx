import type { CSSProperties } from "react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ArtPiece } from "../types/art";
import { useLikedArt } from "../hooks/useLikedArt";
import { useTrackInteraction } from "../hooks/useTrackInteraction";

interface ArtCardProps {
  art: ArtPiece;
  ref?: React.Ref<HTMLDivElement>;
}


const HeartIcon = () => (
  <svg className="art-card__action-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.54 0 3.04 0.99 3.57 2.36h0.21C10.81 4.99 12.31 4 13.85 4 16.34 4 18.35 6 18.35 8.5c0 3.78-3.4 6.86-8.55 11.54z" />
  </svg>
);

const ShareIcon = () => (
  <svg className="art-card__action-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 3l5.05 5.05-1.41 1.41L13 6.83V17h-2V6.83L8.36 9.46 6.95 8.05z" />
    <path d="M5 19h14v-2H5z" />
  </svg>
);

const InfoIcon = () => (
  <svg className="art-card__action-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v-5h-2zm0-7h2V7h-2z" />
  </svg>
);

const ExpandIcon = () => (
  <svg className="art-card__action-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M21 3h-6v2h2.59L14 8.59 15.41 10 19 6.41V9h2zM3 3v6h2V6.41L8.59 10 10 8.59 6.41 5H9V3zm0 18h6v-2H6.41L10 15.41 8.59 14 5 17.59V15H3zM21 21v-6h-2v2.59L15.41 14 14 15.41 17.59 19H15v2z" />
  </svg>
);

export function ArtCard({ art, ref }: ArtCardProps) {
  const { isLiked, toggleLike } = useLikedArt(art.id);
  const { trackLike, trackShare, trackDetail } = useTrackInteraction(art);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [showTapLike, setShowTapLike] = useState(false);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const likeBurstTimeoutRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);

  const triggerLikeBurst = () => {
    setShowTapLike(true);
    if (likeBurstTimeoutRef.current) {
      window.clearTimeout(likeBurstTimeoutRef.current);
    }
    likeBurstTimeoutRef.current = window.setTimeout(() => setShowTapLike(false), 700);
  };

  const handleLikeButtonClick = () => {
    if (!isLiked) {
      toggleLike();
      trackLike();
      triggerLikeBurst();
      return;
    }
    toggleLike();
    setShowTapLike(false);
  };

  const handleShare = async () => {
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
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(urlToShare);
        setShareFeedback("Link copied");
      } else {
        setShareFeedback("Copy not supported");
      }
    } catch (error) {
      console.error("Share action failed", error);
      setShareFeedback("Share canceled");
    }

    trackShare();
    feedbackTimeoutRef.current = window.setTimeout(() => setShareFeedback(null), 2000);
  };

  const hue = Math.abs(art.id) % 360;
  const accentStyle = {
    "--accent-h": String(hue),
    "--accent-s": "74%",
    "--accent-l": "58%",
  } as CSSProperties;

  const trendingLabel = (() => {
    const highlight = art.culture || art.classification || art.medium || art.dated;
    if (!highlight) return null;
    return highlight.split(",")[0].trim();
  })();

  const trendingTag = (() => {
    if (!trendingLabel) return null;
    const condensed = trendingLabel.replace(/[^a-z0-9]+/gi, "");
    return condensed ? `#${condensed}` : `#${trendingLabel.replace(/\s+/g, "")}`;
  })();

  const handleDoubleTapLike = () => {
    if (!isLiked) {
      toggleLike();
      trackLike();
    }
    triggerLikeBurst();
  };

  const handleMediaTouchEnd = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      handleDoubleTapLike();
    }
    lastTapRef.current = now;
  };

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
          <h2 className="art-card__title">
            <Link to={`/artwork/${art.id}`} className="art-card__title-link" onClick={trackDetail}>
              {art.title}
            </Link>
          </h2>
          <p className="art-card__artist">{art.artist}</p>
        </div>

        {(art.classification || art.dated) && (
          <div className="art-card__tags">
            {art.classification && (
              <span className="art-card__tag">{art.classification.split(",")[0].trim()}</span>
            )}
            {art.dated && (
              <span className="art-card__tag">{art.dated}</span>
            )}
          </div>
        )}
      </div>

      <div className="art-card__actions" aria-label="Artwork actions">
        <div className="art-card__action">
          <button
            type="button"
            className={`art-card__action-button art-card__action-button--like ${isLiked ? "is-active" : ""}`.trim()}
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
          <Link
            className="art-card__action-button art-card__action-button--link"
            to={`/artwork/${art.id}`}
            aria-label="View artwork details"
            onClick={trackDetail}
          >
            <InfoIcon />
          </Link>
          <span className="art-card__action-label">Info</span>
        </div>

        <div className="art-card__action">
          <a
            className="art-card__action-button art-card__action-button--link"
            href={art.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Expand artwork full screen"
          >
            <ExpandIcon />
          </a>
          <span className="art-card__action-label">Expand</span>
        </div>
      </div>
    </article>
  );
}
