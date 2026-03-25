import type { CSSProperties } from "react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Send, Info, Maximize } from "lucide-react";
import type { ArtPiece } from "../types/art";
import { useLikedArt } from "../hooks/useLikedArt";
import { useTrackInteraction } from "../hooks/useTrackInteraction";
import { artKey } from "../utils/artKey";
import { loadShareImage, renderStoryCard } from "../utils/storyCardRenderer";

interface ArtCardProps {
  art: ArtPiece;
  ref?: React.Ref<HTMLDivElement>;
}

const IC = { className: "art-card__action-svg" };

export function ArtCard({ art, ref }: ArtCardProps) {
  const { isLiked, toggleLike } = useLikedArt(artKey(art));
  const { trackLike, trackShare, trackDetail } = useTrackInteraction(art);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [showTapLike, setShowTapLike] = useState(false);
  const [sharePreview, setSharePreview] = useState<{ url: string; file: File } | null>(null);
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

  // Step 1: Generate story card and show preview overlay
  const handleShare = async () => {
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }

    setShareFeedback("Creating…");

    try {
      const img = await loadShareImage(art.imageUrl);
      const blob = await renderStoryCard(art, img);

      const objectUrl = (img as HTMLImageElement & { _objectUrl?: string })._objectUrl;
      if (objectUrl) URL.revokeObjectURL(objectUrl);

      const file = new File([blob], `arttok-${art.source}-${art.id}.png`, { type: "image/png" });
      const previewUrl = URL.createObjectURL(blob);

      setShareFeedback(null);
      setSharePreview({ url: previewUrl, file });
    } catch {
      setShareFeedback("Failed");
      feedbackTimeoutRef.current = window.setTimeout(() => setShareFeedback(null), 2000);
    }
  };

  // Step 2: User taps share in preview — fresh gesture → native share sheet
  const handleShareConfirm = async () => {
    if (!sharePreview) return;

    const { file, url: previewUrl } = sharePreview;
    // iOS Safari: files must be the ONLY property — no title/text/url alongside
    const shareData = { files: [file] };

    try {
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else if (navigator.share) {
        // Browser supports share but not files — share URL instead
        await navigator.share({
          title: art.title,
          text: `"${art.title}" by ${art.artist}`,
          url: art.url || window.location.href,
        });
      } else {
        // No share API — download
        const a = document.createElement("a");
        a.href = previewUrl;
        a.download = file.name;
        a.click();
      }
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") {
        // Actual error (not user cancel) — download as fallback
        const a = document.createElement("a");
        a.href = previewUrl;
        a.download = file.name;
        a.click();
      }
    }

    trackShare();
    URL.revokeObjectURL(previewUrl);
    setSharePreview(null);
  };

  const handleShareClose = () => {
    if (sharePreview) URL.revokeObjectURL(sharePreview.url);
    setSharePreview(null);
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
          className="art-card__image-bg"
          src={art.imageUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
        />
        <img
          className="art-card__image"
          src={art.imageUrl}
          alt={`${art.title} by ${art.artist}`}
          loading="lazy"
          style={art.lqip ? { backgroundImage: `url(${art.lqip})`, backgroundSize: "cover" } : undefined}
        />
        {trendingTag && <span className="art-card__badge">{trendingTag}</span>}
        {showTapLike && (
          <span className="art-card__like-burst" aria-hidden="true">
            <Heart {...IC} />
          </span>
        )}
      </div>

      <div className="art-card__info">
        <div className="art-card__title-group">
          <h2 className="art-card__title">
            <Link to={`/artwork/${art.source}/${art.id}`} className="art-card__title-link" onClick={trackDetail}>
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
            <Heart {...IC} />
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
            <Send {...IC} />
          </button>
          <span className="art-card__action-label">Share</span>
          {shareFeedback && <span className="art-card__share-feedback">{shareFeedback}</span>}
        </div>

        <div className="art-card__action">
          <Link
            className="art-card__action-button art-card__action-button--link"
            to={`/artwork/${art.source}/${art.id}`}
            aria-label="View artwork details"
            onClick={trackDetail}
          >
            <Info {...IC} />
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
            <Maximize {...IC} />
          </a>
          <span className="art-card__action-label">Expand</span>
        </div>
      </div>
      {sharePreview && (
        <div className="art-card__share-overlay" onClick={handleShareClose}>
          <div className="art-card__share-preview" onClick={(e) => e.stopPropagation()}>
            <img src={sharePreview.url} alt="Story card preview" className="art-card__share-preview-img" />
            <div className="art-card__share-preview-actions">
              <button type="button" className="art-card__share-btn" onClick={handleShareConfirm}>
                Share
              </button>
              <button type="button" className="art-card__share-btn art-card__share-btn--close" onClick={handleShareClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
