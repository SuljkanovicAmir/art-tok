import type { ArtPiece, HarvardArtRecord } from "../types/art";

export function mapArtRecord(record: HarvardArtRecord): ArtPiece | null {
  if (!record.primaryimageurl) {
    return null;
  }

  const artistNames = record.people
    ?.map((person) => person.name)
    .filter(Boolean)
    .join(", ");

  const description = record.description || record.labeltext || record.creditline;

  return {
    id: record.objectid,
    imageUrl: record.primaryimageurl,
    title: record.title || "Untitled",
    artist: artistNames || "Unknown artist",
    description: description || undefined,
    culture: record.culture || undefined,
    dated: record.dated || undefined,
    classification: record.classification || undefined,
    medium: record.medium || record.technique || undefined,
    dimensions: record.dimensions || undefined,
    url: record.url || undefined,
  };
}
