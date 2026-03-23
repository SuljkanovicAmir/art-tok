import { describe, it, expect } from 'vitest';
import { parseDimensions } from '../parseDimensions';

describe('parseDimensions', () => {
  it('returns null for undefined input', () => {
    expect(parseDimensions(undefined)).toBeNull();
  });

  it('parses "H x W cm" format', () => {
    const result = parseDimensions('73.7 x 92.1 cm (29 x 36 1/4 in.)');
    expect(result).toEqual({ heightCm: 73.7, widthCm: 92.1 });
  });

  it('parses "H × W cm" format with unicode multiply', () => {
    const result = parseDimensions('39.4 × 31.4 cm');
    expect(result).toEqual({ heightCm: 39.4, widthCm: 31.4 });
  });

  it('parses inches and converts to cm', () => {
    const result = parseDimensions('10 x 8 in.');
    expect(result!.heightCm).toBeCloseTo(25.4);
    expect(result!.widthCm).toBeCloseTo(20.32);
  });

  it('handles "Sheet:" prefix', () => {
    const result = parseDimensions('Sheet: 25.4 x 20.32 cm');
    expect(result).toEqual({ heightCm: 25.4, widthCm: 20.32 });
  });

  it('returns null for unparseable strings', () => {
    expect(parseDimensions('irregular')).toBeNull();
  });
});
