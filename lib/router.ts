import { ArchiveId, CanonicalHistoricalQuery } from "./types";

export function selectBestArchives(query: CanonicalHistoricalQuery): ArchiveId[] {
  if (!query.isHistorical) return [];
  if (query.preferredArchives.length > 0) return query.preferredArchives;

  return ["gallica", "internet_archive"];
}