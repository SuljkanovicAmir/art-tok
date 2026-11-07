import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Shuffle, X } from "lucide-react";
import type { JigsawChallenge, JigsawPainting, JigsawRecord } from "../../types/jigsaw";
import {
  DIFFICULTIES,
  buildShareText,
  formatTime,
  rankForTime,
} from "../../utils/jigsaw/game";

interface JigsawResultProps {
  record: JigsawRecord;
  painting: JigsawPainting;
  imageUrl: string;
  challenge: JigsawChallenge | null;
  streak: number;
  daysPlayed: number;
  /** The fastest unguided time, or the fastest overall if every round used the Guide */
  best: { ms: number; guided: boolean } | null;
  onNewRound: (pieces: number) => void;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Whole seconds, matching what formatTime shows, so a link and a screen agree. */
const wholeSeconds = (ms: number): number => Math.floor(ms / 1000);

function versusMessage(record: JigsawRecord, challenge: JigsawChallenge): string {
  const friend = formatTime(challenge.seconds * 1000);
  const mine = wholeSeconds(record.totalMs);
  if (mine < challenge.seconds) return `You beat your friend's ${friend}`;
  if (mine === challenge.seconds) return `You tied your friend's ${friend}`;
  return `Your friend wins with ${friend}`;
}

/** Time left until the next painting, at UTC midnight. */
function untilNextPainting(now: number): string {
  const date = new Date(now);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  const seconds = Math.max(0, Math.floor((midnight - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  return `${hours}:${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function JigsawResult({
  record,
  painting,
  imageUrl,
  challenge,
  streak,
  daysPlayed,
  best,
  onNewRound,
}: JigsawResultProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = [
    plural(record.moves, "move"),
    record.peeks > 0 ? plural(record.peeks, "peek") : null,
    record.guided ? "With the Guide on" : null,
  ].filter(Boolean);

  const handleShare = async () => {
    const path = `${window.location.origin}${import.meta.env.BASE_URL}jigsaw`;
    const url =
      record.puzzle === null
        ? path
        : `${path}?p=${record.puzzle}&vs=${Math.max(1, wholeSeconds(record.totalMs))}`;
    const text = buildShareText(record.puzzle, record);
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
    <div className="jigsaw__result">
      <header className="jigsaw__bar">
        <Link to="/games" className="jigsaw__close" aria-label="Back to the games">
          <X size={22} strokeWidth={2} />
        </Link>
        <p className="jigsaw__kicker">{record.puzzle === null ? "Practice" : `No. ${record.puzzle}`}</p>
        <span />
      </header>

      <figure className="jigsaw__frame">
        <Link to={`/artwork/met/${painting.id}`} className="jigsaw__frame-link">
          <img src={imageUrl} alt={`${painting.title} by ${painting.artist}`} />
        </Link>
        <figcaption className="jigsaw__caption">
          <span className="jigsaw__caption-title">{painting.title}</span>
          <span className="jigsaw__caption-meta">
            {painting.artist}, {painting.date}
          </span>
        </figcaption>
      </figure>

      <section className="jigsaw__summary" aria-live="polite">
        <p className="jigsaw__score">{formatTime(record.totalMs)}</p>
        <p className="jigsaw__rank">{rankForTime(record.totalMs, record.pieces)}</p>
        {stats.length > 0 && <p className="jigsaw__stats">{stats.join(", ")}</p>}

        {challenge && <p className="jigsaw__versus">{versusMessage(record, challenge)}</p>}

        <div className="jigsaw__actions">
          <button type="button" className="jigsaw__action jigsaw__action--primary" onClick={handleShare}>
            <Send size={18} strokeWidth={2} aria-hidden="true" />
            Challenge a friend
          </button>
          <button
            type="button"
            className="jigsaw__action"
            aria-expanded={choosing}
            onClick={() => setChoosing((open) => !open)}
          >
            <Shuffle size={18} strokeWidth={2} aria-hidden="true" />
            New round
          </button>
        </div>

        {choosing && (
          <div className="jigsaw__sizes" role="group" aria-label="Choose a size">
            {DIFFICULTIES.map((size) => (
              <button
                key={size.label}
                type="button"
                className="jigsaw__size"
                onClick={() => onNewRound(size.pieces)}
              >
                <span className="jigsaw__size-name">{size.label}</span>
                <span className="jigsaw__size-count">About {size.pieces} pieces</span>
              </button>
            ))}
          </div>
        )}

        {status && (
          <p className="jigsaw__note" role="status">
            {status}
          </p>
        )}
      </section>

      <footer className="jigsaw__footer">
        <dl className="jigsaw__totals">
          <div>
            <dt>Streak</dt>
            <dd>{streak}</dd>
          </div>
          <div>
            <dt>Days played</dt>
            <dd>{daysPlayed}</dd>
          </div>
          <div>
            <dt>Best time</dt>
            <dd>
              {best === null ? "None yet" : formatTime(best.ms)}
              {best?.guided && <small className="jigsaw__marker">Guide</small>}
            </dd>
          </div>
        </dl>
        <p className="jigsaw__note">Next painting in {untilNextPainting(now)}</p>
      </footer>
    </div>
  );
}
