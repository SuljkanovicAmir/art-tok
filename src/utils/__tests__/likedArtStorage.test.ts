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

    it('reads stored string keys', () => {
      localStorage.setItem(LIKED_ART_STORAGE_KEY, JSON.stringify(["harvard:1", "met:2", "artic:3"]));
      const set = readLikedSet();
      expect(set.size).toBe(3);
      expect(set.has("harvard:1")).toBe(true);
      expect(set.has("met:2")).toBe(true);
      expect(set.has("artic:3")).toBe(true);
    });

    it('migrates legacy numeric IDs to harvard: prefix', () => {
      localStorage.setItem(LIKED_ART_STORAGE_KEY, JSON.stringify([1, 3]));
      const set = readLikedSet();
      expect(set.size).toBe(2);
      expect(set.has("harvard:1")).toBe(true);
      expect(set.has("harvard:3")).toBe(true);
    });

    it('handles mixed legacy and new format', () => {
      localStorage.setItem(LIKED_ART_STORAGE_KEY, JSON.stringify([1, "met:2", null]));
      const set = readLikedSet();
      expect(set.size).toBe(2);
      expect(set.has("harvard:1")).toBe(true);
      expect(set.has("met:2")).toBe(true);
    });

    it('handles corrupt JSON gracefully', () => {
      localStorage.setItem(LIKED_ART_STORAGE_KEY, 'not-json');
      expect(readLikedSet().size).toBe(0);
    });
  });

  describe('writeLikedSet', () => {
    it('persists a set to localStorage', () => {
      writeLikedSet(new Set(["harvard:10", "met:20"]));
      const raw = localStorage.getItem(LIKED_ART_STORAGE_KEY);
      expect(JSON.parse(raw!)).toEqual(["harvard:10", "met:20"]);
    });

    it('dispatches the custom event', () => {
      const listener = vi.fn();
      window.addEventListener(LIKED_ART_STORAGE_EVENT, listener);

      writeLikedSet(new Set(["harvard:1"]));
      expect(listener).toHaveBeenCalledTimes(1);

      window.removeEventListener(LIKED_ART_STORAGE_EVENT, listener);
    });
  });
});
