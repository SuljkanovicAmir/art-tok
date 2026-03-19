import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordInteraction,
  getPreferenceVector,
  computeSimilarity,
  resetPreferences,
} from '../preferenceEngine';
import type { ArtPiece } from '../../types/art';

const mockArtwork: ArtPiece = {
  id: 1,
  imageUrl: 'https://example.com/img.jpg',
  title: 'Test Art',
  artist: 'Test Artist',
  culture: 'French',
  classification: 'Paintings',
  dated: '1889',
  medium: 'Oil on canvas',
  source: 'harvard',
};

describe('preferenceEngine', () => {
  beforeEach(() => {
    localStorage.clear();
    resetPreferences();
  });

  it('starts with an empty preference vector', () => {
    const vector = getPreferenceVector();
    expect(vector.culture).toEqual({});
    expect(vector.classification).toEqual({});
    expect(vector.century).toEqual({});
    expect(vector.medium).toEqual({});
    expect(vector.totalInteractions).toBe(0);
  });

  it('records a like interaction and updates the vector', () => {
    recordInteraction(mockArtwork, 'like');
    const vector = getPreferenceVector();
    expect(vector.culture['French']).toBeGreaterThan(0);
    expect(vector.classification['Paintings']).toBeGreaterThan(0);
    expect(vector.totalInteractions).toBe(1);
  });

  it('weighs likes more heavily than views', () => {
    const artwork2: ArtPiece = { ...mockArtwork, id: 2 };
    recordInteraction(mockArtwork, 'like');
    recordInteraction(artwork2, 'view');
    const vector = getPreferenceVector();
    // Like weight is 1.0, view weight is 0.3 => French = 1.3
    expect(vector.culture['French']).toBeCloseTo(1.3, 1);
  });

  it('computes similarity between user vector and artwork attributes', () => {
    recordInteraction(mockArtwork, 'like');
    recordInteraction(mockArtwork, 'like');
    const vector = getPreferenceVector();

    const similarArt: ArtPiece = { ...mockArtwork, id: 2 };
    const differentArt: ArtPiece = {
      ...mockArtwork,
      id: 3,
      culture: 'Japanese',
      classification: 'Prints',
      medium: 'Woodblock',
    };

    const similarScore = computeSimilarity(vector, similarArt);
    const differentScore = computeSimilarity(vector, differentArt);
    expect(similarScore).toBeGreaterThan(differentScore);
  });

  it('handles skip interactions with negative weight', () => {
    recordInteraction(mockArtwork, 'like');
    const artwork2: ArtPiece = { ...mockArtwork, id: 2, culture: 'Japanese' };
    recordInteraction(artwork2, 'skip');
    const vector = getPreferenceVector();
    expect(vector.culture['French']).toBeGreaterThan(0);
    expect(vector.culture['Japanese']).toBeLessThan(0);
  });

  it('persists preferences across calls via localStorage', () => {
    recordInteraction(mockArtwork, 'like');
    resetPreferences(); // clears in-memory cache, forces reload from storage
    const vector = getPreferenceVector();
    expect(vector.culture['French']).toBeGreaterThan(0);
    expect(vector.totalInteractions).toBe(1);
  });
});
