export interface ParsedDimensions {
  heightCm: number;
  widthCm: number;
}

export function parseDimensions(dimensionStr: string | undefined): ParsedDimensions | null {
  if (!dimensionStr) return null;

  // Try to find "H x W cm" pattern
  const cmMatch = dimensionStr.match(
    /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*cm/i
  );
  if (cmMatch) {
    return { heightCm: parseFloat(cmMatch[1]), widthCm: parseFloat(cmMatch[2]) };
  }

  // Try inches: "H x W in" and convert
  const inMatch = dimensionStr.match(
    /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*in/i
  );
  if (inMatch) {
    return {
      heightCm: parseFloat(inMatch[1]) * 2.54,
      widthCm: parseFloat(inMatch[2]) * 2.54,
    };
  }

  return null;
}
