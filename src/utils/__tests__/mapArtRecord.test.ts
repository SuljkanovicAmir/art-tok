import { describe, it, expect } from 'vitest';
import { mapArtRecord } from '../mapArtRecord';
import type { HarvardArtRecord } from '../../types/art';

describe('mapArtRecord', () => {
  it('returns null when primaryimageurl is missing', () => {
    const record: HarvardArtRecord = { objectid: 1 };
    expect(mapArtRecord(record)).toBeNull();
  });

  it('maps a full record to ArtPiece', () => {
    const record: HarvardArtRecord = {
      objectid: 123,
      primaryimageurl: 'https://example.com/img.jpg',
      title: 'Starry Night',
      people: [{ name: 'Vincent van Gogh', role: 'Artist' }],
      description: 'A swirling sky',
      culture: 'Dutch',
      dated: '1889',
      classification: 'Paintings',
      medium: 'Oil on canvas',
      dimensions: '73.7 cm × 92.1 cm',
      url: 'https://example.com/artwork/123',
    };

    const result = mapArtRecord(record);

    expect(result).toEqual({
      id: 123,
      imageUrl: 'https://example.com/img.jpg',
      title: 'Starry Night',
      artist: 'Vincent van Gogh',
      source: 'harvard',
      description: 'A swirling sky',
      culture: 'Dutch',
      dated: '1889',
      classification: 'Paintings',
      medium: 'Oil on canvas',
      dimensions: '73.7 cm × 92.1 cm',
      url: 'https://example.com/artwork/123',
    });
  });

  it('uses fallback values for missing fields', () => {
    const record: HarvardArtRecord = {
      objectid: 456,
      primaryimageurl: 'https://example.com/img2.jpg',
    };

    const result = mapArtRecord(record)!;

    expect(result.title).toBe('Untitled');
    expect(result.artist).toBe('Unknown artist');
    expect(result.source).toBe('harvard');
    expect(result.description).toBeUndefined();
    expect(result.culture).toBeUndefined();
  });

  it('falls back to technique when medium is missing', () => {
    const record: HarvardArtRecord = {
      objectid: 789,
      primaryimageurl: 'https://example.com/img3.jpg',
      technique: 'Woodblock print',
    };

    const result = mapArtRecord(record)!;
    expect(result.medium).toBe('Woodblock print');
  });

  it('falls back to labeltext then creditline for description', () => {
    const record: HarvardArtRecord = {
      objectid: 101,
      primaryimageurl: 'https://example.com/img4.jpg',
      labeltext: 'Museum label text',
    };
    expect(mapArtRecord(record)!.description).toBe('Museum label text');

    const record2: HarvardArtRecord = {
      objectid: 102,
      primaryimageurl: 'https://example.com/img5.jpg',
      creditline: 'Gift of the artist',
    };
    expect(mapArtRecord(record2)!.description).toBe('Gift of the artist');
  });

  it('joins multiple artist names', () => {
    const record: HarvardArtRecord = {
      objectid: 201,
      primaryimageurl: 'https://example.com/img6.jpg',
      people: [{ name: 'Alice' }, { name: 'Bob' }],
    };
    expect(mapArtRecord(record)!.artist).toBe('Alice, Bob');
  });
});
