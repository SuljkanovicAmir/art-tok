import type { ArtPiece } from "../types/art";
import type { InteractionType, PreferenceVector } from "../types/preferences";
import { INTERACTION_WEIGHTS } from "../types/preferences";

const STORAGE_KEY = "arttok-preferences";

let cached: PreferenceVector | null = null;

function loadFromStorage(): PreferenceVector {
  if (typeof window === "undefined") return emptyVector();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.totalInteractions === "number") {
        return parsed as PreferenceVector;
      }
    }
  } catch { /* ignore */ }
  return emptyVector();
}

function saveToStorage(vector: PreferenceVector): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vector));
  } catch { /* storage full */ }
}

function emptyVector(): PreferenceVector {
  return { culture: {}, classification: {}, century: {}, medium: {}, totalInteractions: 0 };
}

function getVector(): PreferenceVector {
  if (!cached) cached = loadFromStorage();
  return cached;
}

function addWeight(bucket: Record<string, number>, key: string | undefined, weight: number): void {
  if (!key) return;
  bucket[key] = (bucket[key] || 0) + weight;
}

function dateToCentury(dated?: string): string | undefined {
  if (!dated) return undefined;
  const match = dated.match(/(\d{3,4})/);
  if (!match) return undefined;
  const year = parseInt(match[1], 10);
  const centuryNum = Math.ceil(year / 100);
  const suffix = centuryNum === 1 ? "st" : centuryNum === 2 ? "nd" : centuryNum === 3 ? "rd" : "th";
  return `${centuryNum}${suffix} century`;
}

export function recordInteraction(artwork: ArtPiece, type: InteractionType): void {
  const vector = getVector();
  const weight = INTERACTION_WEIGHTS[type];
  addWeight(vector.culture, artwork.culture, weight);
  addWeight(vector.classification, artwork.classification, weight);
  addWeight(vector.century, dateToCentury(artwork.dated), weight);
  addWeight(vector.medium, artwork.medium, weight);
  vector.totalInteractions += 1;
  cached = vector;
  saveToStorage(vector);
}

export function getPreferenceVector(): PreferenceVector {
  return getVector();
}

export function computeSimilarity(vector: PreferenceVector, artwork: ArtPiece): number {
  let score = 0;
  const century = dateToCentury(artwork.dated);
  if (artwork.culture && vector.culture[artwork.culture]) score += vector.culture[artwork.culture] * 0.30;
  if (artwork.classification && vector.classification[artwork.classification]) score += vector.classification[artwork.classification] * 0.25;
  if (century && vector.century[century]) score += vector.century[century] * 0.25;
  if (artwork.medium && vector.medium[artwork.medium]) score += vector.medium[artwork.medium] * 0.20;
  return score;
}

export function resetPreferences(): void {
  cached = null;
}
