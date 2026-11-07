import { useCallback, useState } from "react";
import type { CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import JigsawGame from "../components/jigsaw/JigsawGame";
import JigsawIntro from "../components/jigsaw/JigsawIntro";
import JigsawResult from "../components/jigsaw/JigsawResult";
import { useJigsawAssets } from "../hooks/useJigsawAssets";
import type {
  JigsawChallenge,
  JigsawPainting,
  JigsawProgress,
  JigsawRecord,
  JigsawRound,
} from "../types/jigsaw";
import { jigsawImageUrl } from "../utils/jigsaw/assets";
import { DAILY_PIECES, dailyPainting, gridFor, isValidState, parseChallenge } from "../utils/jigsaw/game";
import paintingList from "../utils/jigsaw/paintings.json";
import { readProgress, readRecords } from "../utils/jigsaw/storage";
import { currentStreak, puzzleNumber } from "../utils/timeline/game";

const paintings: JigsawPainting[] = paintingList;

type Screen = "intro" | "game" | "result";

function makeRound(puzzle: number | null, pieces: number, avoid?: number): JigsawRound {
  let painting: JigsawPainting;
  let seed: number;
  if (puzzle === null) {
    const pool = paintings.filter((item) => item.id !== avoid);
    painting = pool[Math.floor(Math.random() * pool.length)] ?? paintings[0];
    seed = 1 + Math.floor(Math.random() * 1_000_000);
  } else {
    painting = dailyPainting(puzzle, paintings);
    seed = puzzle;
  }
  return { puzzle, painting, seed, pieces, grid: gridFor(painting.width, painting.height, pieces) };
}

/** Saved progress is only trusted if it still describes this puzzle's pieces. */
function usableProgress(round: JigsawRound): JigsawProgress | null {
  if (round.puzzle === null) return null;
  const saved = readProgress(round.puzzle);
  if (!saved) return null;
  const valid = isValidState(saved.state, round.grid.cols * round.grid.rows) && Number.isFinite(saved.elapsedMs);
  return valid ? saved : null;
}

export default function JigsawPage() {
  const location = useLocation();
  const [today] = useState(() => puzzleNumber(new Date()));
  const [challenge, setChallenge] = useState<JigsawChallenge | null>(() =>
    parseChallenge(location.search, today),
  );
  const [round, setRound] = useState<JigsawRound>(() =>
    makeRound(challenge?.puzzle ?? today, DAILY_PIECES),
  );
  const [finished, setFinished] = useState<JigsawRecord | null>(() =>
    round.puzzle === null ? null : (readRecords()[round.puzzle] ?? null),
  );
  const [progress, setProgress] = useState<JigsawProgress | null>(() =>
    finished ? null : usableProgress(round),
  );
  const [screen, setScreen] = useState<Screen>(finished ? "result" : "intro");
  const [resumeFrom, setResumeFrom] = useState<JigsawProgress | null>(null);
  // A new key gives each round a fresh game.
  const [roundKey, setRoundKey] = useState(0);

  const assets = useJigsawAssets(round.painting, round.grid, round.seed, screen !== "result");

  const handleFinish = useCallback((record: JigsawRecord) => {
    setFinished(record);
    setProgress(null);
    setScreen("result");
  }, []);

  const handlePlay = () => {
    setResumeFrom(null);
    setScreen("game");
  };

  const handleContinue = () => {
    setResumeFrom(progress);
    setScreen("game");
  };

  const handleNewRound = (pieces: number) => {
    setChallenge(null);
    setRound(makeRound(null, pieces, round.painting.id));
    setFinished(null);
    setProgress(null);
    setResumeFrom(null);
    setRoundKey((key) => key + 1);
    setScreen("game");
  };

  const records = readRecords();
  const all = Object.values(records);
  const unguided = all.filter((record) => !record.guided);
  const pool = unguided.length > 0 ? unguided : all;
  const fastest = pool.length > 0 ? pool.reduce((best, record) => (record.totalMs < best.totalMs ? record : best)) : null;

  return (
    <main className="jigsaw" style={{ "--paint": round.painting.color } as CSSProperties}>
      {screen === "result" && finished ? (
        <JigsawResult
          record={finished}
          painting={round.painting}
          imageUrl={jigsawImageUrl(round.painting)}
          challenge={challenge}
          streak={currentStreak(records, today)}
          daysPlayed={all.length}
          best={fastest ? { ms: fastest.totalMs, guided: fastest.guided } : null}
          onNewRound={handleNewRound}
        />
      ) : screen === "game" && assets.status === "ready" && assets.jigsaw ? (
        <JigsawGame
          key={roundKey}
          round={round}
          jigsaw={assets.jigsaw}
          pieces={assets.pieces}
          initialProgress={resumeFrom}
          onFinish={handleFinish}
        />
      ) : (
        <JigsawIntro
          kicker={round.puzzle === null ? "Practice" : `No. ${round.puzzle}`}
          status={assets.status}
          jigsaw={assets.jigsaw}
          pieces={assets.pieces}
          pieceCount={round.pieces}
          challenge={challenge}
          progress={progress}
          starting={screen === "game"}
          isDaily={round.puzzle !== null}
          onPlay={handlePlay}
          onContinue={handleContinue}
          onRetry={assets.retry}
        />
      )}
    </main>
  );
}
