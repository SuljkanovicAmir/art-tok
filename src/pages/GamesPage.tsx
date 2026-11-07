import { useState } from "react";
import { Link } from "react-router-dom";
import type { JigsawPainting } from "../types/jigsaw";
import type { TimelinePainting } from "../types/timeline";
import { jigsawImageUrl } from "../utils/jigsaw/assets";
import { dailyPainting, formatTime } from "../utils/jigsaw/game";
import jigsawList from "../utils/jigsaw/paintings.json";
import { readProgress, readRecords as readJigsawRecords } from "../utils/jigsaw/storage";
import { PLACEMENTS, currentStreak, dealRound, puzzleNumber } from "../utils/timeline/game";
import timelineList from "../utils/timeline/paintings.json";
import { readRecords as readTimelineRecords } from "../utils/timeline/storage";

const jigsawPaintings: JigsawPainting[] = jigsawList;
const timelinePaintings: TimelinePainting[] = timelineList;

interface GameCard {
  to: string;
  title: string;
  blurb: string;
  image: string;
  state: string;
  streak: number;
  /** Blur the art so a game's answer isn't given away */
  hideArt: boolean;
}

function buildCards(today: number): GameCard[] {
  const jigsawRecords = readJigsawRecords();
  const timelineRecords = readTimelineRecords();
  const jigsawToday = jigsawRecords[today];
  const timelineToday = timelineRecords[today];
  const art = dailyPainting(today, jigsawPaintings);
  const timelineArt = dealRound(today, timelinePaintings)[0];

  const jigsawState = jigsawToday
    ? `Played, ${formatTime(jigsawToday.totalMs)}`
    : readProgress(today)
      ? "In progress"
      : "Today's round is waiting";
  const timelineState = timelineToday
    ? `Played, ${timelineToday.score}/${PLACEMENTS}`
    : "Today's round is waiting";

  return [
    {
      to: "/jigsaw",
      title: "Jigsaw",
      blurb: "Rebuild the day's painting from its pieces, against the clock.",
      image: jigsawImageUrl(art),
      state: jigsawState,
      streak: currentStreak(jigsawRecords, today),
      hideArt: !jigsawToday,
    },
    {
      to: "/timeline",
      title: "Timeline",
      blurb: "Place paintings in history, oldest to newest.",
      image: `${import.meta.env.BASE_URL}game-paintings/${timelineArt.id}.jpg`,
      state: timelineState,
      streak: currentStreak(timelineRecords, today),
      hideArt: false,
    },
  ];
}

export default function GamesPage() {
  const [today] = useState(() => puzzleNumber(new Date()));
  const cards = buildCards(today);

  return (
    <main className="games">
      <h1 className="games__title">Games</h1>
      <p className="games__lead">A new round of each, every day.</p>
      <ul className="games__list">
        {cards.map((card) => (
          <li key={card.to}>
            <Link to={card.to} className="games__card">
              <img
                className={`games__art${card.hideArt ? " games__art--hidden" : ""}`}
                src={card.image}
                alt=""
                loading="lazy"
              />
              <span className="games__shade" aria-hidden="true" />
              <span className="games__copy">
                <span className="games__name">{card.title}</span>
                <span className="games__blurb">{card.blurb}</span>
                <span className="games__state">
                  {card.state}
                  {card.streak > 1 && <span className="games__streak">{card.streak} day streak</span>}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
