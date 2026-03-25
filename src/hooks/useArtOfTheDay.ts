import { useQuery } from "@tanstack/react-query";
import { artRegistry } from "../services/registry";
import type { ArtPiece, ArtSourceId } from "../types/art";

const SOURCES: ArtSourceId[] = ["harvard", "met", "artic"];
const DISMISS_KEY = "arttok:aotd-dismissed";

function todayHash(): number {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function isDismissedToday(): boolean {
  const stored = localStorage.getItem(DISMISS_KEY);
  if (!stored) return false;
  const d = new Date();
  return stored === `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dismissArtOfTheDay(): void {
  const d = new Date();
  localStorage.setItem(DISMISS_KEY, `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
}

export function useArtOfTheDay() {
  const hash = todayHash();
  const sourceIndex = hash % SOURCES.length;
  const source = SOURCES[sourceIndex];
  const page = (hash % 20) + 1;

  return useQuery<ArtPiece | null>({
    queryKey: ["art-of-the-day", hash],
    queryFn: async () => {
      const result = await artRegistry.fetchFeed({ page, size: 12 }, source);
      if (result.pieces.length === 0) return null;
      const pick = result.pieces[hash % result.pieces.length];
      return pick;
    },
    staleTime: 24 * 60 * 60 * 1000,
    enabled: !isDismissedToday(),
  });
}
