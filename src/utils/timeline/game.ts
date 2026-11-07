import type { Challenge, PlacedPainting, TimelinePainting } from "../../types/timeline";

/** One starting painting plus seven for the player to place */
export const ROUND_SIZE = 8;
export const PLACEMENTS = ROUND_SIZE - 1;
/** Paintings in a round are at least this far apart, so no placement is a coin flip. */
const MIN_YEAR_GAP = 12;

const DAY_MS = 86_400_000;
/** No. 1 was the first daily round. Days are UTC, so everyone shares a set. */
const FIRST_PUZZLE_DAY = Date.UTC(2026, 10, 7);

export function puzzleNumber(now: Date): number {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((day - FIRST_PUZZLE_DAY) / DAY_MS) + 1;
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deals the same paintings to everyone who plays a given seed. */
export function dealRound(seed: number, paintings: TimelinePainting[]): TimelinePainting[] {
  const random = seededRandom(seed * 2654435761);
  const shuffled = [...paintings];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const round: TimelinePainting[] = [];
  for (const painting of shuffled) {
    if (round.every((chosen) => Math.abs(chosen.year - painting.year) >= MIN_YEAR_GAP)) {
      round.push(painting);
    }
    if (round.length === ROUND_SIZE) break;
  }
  return round;
}

/** The slot a painting truly belongs in. Slot 0 is before the first card. */
export function correctSlot(placed: PlacedPainting[], year: number): number {
  const index = placed.findIndex((item) => item.painting.year > year);
  return index === -1 ? placed.length : index;
}

export function rankForScore(score: number): string {
  if (score === PLACEMENTS) return "Perfect Timeline";
  if (score >= 5) return "Art Historian";
  if (score >= 3) return "Gallery Guide";
  return "Time Traveller";
}

export function currentStreak(records: Record<string, unknown>, today: number): number {
  let day = records[today] ? today : today - 1;
  let streak = 0;
  while (records[day]) {
    streak++;
    day--;
  }
  return streak;
}

/** Reads a friend's challenge from a link like `?p=12&vs=5`. */
export function parseChallenge(search: string, today: number): Challenge | null {
  const params = new URLSearchParams(search);
  const puzzle = Number(params.get("p"));
  const score = Number(params.get("vs"));
  const isValid =
    Number.isInteger(puzzle) &&
    puzzle >= 1 &&
    puzzle <= today &&
    params.has("vs") &&
    Number.isInteger(score) &&
    score >= 0 &&
    score <= PLACEMENTS;
  return isValid ? { puzzle, score } : null;
}

/** A spoiler-free summary, so sharing doesn't give away the order. */
export function buildShareText(puzzle: number | null, score: number, marks: boolean[]): string {
  const dots = marks.map((mark) => (mark ? "●" : "○")).join("");
  const name = puzzle === null ? "ArtTok Timeline" : `ArtTok Timeline No. ${puzzle}`;
  return `${name}\n${score}/${PLACEMENTS} ${dots}\nCan you beat me?`;
}
