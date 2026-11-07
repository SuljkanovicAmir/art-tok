import { describe, expect, it } from "vitest";
import type { PlacedPainting, TimelinePainting, TimelineRecord } from "../../types/timeline";
import {
  PLACEMENTS,
  ROUND_SIZE,
  buildShareText,
  correctSlot,
  currentStreak,
  dealRound,
  parseChallenge,
  puzzleNumber,
  rankForScore,
} from "../timeline/game";
import paintings from "../timeline/paintings.json";

const list = paintings as TimelinePainting[];

const placedAt = (...years: number[]): PlacedPainting[] =>
  years.map((year, id) => ({ painting: { id, title: "", artist: "", year }, correct: null }));

describe("puzzleNumber", () => {
  it("numbers rounds by UTC day", () => {
    expect(puzzleNumber(new Date("2026-11-07T00:00:00Z"))).toBe(1);
    expect(puzzleNumber(new Date("2026-11-07T23:59:59Z"))).toBe(1);
    expect(puzzleNumber(new Date("2026-11-08T00:00:00Z"))).toBe(2);
  });
});

describe("dealRound", () => {
  it("gives everyone the same paintings for a puzzle", () => {
    expect(dealRound(5, list)).toEqual(dealRound(5, list));
  });

  it("changes from day to day", () => {
    expect(dealRound(5, list)).not.toEqual(dealRound(6, list));
  });

  it("always deals a full round with clear gaps between years", () => {
    for (let puzzle = 1; puzzle <= 400; puzzle++) {
      const years = dealRound(puzzle, list).map((painting) => painting.year).sort((a, b) => a - b);
      expect(years).toHaveLength(ROUND_SIZE);
      for (let i = 1; i < years.length; i++) {
        expect(years[i] - years[i - 1]).toBeGreaterThanOrEqual(12);
      }
    }
  });
});

describe("correctSlot", () => {
  const placed = placedAt(1500, 1700, 1900);

  it.each([
    [1400, 0],
    [1600, 1],
    [1800, 2],
    [1920, 3],
  ])("puts %i in slot %i", (year, slot) => {
    expect(correctSlot(placed, year)).toBe(slot);
  });
});

describe("parseChallenge", () => {
  it("reads a valid link", () => {
    expect(parseChallenge("?p=3&vs=5", 10)).toEqual({ puzzle: 3, score: 5 });
  });

  it("accepts a score of zero", () => {
    expect(parseChallenge("?p=3&vs=0", 10)).toEqual({ puzzle: 3, score: 0 });
  });

  it.each(["", "?p=3", "?vs=5", "?p=11&vs=5", "?p=0&vs=5", "?p=3&vs=8", "?p=3&vs=-1", "?p=x&vs=y"])(
    "ignores %s",
    (search) => {
      expect(parseChallenge(search, 10)).toBeNull();
    },
  );
});

describe("results", () => {
  it("ranks a perfect round", () => {
    expect(rankForScore(PLACEMENTS)).toBe("Perfect Timeline");
    expect(rankForScore(0)).toBe("Time Traveller");
  });

  it("shares a score without giving away the paintings", () => {
    expect(buildShareText(4, 2, [true, false, true])).toBe(
      "ArtTok Timeline No. 4\n2/7 ●○●\nCan you beat me?",
    );
  });

  it("counts a streak that ends today or yesterday", () => {
    const record = {} as TimelineRecord;
    expect(currentStreak({ 8: record, 9: record, 10: record }, 10)).toBe(3);
    expect(currentStreak({ 8: record, 9: record }, 10)).toBe(2);
    expect(currentStreak({ 7: record }, 10)).toBe(0);
  });
});
