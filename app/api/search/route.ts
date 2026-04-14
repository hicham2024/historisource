import { NextRequest, NextResponse } from "next/server";

type UnifiedResult = {
  id: string;
  title: string;
  year: string | null;
  language: string | null;
  documentType: string;
  sourceType: string;
  officialUrl: string | null;
  thumbnailUrl: string | null;
  source: string;
};

type ScoredResult = UnifiedResult & {
  score: number;
  exactScore: number;
  relevanceLabel: "Très pertinent" | "Pertinent" | "Connexe";
  historicalSummary: string;
};

type SmartLink = {
  name: string;
  url: string;
};

type ExternalPortal = {
  name: string;
  url: string;
  note: string;
};

type HistoricalIntent =
  | "document_exact"
  | "event"
  | "person"
  | "place"
  | "period"
  | "topic"
  | "bibliography"
  | "non_historical";

type PromptAnalysis = {
  isHistorical: boolean;
  confidence: number;
  intent: HistoricalIntent;
  exactDocumentMode: boolean;
  extractedYear: string | null;
  dateFrom: number | null;
  dateTo: number | null;
  entities: string[];
  documentTypes: string[];
  preferredSources: string[];
  languages: string[];
  summary: string;
  generatedQueries: string[];
};

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractXmlTag(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");

  return [...xml.matchAll(regex)].map((m) =>
    decodeXmlEntities(
      m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim()
    )
  );
}

