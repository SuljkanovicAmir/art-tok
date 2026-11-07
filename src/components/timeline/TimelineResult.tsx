import { useState } from "react";
import { Link } from "react-router-dom";
import { Send, Shuffle, X } from "lucide-react";
import type { Challenge, TimelinePainting } from "../../types/timeline";
import { PLACEMENTS, buildShareText, rankForScore } from "../../utils/timeline/game";

interface TimelineResultProps {
  /** Every painting in the round, oldest first */
  paintings: TimelinePainting[];
  imageUrl: (painting: TimelinePainting) => string;
  score: number;
  marks: boolean[];
  /** Daily round number, or null for a practice round */
  puzzle: number | null;
  streak: number;
  challenge: Challenge | null;
  onPlayAgain: () => void;
}

function challengeMessage(score: number, challenge: Challenge): string {
  if (score > challenge.score) return `You beat your friend's ${challenge.score}/${PLACEMENTS}!`;
  if (score === challenge.score) return `You tied your friend's ${challenge.score}/${PLACEMENTS}.`;
  return `Your friend wins with ${challenge.score}/${PLACEMENTS}.`;
}

export default function TimelineResult({
  paintings,
  imageUrl,
  score,
  marks,
  puzzle,
  streak,
  challenge,
  onPlayAgain,
}: TimelineResultProps) {
  const [status, setStatus] = useState<string | null>(null);

  const handleShare = async () => {
    const path = `${window.location.origin}${import.meta.env.BASE_URL}timeline`;
    const url = puzzle === null ? path : `${path}?p=${puzzle}&vs=${score}`;
    const text = buildShareText(puzzle, score, marks);
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setStatus("Copied. Paste it to a friend.");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("Couldn't share that. Try again.");
    }
  };

  return (
    <div className="timeline__result">
      <header className="timeline__bar">
        <Link to="/" className="timeline__close" aria-label="Back to the feed">
          <X size={22} strokeWidth={2} />
        </Link>
        <p className="timeline__kicker">
          {puzzle === null ? "Practice" : `Timeline No. ${puzzle}`}
        </p>
        <span className="timeline__progress" />
      </header>

      <section className="timeline__summary" aria-live="polite">
        <p className="timeline__score">
          {score}
          <span>/{PLACEMENTS}</span>
        </p>
        <p className="timeline__rank">{rankForScore(score)}</p>
        <p className="timeline__dots" aria-hidden="true">
          {marks.map((mark, index) => (
            <span key={index} className={mark ? "is-right" : "is-wrong"} />
          ))}
        </p>
        {challenge && <p className="timeline__versus">{challengeMessage(score, challenge)}</p>}

        <div className="timeline__actions">
          <button
            type="button"
            className="timeline__action timeline__action--primary"
            onClick={handleShare}
          >
            <Send size={18} strokeWidth={2} aria-hidden="true" />
            Challenge a friend
          </button>
          <button type="button" className="timeline__action" onClick={onPlayAgain}>
            <Shuffle size={18} strokeWidth={2} aria-hidden="true" />
            New round
          </button>
        </div>
        {status && (
          <p className="timeline__note" role="status">
            {status}
          </p>
        )}
        {puzzle !== null && !challenge && (
          <p className="timeline__note">
            {streak > 1 ? `${streak} day streak. ` : ""}New paintings at midnight UTC.
          </p>
        )}
      </section>

      <ol className="timeline__recap">
        {paintings.map((painting) => (
          <li key={painting.id}>
            <Link to={`/artwork/met/${painting.id}`} className="timeline__card timeline__card--link">
              <img src={imageUrl(painting)} alt="" />
              <span className="timeline__card-text">
                <span className="timeline__card-title">{painting.title}</span>
                <span className="timeline__card-artist">{painting.artist}</span>
              </span>
              <span className="timeline__year">{painting.year}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
