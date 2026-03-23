import { Link } from "react-router-dom";
import { useLikedArt } from "../hooks/useLikedArt";
import { useLikedArtQuery } from "../hooks/useLikedArtQuery";
import { readLikedSet } from "../utils/likedArtStorage";
import { artKey } from "../utils/artKey";
import type { ArtPiece } from "../types/art";

function LikedCard({ piece, index }: { piece: ArtPiece; index: number }) {
  const { toggleLike } = useLikedArt(artKey(piece));

  return (
    <div className="liked-card" style={{ animationDelay: `${index * 50}ms` }}>
      <img
        className="liked-card__image"
        src={piece.imageUrl}
        alt={piece.title}
        loading="lazy"
      />
      <button
        className="liked-card__unlike"
        onClick={toggleLike}
        aria-label={`Unlike ${piece.title}`}
      >
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </button>
      <div className="liked-card__info">
        <p className="liked-card__title">
          <Link to={`/artwork/${piece.source}/${piece.id}`}>{piece.title}</Link>
        </p>
        <p className="liked-card__artist">{piece.artist}</p>
      </div>
    </div>
  );
}

export default function LikedPage() {
  const { data: artworks, isLoading } = useLikedArtQuery();
  const likedCount = readLikedSet().size;

  return (
    <div className="liked-page">
      <header className="liked-page__header">
        <Link to="/" className="liked-page__back" aria-label="Back to feed">
          &larr; Back
        </Link>
        <h1 className="liked-page__heading">Liked Art</h1>
        <span className="liked-page__count">{likedCount}</span>
      </header>

      {isLoading ? (
        <div className="liked-page__status">Loading liked artworks...</div>
      ) : !artworks || artworks.length === 0 ? (
        <div className="liked-page__empty">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p>Your collection is empty</p>
          <p className="liked-page__empty-hint">Double-tap artworks in the feed to start collecting</p>
          <Link to="/" className="liked-page__empty-cta">Explore the feed</Link>
        </div>
      ) : (
        <div className="liked-page__grid">
          {artworks.map((piece, index) => (
            <LikedCard key={`${piece.source}:${piece.id}`} piece={piece} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
