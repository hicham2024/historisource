export type SupportedLanguage = "fr" | "es" | "pt" | "en" | "tr" | "ar";

export type HistoricalIntent =
  | "document_exact"
  | "bibliography"
  | "event"
  | "person"
  | "place"
  | "period"
  | "topic"
  | "non_historical";

export type CanonicalDocumentType =
  | "letter"
  | "manuscript"
  | "newspaper"
  | "journal"
  | "book"
  | "map"
  | "image"
  | "video"
  | "archive";

export type ArchiveId =
  | "pares"
  | "gallica"
  | "internet_archive"
  | "loc"
  | "nara"
  | "cia"
  | "portugal_archives"
  | "turkish_archives";

export type CanonicalEntity = {
  canonicalId: string;
  canonicalLabel: string;
  variants: string[];
};

export type CanonicalHistoricalQuery = {
  originalPrompt: string;
  normalizedPrompt: string;
  inputLanguage: SupportedLanguage;
  isHistorical: boolean;
  confidence: number;
  intent: HistoricalIntent;

  persons: CanonicalEntity[];
  places: CanonicalEntity[];
  institutions: CanonicalEntity[];
  events: CanonicalEntity[];

  dateExact?: string | null;
  dateFrom?: number | null;
  dateTo?: number | null;

  documentTypes: CanonicalDocumentType[];
  sourcePreference: "primary" | "secondary" | "any";

  preferredArchives: ArchiveId[];
  searchLanguages: SupportedLanguage[];
};

export type ArchiveSearchResult = {
  id: string;
  title: string;
  year: string | null;
  language: string | null;
  documentType: string;
  sourceType: string;
  officialUrl: string | null;
  thumbnailUrl: string | null;
  source: string;
  archiveId: ArchiveId;
};

export type ArchiveAdapter = {
  id: ArchiveId;
  name: string;
  supports(query: CanonicalHistoricalQuery): boolean;
  buildQueries(query: CanonicalHistoricalQuery): string[];
};