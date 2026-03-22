import { useParams, Link } from "react-router-dom";
import { useLikedArt } from "../hooks/useLikedArt";
import { useArtworkQuery } from "../hooks/useArtworkQuery";
import { ScaleReference } from "../components/ScaleReference";
import { ColorPalette } from "../components/ColorPalette";
import type { ArtPiece } from "../types/art";
import type { CSSProperties } from "react";

const HeartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="20" height="20" fill="currentColor">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.54 0 3.04 0.99 3.57 2.36h0.21C10.81 4.99 12.31 4 13.85 4 16.34 4 18.35 6 18.35 8.5c0 3.78-3.4 6.86-8.55 11.54z" />
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="20" height="20" fill="currentColor">
    <path d="M12 3l5.05 5.05-1.41 1.41L13 6.83V17h-2V6.83L8.36 9.46 6.95 8.05z" />
    <path d="M5 19h14v-2H5z" />
  </svg>
);

interface MetaField {
  label: string;
  value: string;
}

export default function ArtworkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const numericId = id ? Number(id) : undefined;
  const { data: art, isLoading, error } = useArtworkQuery(numericId);

  if (!id) {
    return (
      <div className="detail-page">
        <div className="detail-page__status">
          <p>No artwork ID provided</p>
          <Link to="/" className="detail-page__status-link">Back to feed</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="detail-page">
        <div className="detail-page__status">
          <p>Loading artwork...</p>
        </div>
      </div>
    );
  }

  if (error || !art) {
    return (
      <div className="detail-page">
        <div className="detail-page__status">
          <p>{error instanceof Error ? error.message : "Artwork not found"}</p>
          <Link to="/" className="detail-page__status-link">Back to feed</Link>
        </div>
      </div>
    );
  }

  return <ArtworkDetailContent art={art} />;
}

function ArtworkDetailContent({ art }: { art: ArtPiece }) {
  const { isLiked, toggleLike } = useLikedArt(art.id);

  const hue = Math.abs(art.id) % 360;
  const accentStyle = {
    "--art-card-accent": `hsl(${hue}, 74%, 58%)`,
  } as CSSProperties;

  const metaFields: MetaField[] = [];
  const add = (label: string, value: string | undefined) => {
    if (value?.trim()) metaFields.push({ label, value: value.trim() });
  };
  add("Created", art.dated);
  add("Culture", art.culture);
  add("Classification", art.classification);
  add("Medium", art.medium);
  add("Dimensions", art.dimensions);

  const handleShare = async () => {
    const urlToShare = art.url || window.location.href;
    const shareText = `Check out "${art.title}" by ${art.artist}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: art.title, text: shareText, url: urlToShare });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(urlToShare);
      }
    } catch {
      // share cancelled or not supported
    }
  };

  return (
    <div className="detail-page" style={accentStyle}>
      <header className="detail-page__header">
        <Link to="/" className="detail-page__back" aria-label="Back to feed">
          &larr; Back
        </Link>
      </header>

      <div className="detail-page__content">
        <div className="detail-page__image-container">
          <a href={art.imageUrl} target="_blank" rel="noopener noreferrer">
            <img
              className="detail-page__image"
              src={art.imageUrl}
              alt={`${art.title} by ${art.artist}`}
            />
          </a>
        </div>

        {art.dimensions && (
          <ScaleReference
            dimensions={art.dimensions}
            accentColor={`hsl(${hue}, 74%, 58%)`}
          />
        )}

        <ColorPalette imageUrl={art.imageUrl} />

        <h1 className="detail-page__title">{art.title}</h1>
        <p className="detail-page__artist">{art.artist}</p>

        {art.description && (
          <p className="detail-page__description">{art.description}</p>
        )}

        {metaFields.length > 0 && (
          <dl className="detail-page__meta">
            {metaFields.map((field) => (
              <div key={field.label} className="detail-page__meta-pair">
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="detail-page__actions">
          <button
            type="button"
            className={`detail-page__action-button ${isLiked ? "is-active" : ""}`.trim()}
            aria-pressed={isLiked}
            aria-label={isLiked ? "Unlike artwork" : "Like artwork"}
            onClick={toggleLike}
          >
            <HeartIcon />
            <span>{isLiked ? "Saved" : "Save"}</span>
          </button>

          <button
            type="button"
            className="detail-page__action-button"
            aria-label="Share artwork"
            onClick={handleShare}
          >
            <ShareIcon />
            <span>Share</span>
          </button>

          {art.url && (
            <a
              className="detail-page__museum-link"
              href={art.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              View at Harvard Art Museums
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
