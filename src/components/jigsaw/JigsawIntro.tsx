import { Link } from "react-router-dom";
import { X } from "lucide-react";
import type { CSSProperties } from "react";
import type { Jigsaw, JigsawChallenge, JigsawProgress } from "../../types/jigsaw";
import { formatTime, largestGroup } from "../../utils/jigsaw/game";
import { pieceBounds } from "../../utils/jigsaw/geometry";
import PieceCanvas from "./PieceCanvas";

interface JigsawIntroProps {
  /** "No. 3", or "Practice" */
  kicker: string;
  status: "loading" | "ready" | "error";
  jigsaw: Jigsaw | null;
  pieces: HTMLCanvasElement[];
  /** Piece count to show before the cut exists */
  pieceCount: number;
  challenge: JigsawChallenge | null;
  /** A daily round already under way */
  progress: JigsawProgress | null;
  /** True when a round was just chosen and starts as soon as it loads */
  starting: boolean;
  /** Daily rounds say "today's painting"; practice rounds say "this painting" */
  isDaily: boolean;
  onPlay: () => void;
  onContinue: () => void;
  onRetry: () => void;
}

const FAN_SLOTS = [
  { x: -36, y: 6, turn: -14 },
  { x: -18, y: -6, turn: -6 },
  { x: 0, y: 4, turn: 3 },
  { x: 18, y: -5, turn: 9 },
  { x: 36, y: 7, turn: 15 },
];

/** Five spread-out pieces, so the fan shows different parts of the painting. */
function fanPieces(total: number): number[] {
  const picks = FAN_SLOTS.map((_, i) => Math.floor(((i + 0.5) / FAN_SLOTS.length) * total));
  return picks.filter((piece, i) => picks.indexOf(piece) === i);
}

export default function JigsawIntro({
  kicker,
  status,
  jigsaw,
  pieces,
  pieceCount,
  challenge,
  progress,
  starting,
  isDaily,
  onPlay,
  onContinue,
  onRetry,
}: JigsawIntroProps) {
  const total = jigsaw ? jigsaw.cols * jigsaw.rows : pieceCount;
  const aspect = jigsaw ? pieceBounds(jigsaw, 0).width / pieceBounds(jigsaw, 0).height : 1;
  const rules = challenge
    ? `Your friend took ${formatTime(challenge.seconds * 1000)}. Can you beat it?`
    : `Rebuild ${isDaily ? "today's" : "this"} painting, ${total} pieces, against the clock.`;
  const elapsed = progress ? formatTime(progress.elapsedMs) : null;

  return (
    <div className="jigsaw__intro">
      <header className="jigsaw__bar">
        <Link to="/games" className="jigsaw__close" aria-label="Back to the games">
          <X size={22} strokeWidth={2} />
        </Link>
      </header>

      <div className="jigsaw__fan" aria-hidden="true" style={{ "--piece-aspect": aspect } as CSSProperties}>
        {status === "ready" &&
          jigsaw &&
          fanPieces(total).map((piece, i) => (
            <span
              key={piece}
              className="jigsaw__fan-piece"
              style={
                {
                  "--x": `${FAN_SLOTS[i].x}%`,
                  "--y": `${FAN_SLOTS[i].y}%`,
                  "--turn": `${FAN_SLOTS[i].turn}deg`,
                  "--i": i,
                } as CSSProperties
              }
            >
              <PieceCanvas source={pieces[piece]} />
            </span>
          ))}
      </div>

      <div className="jigsaw__intro-copy">
        <p className="jigsaw__kicker">{kicker}</p>
        <h1 className="jigsaw__title">Jigsaw</h1>
        <p className="jigsaw__rules">{rules}</p>

        {status === "error" ? (
          <>
            <p className="jigsaw__note" role="alert">
              The painting didn't load.
            </p>
            <button type="button" className="jigsaw__action jigsaw__action--primary" onClick={onRetry}>
              Try again
            </button>
          </>
        ) : status === "loading" ? (
          <>
            <p className="jigsaw__note" role="status">
              Preparing the pieces
            </p>
            {!starting && (
              <button type="button" className="jigsaw__action jigsaw__action--primary" disabled>
                Play
              </button>
            )}
          </>
        ) : progress && elapsed ? (
          <>
            <button type="button" className="jigsaw__action jigsaw__action--primary" onClick={onContinue}>
              Continue
            </button>
            <p className="jigsaw__note">
              {largestGroup(progress.state)} of {total} connected, {elapsed} so far
            </p>
          </>
        ) : (
          <button type="button" className="jigsaw__action jigsaw__action--primary" onClick={onPlay}>
            Play
          </button>
        )}
      </div>
    </div>
  );
}
