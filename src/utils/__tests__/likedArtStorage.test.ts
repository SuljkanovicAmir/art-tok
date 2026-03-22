import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readLikedSet, writeLikedSet, LIKED_ART_STORAGE_KEY, LIKED_ART_STORAGE_EVENT } from '../likedArtStorage';

describe('likedArtStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('readLikedSet', () => {
    it('returns empty set when no data exists', () => {
      expect(readLikedSet().size).toBe(0);
    });

    it('reads stored IDs', () => {
      localStorage.setItem(LIKED_ART_STORAGE_KEY, JSON.stringify([1, 2, 3]));
      const set = readLikedSet();
      expect(set.size).toBe(3);
      expect(set.has(1)).toBe(true);
      expect(set.has(2)).toBe(true);
      expect(set.has(3)).toBe(true);
    });

    it('filters out non-number values', () => {
      localStorage.setItem(LIKED_ART_STORAGE_KEY, JSON.stringify([1, "bad", null, 3]));
      const set = readLikedSet();
      expect(set.size).toBe(2);
      expect(set.has(1)).toBe(true);
      expect(set.has(3)).toBe(true);
    });

    it('handles corrupt JSON gracefully', () => {
      localStorage.setItem(LIKED_ART_STORAGE_KEY, 'not-json');
      expect(readLikedSet().size).toBe(0);
    });
  });

  describe('writeLikedSet', () => {
    it('persists a set to localStorage', () => {
      writeLikedSet(new Set([10, 20]));
      const raw = localStorage.getItem(LIKED_ART_STORAGE_KEY);
      expect(JSON.parse(raw!)).toEqual([10, 20]);
    });

    it('dispatches the custom event', () => {
      const listener = vi.fn();
      window.addEventListener(LIKED_ART_STORAGE_EVENT, listener);

      writeLikedSet(new Set([1]));
      expect(listener).toHaveBeenCalledTimes(1);

      window.removeEventListener(LIKED_ART_STORAGE_EVENT, listener);
    });
  });
});
