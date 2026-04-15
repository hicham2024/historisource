import {
  ArchiveId,
  CanonicalDocumentType,
  CanonicalEntity,
  CanonicalHistoricalQuery,
  HistoricalIntent,
  SupportedLanguage,
} from "./types";
import {
  DOCUMENT_TYPE_SYNONYMS,
  ENTITY_MAP,
  HISTORICAL_KEYWORDS,
  NON_HISTORICAL_KEYWORDS,
  SOURCE_PREFERENCE_SYNONYMS,
} from "./dictionaries";
import { detectLanguage } from "./detectLanguage";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`"]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsWholePhrase(text: string, phrase: string): boolean {
  const normalizedText = ` ${normalize(text)} `;
  const normalizedPhrase = ` ${normalize(phrase)} `;
  return normalizedText.includes(normalizedPhrase);
}

function extractEntities(prompt: string): CanonicalEntity[] {
  return ENTITY_MAP.filter((entity) =>
    entity.variants.some((variant) => containsWholePhrase(prompt, variant))
  );
}

function extractDocumentTypes(prompt: string): CanonicalDocumentType[] {
  const found: CanonicalDocumentType[] = [];

  (Object.keys(DOCUMENT_TYPE_SYNONYMS) as CanonicalDocumentType[]).forEach((key) => {
    if (DOCUMENT_TYPE_SYNONYMS[key].some((variant) => containsWholePhrase(prompt, variant))) {
      found.push(key);
    }
  });

  return found;
}

function detectSourcePreference(prompt: string): "primary" | "secondary" | "any" {
  if (SOURCE_PREFERENCE_SYNONYMS.primary.some((x) => containsWholePhrase(prompt, x))) {
    return "primary";
  }

  if (SOURCE_PREFERENCE_SYNONYMS.secondary.some((x) => containsWholePhrase(prompt, x))) {
    return "secondary";
  }

  return "any";
}

function detectDate(prompt: string): {
  dateExact: string | null;
  dateFrom: number | null;
  dateTo: number | null;
} {
  const q = normalize(prompt);

  const yearMatch = q.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return {
      dateExact: yearMatch[1],
      dateFrom: year - 2,
      dateTo: year + 2,
    };
  }

  if (
    q.includes("14e siecle") ||
    q.includes("14th century") ||
    q.includes("siglo xiv") ||
    q.includes("القرن الرابع عشر")
  ) {
    return { dateExact: null, dateFrom: 1300, dateTo: 1399 };
  }

  if (
    q.includes("19e siecle") ||
    q.includes("19th century") ||
    q.includes("siglo xix") ||
    q.includes("القرن التاسع عشر")
  ) {
    return { dateExact: null, dateFrom: 1800, dateTo: 1899 };
  }

  if (
    q.includes("20e siecle") ||
    q.includes("20th century") ||
    q.includes("siglo xx") ||
    q.includes("القرن العشرين")
  ) {
    return { dateExact: null, dateFrom: 1900, dateTo: 1999 };
  }

  return { dateExact: null, dateFrom: null, dateTo: null };
}

function classifyIntent(
  normalizedPrompt: string,
  entities: CanonicalEntity[],
  documentTypes: CanonicalDocumentType[],
  dateExact: string | null
): HistoricalIntent {
  const tokenCount = normalizedPrompt.split(" ").filter(Boolean).length;

  const exactDocumentMode =
    tokenCount >= 6 &&
    entities.length >= 1 &&
    (
      documentTypes.includes("letter") ||
      documentTypes.includes("manuscript") ||
      (Boolean(dateExact) && entities.length >= 2)
    );

  if (
    normalizedPrompt.includes("bibliography") ||
    normalizedPrompt.includes("bibliographie")
  ) {
    return "bibliography";
  }

  if (exactDocumentMode) return "document_exact";

  if (
    normalizedPrompt.includes("accord") ||
    normalizedPrompt.includes("accords") ||
    normalizedPrompt.includes("traite") ||
    normalizedPrompt.includes("treaty") ||
    normalizedPrompt.includes("tratado") ||
    normalizedPrompt.includes("agreement") ||
    normalizedPrompt.includes("evian") ||
    normalizedPrompt.includes("معاهدة")
  ) {
    return "event";
  }

  if (
    entities.some((e) => e.canonicalId.includes("pedro")) ||
    normalizedPrompt.includes("roi") ||
    normalizedPrompt.includes("king") ||
    normalizedPrompt.includes("rey") ||
    normalizedPrompt.includes("rei") ||
    normalizedPrompt.includes("sultan") ||
    normalizedPrompt.includes("سلطان")
  ) {
    return "person";
  }

  if (dateExact) return "period";

  if (
    entities.some((e) =>
      ["morocco", "aragon", "france"].includes(e.canonicalId)
    )
  ) {
    return "place";
  }

  return "topic";
}

function selectPreferredArchives(
  entities: CanonicalEntity[],
  documentTypes: CanonicalDocumentType[],
  intent: HistoricalIntent
): ArchiveId[] {
  const ids = entities.map((e) => e.canonicalId);
  const archives: ArchiveId[] = [];

  if (ids.includes("pedro_iv_of_aragon") || ids.includes("aragon")) {
    archives.push("pares");
  }

  if (
    ids.includes("morocco") ||
    ids.includes("france") ||
    documentTypes.includes("book") ||
    documentTypes.includes("newspaper") ||
    documentTypes.includes("journal")
  ) {
    archives.push("gallica");
    archives.push("internet_archive");
  }

  if (documentTypes.includes("map") || documentTypes.includes("image")) {
    archives.push("loc");
  }

  if (ids.includes("cia")) {
    archives.push("nara");
    archives.push("cia");
  }

  return Array.from(new Set(archives));
}

export function parseHistoricalPrompt(prompt: string): CanonicalHistoricalQuery {
  const normalizedPrompt = normalize(prompt);
  const inputLanguage: SupportedLanguage = detectLanguage(prompt);

  let historicalScore = 0;
  let nonHistoricalScore = 0;

  HISTORICAL_KEYWORDS.forEach((word) => {
    if (containsWholePhrase(prompt, word)) historicalScore += 1;
  });

  NON_HISTORICAL_KEYWORDS.forEach((word) => {
    if (containsWholePhrase(prompt, word)) nonHistoricalScore += 2;
  });

  if (
    normalizedPrompt.includes("accord") ||
    normalizedPrompt.includes("accords") ||
    normalizedPrompt.includes("traite") ||
    normalizedPrompt.includes("treaty") ||
    normalizedPrompt.includes("agreement")
  ) {
    historicalScore += 3;
  }

  if (normalizedPrompt.includes("evian")) {
    historicalScore += 4;
  }

  const entities = extractEntities(prompt);
  const documentTypes = extractDocumentTypes(prompt);
  const sourcePreference = detectSourcePreference(prompt);
  const dateInfo = detectDate(prompt);

  const isHistorical =
    historicalScore + entities.length + documentTypes.length > nonHistoricalScore;

  const intent = isHistorical
    ? classifyIntent(normalizedPrompt, entities, documentTypes, dateInfo.dateExact)
    : "non_historical";

  const preferredArchives = isHistorical
    ? selectPreferredArchives(entities, documentTypes, intent)
    : [];

  const searchLanguages: SupportedLanguage[] = Array.from(
    new Set<SupportedLanguage>([
      inputLanguage,
      "fr",
      "es",
      "en",
      "pt",
      "tr",
      "ar",
    ])
  );

  const persons = entities.filter((e) => e.canonicalId.includes("pedro"));
  const places = entities.filter((e) =>
    ["morocco", "aragon", "france"].includes(e.canonicalId)
  );

  const confidence = Math.max(
    0,
    Math.min(
      1,
      (historicalScore + entities.length + documentTypes.length + 1 - nonHistoricalScore) / 8
    )
  );

  return {
    originalPrompt: prompt,
    normalizedPrompt,
    inputLanguage,
    isHistorical,
    confidence,
    intent,
    persons,
    places,
    institutions: entities.filter((e) => e.canonicalId === "cia"),
    events: [],
    dateExact: dateInfo.dateExact,
    dateFrom: dateInfo.dateFrom,
    dateTo: dateInfo.dateTo,
    documentTypes,
    sourcePreference,
    preferredArchives,
    searchLanguages,
  };
}