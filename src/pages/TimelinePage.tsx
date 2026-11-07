import { useCallback, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import TimelineBoard from "../components/timeline/TimelineBoard";
import TimelineResult from "../components/timeline/TimelineResult";
import type { Challenge, PlacedPainting, TimelinePainting } from "../types/timeline";
import {
  PLACEMENTS,
  currentStreak,
  dealRound,
  parseChallenge,
  puzzleNumber,
} from "../utils/timeline/game";
import paintingList from "../utils/timeline/paintings.json";
import { readRecords, saveRecord } from "../utils/timeline/storage";

const paintings: TimelinePainting[] = paintingList;

interface Round {
  /** Null for a practice round, which doesn't affect the daily record */
  puzzle: number | null;
  /** Deal order: the first painting starts on the timeline */
  cards: TimelinePainting[];
}

interface Finished {
  score: number;
  marks: boolean[];
}

const imageUrl = (painting: TimelinePainting) =>
  `${import.meta.env.BASE_URL}game-paintings/${painting.id}.jpg`;

const byYear = (a: TimelinePainting, b: TimelinePainting) => a.year - b.year;

export default function TimelinePage() {
  const location = useLocation();
  const [today] = useState(() => puzzleNumber(new Date()));
  const [challenge, setChallenge] = useState<Challenge | null>(() =>
    parseChallenge(location.search, today),
  );
  const startPuzzle = challenge?.puzzle ?? today;

  const [round, setRound] = useState<Round>({
    puzzle: startPuzzle,
    cards: dealRound(startPuzzle, paintings),
  });
  const [finished, setFinished] = useState<Finished | null>(() => {
    const saved = readRecords()[startPuzzle];
    return saved ? { score: saved.score, marks: saved.marks } : null;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  // A new key gives each round a fresh board.
  const [roundKey, setRoundKey] = useState(0);

  const handleFinish = useCallback(
    (_placed: PlacedPainting[], marks: boolean[]) => {
      const score = marks.filter(Boolean).length;
      if (round.puzzle !== null) saveRecord({ puzzle: round.puzzle, score, marks });
      setFinished({ score, marks });
      setIsPlaying(false);
    },
    [round.puzzle],
  );

  const handlePlayAgain = () => {
    setChallenge(null);
    setRound({ puzzle: null, cards: dealRound(Math.floor(Math.random() * 1_000_000), paintings) });
    setFinished(null);
    setRoundKey((key) => key + 1);
    setIsPlaying(true);
  };

  const roundLabel = round.puzzle === null ? "Practice" : `Timeline No. ${round.puzzle}`;

  return (
    <main className="timeline">
      {!isPlaying && !finished && (
        <div className="timeline__intro">
          <header className="timeline__bar">
            <Link to="/" className="timeline__close" aria-label="Back to the feed">
              <X size={22} strokeWidth={2} />
            </Link>
          </header>
          <div className="timeline__fan" aria-hidden="true">
            {round.cards.slice(1, 4).map((painting) => (
              <img key={painting.id} src={imageUrl(painting)} alt="" />
            ))}
          </div>
          <div className="timeline__intro-copy">
            <p className="timeline__kicker">No. {round.puzzle}</p>
            <h1 className="timeline__title">Timeline</h1>
            <p className="timeline__rules">
              {challenge
                ? `Your friend scored ${challenge.score}/${PLACEMENTS}. Can you beat it?`
                : `Drag ${PLACEMENTS} paintings into history, oldest to newest.`}
            </p>
            <button
              type="button"
              className="timeline__action timeline__action--primary"
              onClick={() => setIsPlaying(true)}
            >
              Play
            </button>
          </div>
        </div>
      )}

      {isPlaying && (
        <TimelineBoard
          key={roundKey}
          round={round.cards}
          imageUrl={imageUrl}
          label={roundLabel}
          onFinish={handleFinish}
        />
      )}

      {!isPlaying && finished && (
        <TimelineResult
          paintings={[...round.cards].sort(byYear)}
          imageUrl={imageUrl}
          score={finished.score}
          marks={finished.marks}
          puzzle={round.puzzle}
          streak={currentStreak(readRecords(), today)}
          challenge={challenge}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </main>
  );
}
