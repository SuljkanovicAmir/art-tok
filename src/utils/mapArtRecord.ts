import type { ArtPiece, HarvardArtRecord } from "../types/art";

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function parseDominantColor(
  color: { color: string; css3: string; hue: string; percent: number },
): { h: number; s: number; l: number } | undefined {
  const hsl = hexToHsl(color.css3);
  return hsl ?? undefined;
}

export function mapArtRecord(record: HarvardArtRecord): ArtPiece | null {
  if (!record.primaryimageurl) {
    return null;
  }

  const artistNames = record.people
    ?.map((person) => person.name)
    .filter(Boolean)
    .join(", ");

  const description = record.description || record.labeltext || record.creditline;

  const tags = record.tags?.map((t) => t.tag).filter(Boolean);
  const additionalImages = record.images
    ?.map((img) => img.baseimageurl)
    .filter((u): u is string => Boolean(u))
    .filter((u) => u !== record.primaryimageurl);

  return {
    id: record.objectid,
    imageUrl: record.primaryimageurl,
    title: record.title || "Untitled",
    artist: artistNames || "Unknown artist",
    source: 'harvard' as const,
    description: description || undefined,
    shortDescription: record.labeltext?.trim() || undefined,
    culture: record.culture || undefined,
    dated: record.dated || undefined,
    dateStart: record.datebegin || undefined,
    dateEnd: record.dateend || undefined,
    classification: record.classification || undefined,
    department: record.department || undefined,
    styleTitle: record.style || record.period || undefined,
    medium: record.medium || record.technique || undefined,
    dimensions: record.dimensions || undefined,
    url: record.url || undefined,
    tags: tags && tags.length > 0 ? tags : undefined,
    creditLine: record.creditline || undefined,
    additionalImages: additionalImages && additionalImages.length > 0 ? additionalImages : undefined,
    dominantColor: record.colors?.[0] ? parseDominantColor(record.colors[0]) : undefined,
    galleryInfo: record.gallery?.gallerynumber
      ? `Gallery ${record.gallery.gallerynumber}`
      : record.gallery?.name || undefined,
    isOnView: Boolean(record.gallery?.gallerynumber),
  };
}