function normalizeYear(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return match ? Number(match[1]) : null;
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`"]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function dedupeResults(results: UnifiedResult[]): UnifiedResult[] {
  const seen = new Set<string>();
  const unique: UnifiedResult[] = [];

  for (const item of results) {
    const key = `${item.title.toLowerCase()}|${item.year ?? ""}|${item.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function detectEntities(prompt: string): string[] {
  const q = normalizeForMatch(prompt);
  const candidates = [
    "maroc",
    "morocco",
    "aragon",
    "pedro iv",
    "abd el kader",
    "abdelkader",
    "ottoman",
    "empire ottoman",
    "cia",
    "france",
    "espagne",
    "spain",
    "algerie",
    "andalus",
    "maghreb",
    "sultan",
    "roi",
    "king",
    "pedro",
  ];

  return uniq(candidates.filter((term) => q.includes(term)));
}

function detectDocumentTypes(prompt: string): string[] {
  const q = normalizeForMatch(prompt);
  const found: string[] = [];

  if (q.includes("lettre") || q.includes("letter")) found.push("lettre");
  if (q.includes("manuscrit") || q.includes("manuscript")) found.push("manuscrit");
  if (q.includes("journal") || q.includes("newspaper") || q.includes("presse")) found.push("journal");
  if (q.includes("revue") || q.includes("review") || q.includes("article")) found.push("revue");
  if (
    q.includes("livre") ||
    q.includes("book") ||
    q.includes("bibliographie") ||
    q.includes("bibliography")
  ) {
    found.push("livre");
  }
  if (q.includes("carte") || q.includes("map")) found.push("carte");
  if (q.includes("image") || q.includes("photo") || q.includes("iconographie")) found.push("image");
  if (q.includes("video") || q.includes("film")) found.push("video");
  if (q.includes("archive")) found.push("archive");

  return uniq(found);
}

function detectLanguages(prompt: string): string[] {
  const q = normalizeForMatch(prompt);
  const langs: string[] = [];

  if (/[ء-ي]/.test(prompt) || q.includes("arabe") || q.includes("arabic")) langs.push("ar");
  if (q.includes("francais") || q.includes("french")) langs.push("fr");
  if (q.includes("anglais") || q.includes("english")) langs.push("en");
  if (q.includes("espagnol") || q.includes("spanish") || q.includes("espanol")) langs.push("es");
  if (q.includes("turc") || q.includes("turkish")) langs.push("tr");

  return uniq(langs);
}

function detectPreferredSources(prompt: string): string[] {
  const q = normalizeForMatch(prompt);
  const sources: string[] = [];

  if (q.includes("france") || q.includes("french") || q.includes("francais")) {
    sources.push("Gallica / BnF");
  }

  if (
    q.includes("cia") ||
    q.includes("cold war") ||
    q.includes("guerre froide") ||
    q.includes("declassifie") ||
    q.includes("declassified")
  ) {
    sources.push("National Archives (USA)");
    sources.push("Library of Congress");
  }

  if (
    q.includes("usa") ||
    q.includes("united states") ||
    q.includes("amerique") ||
    q.includes("america")
  ) {
    sources.push("National Archives (USA)");
    sources.push("Library of Congress");
  }

  if (
    q.includes("book") ||
    q.includes("livre") ||
    q.includes("bibliographie") ||
    q.includes("bibliography")
  ) {
    sources.push("Internet Archive");
  }

  if (q.includes("espagne") || q.includes("spain") || q.includes("aragon") || q.includes("pedro iv")) {
    sources.push("Gallica / BnF");
  }

  if (sources.length === 0) {
    sources.push(
      "Gallica / BnF",
      "Internet Archive",
      "Library of Congress",
      "National Archives (USA)"
    );
  }

  return uniq(sources);
}

function detectDateRange(prompt: string): {
  extractedYear: string | null;
  dateFrom: number | null;
  dateTo: number | null;
} {
  const q = normalizeForMatch(prompt);

  const yearMatch = q.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return {
      extractedYear: yearMatch[1],
      dateFrom: year - 2,
      dateTo: year + 2,
    };
  }

  if (q.includes("xive") || q.includes("14e siecle") || q.includes("14th century")) {
    return { extractedYear: null, dateFrom: 1300, dateTo: 1399 };
  }

  if (q.includes("xixe") || q.includes("19e siecle") || q.includes("19th century")) {
    return { extractedYear: null, dateFrom: 1800, dateTo: 1899 };
  }

  if (q.includes("xxe") || q.includes("20e siecle") || q.includes("20th century")) {
    return { extractedYear: null, dateFrom: 1900, dateTo: 1999 };
  }

  return { extractedYear: null, dateFrom: null, dateTo: null };
}

function analyzeHistoricalPrompt(prompt: string): PromptAnalysis {
  const q = normalizeForMatch(prompt);

  const historicalKeywords = [
    "archive",
    "archives",
    "history",
    "historique",
    "histoire",
    "manuscrit",
    "manuscript",
    "journal",
    "revue",
    "presse",
    "letter",
    "lettre",
    "traite",
    "treaty",
    "sultan",
    "roi",
    "king",
    "empire",
    "dynastie",
    "dynasty",
    "chronique",
    "carte",
    "map",
    "colonial",
    "medieval",
    "ottoman",
    "aragon",
    "maroc",
    "morocco",
    "andalus",
    "abd el kader",
    "abdelkader",
    "pedro iv",
    "cia",
    "foia",
    "declassified",
    "declassifie",
    "world war",
    "guerre",
    "bibliographie",
    "bibliography",
    "livre",
    "book",
    "source primaire",
  ];

  const nonHistoricalKeywords = [
    "hotel",
    "restaurant",
    "flight",
    "vol",
    "recipe",
    "recette",
    "football",
    "match today",
    "meteo",
    "weather",
    "download movie",
    "streaming",
    "promo",
    "prix iphone",
    "laptop",
    "voiture neuve",
  ];

  let historicalScore = 0;
  let nonHistoricalScore = 0;

  historicalKeywords.forEach((keyword) => {
    if (q.includes(keyword)) historicalScore += 1;
  });

  nonHistoricalKeywords.forEach((keyword) => {
    if (q.includes(keyword)) nonHistoricalScore += 2;
  });

  const dateInfo = detectDateRange(prompt);
  const entities = detectEntities(prompt);
  const documentTypes = detectDocumentTypes(prompt);
  const preferredSources = detectPreferredSources(prompt);
  const languages = detectLanguages(prompt);

  const tokenCount = q.split(" ").filter(Boolean).length;
  const exactDocumentMode =
    tokenCount >= 6 &&
    (Boolean(dateInfo.extractedYear) ||
      documentTypes.includes("lettre") ||
      documentTypes.includes("manuscrit"));

  let intent: HistoricalIntent = "topic";

  if (q.includes("bibliographie") || q.includes("bibliography") || q.includes("revue") || q.includes("revues")) {
    intent = "bibliography";
  } else if (nonHistoricalScore > historicalScore + 1) {
    intent = "non_historical";
  } else if (exactDocumentMode) {
    intent = "document_exact";
  } else if (
    q.includes("traite") ||
    q.includes("treaty") ||
    q.includes("battle") ||
    q.includes("guerre")
  ) {
    intent = "event";
  } else if (
    q.includes("roi") ||
    q.includes("king") ||
    q.includes("sultan") ||
    q.includes("empereur") ||
    q.includes("abd el kader") ||
    q.includes("abdelkader")
  ) {
    intent = "person";
  } else if (dateInfo.extractedYear || dateInfo.dateFrom) {
    intent = "period";
  } else if (
    q.includes("maroc") ||
    q.includes("morocco") ||
    q.includes("aragon") ||
    q.includes("andalus")
  ) {
    intent = "place";
  }

  const confidence = Math.max(
    0,
    Math.min(
      1,
      (historicalScore + entities.length + documentTypes.length + (exactDocumentMode ? 2 : 0) - nonHistoricalScore + 1) / 8
    )
  );

  const queryParts = [...entities, ...documentTypes];
  if (dateInfo.extractedYear) queryParts.push(dateInfo.extractedYear);

  const generatedQueries = uniq([
    prompt,
    queryParts.join(" "),
    ...entities.map((e) => `${e} ${documentTypes.join(" ")} ${dateInfo.extractedYear ?? ""}`.trim()),
  ]).filter(Boolean);

  return {
    isHistorical: intent !== "non_historical",
    confidence,
    intent,
    exactDocumentMode,
    extractedYear: dateInfo.extractedYear,
    dateFrom: dateInfo.dateFrom,
    dateTo: dateInfo.dateTo,
    entities,
    documentTypes,
    preferredSources,
    languages,
    summary:
      intent === "non_historical"
        ? "La demande ne semble pas relever clairement de la recherche historique."
        : `Recherche historique interprétée comme ${intent}, avec priorité aux documents ${
            documentTypes.length ? documentTypes.join(", ") : "historiques"
          } et aux sources ${preferredSources.join(", ")}.`,
    generatedQueries,
  };
}

function computeExactDocumentScore(
  item: UnifiedResult,
  prompt: string,
  analysis: PromptAnalysis
): number {
  if (!analysis.exactDocumentMode) return 0;

  const q = normalizeForMatch(prompt);
  const title = normalizeForMatch(item.title);

  let score = 0;

  if (title === q) score += 20;
  if (title.includes(q)) score += 12;

  const promptTokens = q.split(" ").filter((t) => t.length > 2);
  const titleTokens = new Set(title.split(" ").filter((t) => t.length > 2));

  let matched = 0;
  for (const token of promptTokens) {
    if (titleTokens.has(token)) matched += 1;
  }

  score += matched * 2;

  if (analysis.extractedYear && item.year?.includes(analysis.extractedYear)) {
    score += 6;
  }

  if (item.sourceType === "Source primaire") score += 4;

  if (
    item.source.includes("Gallica") ||
    item.source.includes("National Archives") ||
    item.source.includes("Library of Congress")
  ) {
    score += 3;
  }

  if (
    title.includes("lettre") ||
    title.includes("letter") ||
    title.includes("trait") ||
    title.includes("manuscrit")
  ) {
    score += 3;
  }

  return score;
}

function computeScore(
  item: UnifiedResult,
  prompt: string,
  analysis: PromptAnalysis
): number {
  const q = normalizeForMatch(prompt);
  const title = normalizeForMatch(item.title);
  let score = 0;

  if (title.includes(q)) score += 5;
  if (title.startsWith(q)) score += 3;

  const promptYearMatch = q.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (item.year && promptYearMatch && item.year.includes(promptYearMatch[1])) {
    score += 4;
  }

  if (item.documentType === "Manuscrit") score += 2;
  if (item.sourceType === "Source primaire") score += 2;

  if (analysis.intent === "document_exact" && item.sourceType === "Source primaire") {
    score += 3;
  }

  if (analysis.intent === "bibliography" && item.documentType === "Livre") {
    score += 4;
  }

  if (analysis.intent === "event" && item.documentType === "Journal") {
    score += 2;
  }

  if (analysis.intent === "period" && item.year) {
    score += 1;
  }

  if (analysis.preferredSources.includes(item.source)) {
    score += 3;
  }

  return score;
}

function getRelevanceLabel(item: { score: number; exactScore: number }): "Très pertinent" | "Pertinent" | "Connexe" {
  const total = item.score + item.exactScore;
  if (item.exactScore >= 10 || total >= 16) return "Très pertinent";
  if (item.exactScore >= 4 || total >= 9) return "Pertinent";
  return "Connexe";
}

function buildHistoricalSummary(item: UnifiedResult): string {
  const parts: string[] = [];

  parts.push(
    item.sourceType === "Source primaire"
      ? "Source primaire"
      : "Source secondaire"
  );

  if (item.documentType) {
    parts.push(item.documentType.toLowerCase());
  }

  if (item.year) {
    parts.push(`daté${item.documentType === "Carte" ? "e" : ""} de ${item.year}`);
  } else {
    parts.push("sans date précise dans les métadonnées");
  }

  if (item.language) {
    parts.push(`en langue ${item.language}`);
  }

  parts.push(`conservé${item.documentType === "Carte" ? "e" : ""} via ${item.source}`);

  return parts.join(", ") + ".";
}

function sortResults(results: ScoredResult[]): ScoredResult[] {
  return [...results].sort((a, b) => {
    if (b.exactScore !== a.exactScore) return b.exactScore - a.exactScore;
    if (b.score !== a.score) return b.score - a.score;

    const aYear = normalizeYear(a.year);
    const bYear = normalizeYear(b.year);

    if (aYear !== null && bYear !== null) return bYear - aYear;
    if (aYear !== null) return -1;
    if (bYear !== null) return 1;
    return 0;
  });
}

function expandPromptQueries(prompt: string, analysis: PromptAnalysis): string[] {
  const q = normalizeForMatch(prompt);
  const expansions = new Set<string>();

  expansions.add(prompt);
  analysis.generatedQueries.forEach((g) => expansions.add(g));

  if (q.includes("traite")) {
    expansions.add(prompt.replace(/traité/gi, "treaty"));
    expansions.add(prompt.replace(/traite/gi, "treaty"));
    expansions.add(prompt.replace(/traité/gi, "معاهدة"));
  }

  if (q.includes("tafna")) {
    expansions.add("Treaty of Tafna");
    expansions.add("Tafna treaty");
    expansions.add("معاهدة تافنة");
    expansions.add("Tafna 1837");
    expansions.add("Abdelkader Tafna");
    expansions.add("Abd el-Kader Tafna");
  }

  if (q.includes("sultan du maroc")) {
    expansions.add("sultan of morocco");
    expansions.add("سلطان المغرب");
  }

  if (q.includes("pedro iv")) {
    expansions.add("Pedro IV of Aragon");
    expansions.add("Pedro IV de Aragon");
  }

  if (analysis.exactDocumentMode) {
    expansions.add(prompt.replace(/,/g, " "));
    expansions.add(prompt.replace(/\./g, " "));
  }

  return Array.from(expansions);
}

function buildSmartLinks(prompt: string, analysis: PromptAnalysis): SmartLink[] {
  const encoded = encodeURIComponent(prompt);

  const links: SmartLink[] = [
    {
      name: "Archives espagnoles (PARES)",
      url: `https://pares.cultura.gob.es/ParesBusquedas20/catalogo/search?nm=${encoded}`,
    },
    {
      name: "Gallica (BnF)",
      url: `https://gallica.bnf.fr/services/engine/search/sru?operation=searchRetrieve&query=${encoded}`,
    },
    {
      name: "Internet Archive",
      url: `https://archive.org/search.php?query=${encoded}`,
    },
    {
      name: "CIA Reading Room",
      url: `https://www.cia.gov/readingroom/search/site/${encoded}`,
    },
  ];

  const normalized = normalizeForMatch(prompt);

  if (
    analysis.exactDocumentMode &&
    normalized.includes("pedro iv") &&
    normalized.includes("sultan") &&
    normalized.includes("1350")
  ) {
    links.unshift({
      name: "PARES — Correspondance probable exacte",
      url: "https://pares.mcu.es/ParesBusquedas20/catalogo/description/4799864",
    });
  }

  return links;
}

function buildExternalPortals(prompt: string): ExternalPortal[] {
  const encoded = encodeURIComponent(prompt);

  return [
    {
      name: "PARES (archives espagnoles)",
      url:
        "https://pares.cultura.gob.es/metapares/advancedSearchForm" +
        `?title=&authors=&publisher=&year=&language=&centro=&topics=%22${encoded}%22&pagNum=1&pagSize=10`,
      note: "Portail officiel espagnol avec recherche préremplie.",
    },
    {
      name: "CIA FOIA Reading Room",
      url: "https://www.cia.gov/readingroom/home",
      note: "Portail officiel des documents déclassifiés de la CIA.",
    },
    {
      name: "Archives du Maroc",
      url: "https://www.archivesdumaroc.ma/",
      note: "Portail officiel trouvé, sans API publique générale vérifiée ici.",
    },
  ];
}

function applyFilters(
  results: ScoredResult[],
  filters: {
    source?: string;
    documentType?: string;
    primaryOnly?: boolean;
    yearFrom?: number | null;
    yearTo?: number | null;
  }
): ScoredResult[] {
  return results.filter((item) => {
    if (filters.source && filters.source !== "all" && item.source !== filters.source) {
      return false;
    }

    if (
      filters.documentType &&
      filters.documentType !== "all" &&
      item.documentType !== filters.documentType
    ) {
      return false;
    }

    if (filters.primaryOnly && item.sourceType !== "Source primaire") {
      return false;
    }

    const itemYear = normalizeYear(item.year);

    if (filters.yearFrom && (itemYear === null || itemYear < filters.yearFrom)) {
      return false;
    }

    if (filters.yearTo && (itemYear === null || itemYear > filters.yearTo)) {
      return false;
    }

    return true;
  });
}

async function searchInternetArchive(query: string, page: number): Promise<UnifiedResult[]> {
  const rows = 30;

  const url =
    "https://archive.org/advancedsearch.php" +
    `?q=${encodeURIComponent(`(${query}) AND mediatype:texts`)}` +
    "&fl[]=identifier" +
    "&fl[]=title" +
    "&fl[]=year" +
    "&fl[]=language" +
    "&fl[]=mediatype" +
    `&rows=${rows}` +
    `&page=${page}` +
    "&output=json";

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const docs = data.response?.docs ?? [];

  return docs.map((doc: any) => ({
    id: `archive:${doc.identifier ?? crypto.randomUUID()}`,
    title: doc.title ?? "Sans titre",
    year: doc.year ?? null,
    language: Array.isArray(doc.language)
      ? doc.language[0]
      : doc.language ?? null,
    documentType: doc.mediatype === "texts" ? "Livre" : "Autre",
    sourceType: doc.mediatype === "texts" ? "Source secondaire" : "Source primaire",
    officialUrl: doc.identifier ? `https://archive.org/details/${doc.identifier}` : null,
    thumbnailUrl: doc.identifier ? `https://archive.org/services/img/${doc.identifier}` : null,
    source: "Internet Archive",
  }));
}

async function searchGallica(query: string, page: number): Promise<UnifiedResult[]> {
  const pageSize = 50;
  const startRecord = (page - 1) * pageSize + 1;
  const cql = `(gallica all "${query}")`;

  const url =
    "https://gallica.bnf.fr/SRU" +
    `?operation=searchRetrieve&version=1.2&query=${encodeURIComponent(cql)}` +
    `&maximumRecords=${pageSize}` +
    `&startRecord=${startRecord}`;

  const res = await fetch(url, {
    headers: { Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return [];

  const xml = await res.text();

  const titles = extractXmlTag(xml, "dc:title");
  const dates = extractXmlTag(xml, "dc:date");
  const languages = extractXmlTag(xml, "dc:language");
  const identifiers = extractXmlTag(xml, "dc:identifier");
  const types = extractXmlTag(xml, "dc:type");

  const results: UnifiedResult[] = [];

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i] || "Sans titre";
    const year = dates[i] || null;
    const language = languages[i] || null;
    const identifier = identifiers[i] || "";
    const rawType = (types[i] || "").toLowerCase();

    const arkMatch = identifier.match(/ark:\/12148\/[a-z0-9]+/i);
    const ark = arkMatch ? arkMatch[0] : null;

    const officialUrl = ark ? `https://gallica.bnf.fr/${ark}` : identifier || null;

    let documentType = "Document";
    let sourceType = "Source primaire";

    if (rawType.includes("monographie") || rawType.includes("livre")) {
      documentType = "Livre";
      sourceType = "Source secondaire";
    } else if (rawType.includes("fascicule") || rawType.includes("journal")) {
      documentType = "Journal";
    } else if (rawType.includes("manuscrit")) {
      documentType = "Manuscrit";
    } else if (rawType.includes("carte")) {
      documentType = "Carte";
    } else if (rawType.includes("image")) {
      documentType = "Image";
    }

    results.push({
      id: `gallica:${ark ?? `${page}-${i}`}`,
      title,
      year,
      language,
      documentType,
      sourceType,
      officialUrl,
      thumbnailUrl: null,
      source: "Gallica / BnF",
    });
  }

  return results;
}

async function searchLibraryOfCongress(query: string, page: number): Promise<UnifiedResult[]> {
  const pageSize = 30;

  const url =
    "https://www.loc.gov/search/" +
    `?q=${encodeURIComponent(query)}` +
    "&fo=json" +
    `&c=${pageSize}` +
    `&sp=${page}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const docs = data.results ?? [];

  return docs.map((doc: any, index: number) => {
    const originalFormat = Array.isArray(doc.original_format)
      ? doc.original_format[0]
      : null;

    let documentType = "Document";
    let sourceType = "Source primaire";

    const fmt = (originalFormat || "").toLowerCase();

    if (fmt.includes("book")) {
      documentType = "Livre";
      sourceType = "Source secondaire";
    } else if (fmt.includes("manuscript")) {
      documentType = "Manuscrit";
    } else if (fmt.includes("map")) {
      documentType = "Carte";
    } else if (fmt.includes("newspaper")) {
      documentType = "Journal";
    } else if (fmt.includes("photo") || fmt.includes("print")) {
      documentType = "Image";
    }

    return {
      id: `loc:${doc.id ?? `${page}-${index}`}`,
      title: doc.title ?? "Sans titre",
      year: doc.date ?? null,
      language: Array.isArray(doc.language)
        ? doc.language[0]
        : doc.language ?? null,
      documentType,
      sourceType,
      officialUrl: doc.url || doc.id || null,
      thumbnailUrl: Array.isArray(doc.image_url) ? doc.image_url[0] : null,
      source: "Library of Congress",
    };
  });
}

async function searchNara(query: string, page: number): Promise<UnifiedResult[]> {
  const rows = 30;
  const offset = (page - 1) * rows;

  const url =
    "https://catalog.archives.gov/api/v2" +
    `?q=${encodeURIComponent(query)}` +
    `&rows=${rows}` +
    `&offset=${offset}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const docs = data?.body?.hits?.hits ?? [];

  return docs.map((hit: any, index: number) => {
    const source = hit?._source ?? {};
    const title = source?.title || source?.record?.title || "Sans titre";
    const naId = source?.naId || source?.record?.naId || null;

    const productionDates = source?.productionDates ?? [];
    const year =
      Array.isArray(productionDates) && productionDates.length > 0
        ? productionDates[0]?.logicalDate || null
        : null;

    const thumb =
      source?.objects?.object?.thumbnail?.["@url"] ||
      source?.objects?.object?.file?.["@url"] ||
      null;

    return {
      id: `nara:${naId ?? `${page}-${index}`}`,
      title,
      year,
      language: null,
      documentType: "Archive",
      sourceType: "Source primaire",
      officialUrl: naId ? `https://catalog.archives.gov/id/${naId}` : null,
      thumbnailUrl: thumb,
      source: "National Archives (USA)",
    };
  });
}

export async function GET(req: NextRequest) {
  const prompt = req.nextUrl.searchParams.get("q")?.trim();
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || "1"));

  const source = req.nextUrl.searchParams.get("source") || "all";
  const documentType = req.nextUrl.searchParams.get("documentType") || "all";
  const primaryOnly = req.nextUrl.searchParams.get("primaryOnly") === "true";
  const yearFrom = Number(req.nextUrl.searchParams.get("yearFrom") || "") || null;
  const yearTo = Number(req.nextUrl.searchParams.get("yearTo") || "") || null;

  if (!prompt) {
    return NextResponse.json(
      { error: "Le paramètre q est obligatoire." },
      { status: 400 }
    );
  }

  const analysis = analyzeHistoricalPrompt(prompt);

  if (!analysis.isHistorical || analysis.confidence < 0.25) {
    return NextResponse.json({
      query: prompt,
      analysis,
      total: 0,
      results: [],
      topExactMatch: null,
      smartLinks: [],
      externalPortals: buildExternalPortals(prompt),
      availableSources: [
        "all",
        "Internet Archive",
        "Gallica / BnF",
        "Library of Congress",
        "National Archives (USA)",
      ],
      availableDocumentTypes: [
        "all",
        "Livre",
        "Journal",
        "Manuscrit",
        "Carte",
        "Image",
        "Archive",
        "Document",
      ],
      error:
        "Cette demande ne semble pas suffisamment historique. Reformule-la comme une recherche historique, archivistique ou bibliographique.",
    });
  }

  try {
    const queries = expandPromptQueries(prompt, analysis);

    const responses = await Promise.allSettled(
      queries.map((qi) =>
        Promise.allSettled([
          searchInternetArchive(qi, page),
          searchGallica(qi, page),
          searchLibraryOfCongress(qi, page),
          searchNara(qi, page),
        ])
      )
    );

    const allResults: UnifiedResult[] = [];

    responses.forEach((queryResult) => {
      if (queryResult.status === "fulfilled") {
        queryResult.value.forEach((sourceResult) => {
          if (sourceResult.status === "fulfilled") {
            allResults.push(...sourceResult.value);
          }
        });
      }
    });

    const merged = sortResults(
      applyFilters(
        dedupeResults(allResults)
          .map((item) => {
            const exactScore = computeExactDocumentScore(item, prompt, analysis);
            const score = computeScore(item, prompt, analysis);
            return {
              ...item,
              score,
              exactScore,
              relevanceLabel: getRelevanceLabel({ score, exactScore }),
              historicalSummary: buildHistoricalSummary(item),
            };
          })
          .filter((item) => item.score >= 2 || item.exactScore >= 6),
        {
          source,
          documentType,
          primaryOnly,
          yearFrom: yearFrom ?? analysis.dateFrom,
          yearTo: yearTo ?? analysis.dateTo,
        }
      )
    );

    const topExactMatch =
      analysis.exactDocumentMode && merged.length > 0 && merged[0].exactScore >= 8
        ? merged[0]
        : null;

    return NextResponse.json({
      query: prompt,
      analysis,
      expandedQueries: queries,
      page,
      pageSize: merged.length,
      total: merged.length,
      hasMore: merged.length >= 30,
      results: merged,
      topExactMatch,
      smartLinks: buildSmartLinks(prompt, analysis),
      externalPortals: buildExternalPortals(prompt),
      availableSources: [
        "all",
        "Internet Archive",
        "Gallica / BnF",
        "Library of Congress",
        "National Archives (USA)",
      ],
      availableDocumentTypes: [
        "all",
        "Livre",
        "Journal",
        "Manuscrit",
        "Carte",
        "Image",
        "Archive",
        "Document",
      ],
    });
  } catch (error) {
    console.error("Erreur API search:", error);

    return NextResponse.json(
      { error: "Impossible de contacter les archives en ligne." },
      { status: 500 }
    );
  }
}