import { NextRequest, NextResponse } from "next/server";
import { parseHistoricalPrompt } from "@/lib/parsePrompt";
import { selectBestArchives } from "@/lib/router";
import { paresAdapter } from "@/lib/adapters/pares";
import { gallicaAdapter } from "@/lib/adapters/gallica";

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

type RelevanceLabel = "exact" | "strong" | "related";

type CitationSet = {
  chicago: string;
  mla: string;
  apa: string;
};

type ResultBadges = {
  isPrimary: boolean;
  hasScan: boolean;
  isOfficial: boolean;
};

type RelatedWork = {
  id: string;
  title: string;
  year: string | null;
  source: string;
  officialUrl: string | null;
};

type ScoredResult = UnifiedResult & {
  score: number;
  exactScore: number;
  relevanceLabel: RelevanceLabel;
};

type EnrichedResult = ScoredResult & {
  citation: CitationSet;
  badges: ResultBadges;
  related: RelatedWork[];
  historicalSummary: string | null;
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

function tokenize(value: string): string[] {
  return normalizeForMatch(value)
    .split(" ")
    .filter((w) => w.length > 2);
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

function dedupeByOfficialUrl(results: UnifiedResult[]): UnifiedResult[] {
  const seen = new Set<string>();
  const unique: UnifiedResult[] = [];

  for (const item of results) {
    const key =
      item.officialUrl?.toLowerCase() ||
      `${item.title.toLowerCase()}|${item.year ?? ""}|${item.source}`;

    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function convertParsedToAnalysis(prompt: string) {
  const parsed = parseHistoricalPrompt(prompt);

  const extractedYear =
    parsed.dateExact && /^\d{4}$/.test(parsed.dateExact)
      ? parsed.dateExact
      : parsed.dateFrom &&
        parsed.dateTo &&
        parsed.dateTo - parsed.dateFrom <= 4
      ? String(parsed.dateFrom + 2)
      : null;

  const exactDocumentMode = parsed.intent === "document_exact";

  const entities = uniq([
    ...parsed.persons.map((e) => e.canonicalLabel),
    ...parsed.places.map((e) => e.canonicalLabel),
    ...parsed.institutions.map((e) => e.canonicalLabel),
    ...parsed.events.map((e) => e.canonicalLabel),
  ]);

  const documentTypeMap: Record<string, string> = {
    letter: "lettre",
    manuscript: "manuscrit",
    newspaper: "journal",
    journal: "revue",
    book: "livre",
    map: "carte",
    image: "image",
    video: "video",
    archive: "archive",
  };

  const documentTypes = parsed.documentTypes.map((x) => documentTypeMap[x] ?? x);

  const preferredSourceMap: Record<string, string> = {
    pares: "PARES",
    gallica: "Gallica / BnF",
    internet_archive: "Internet Archive",
    loc: "Library of Congress",
    nara: "National Archives (USA)",
    cia: "CIA Reading Room",
    portugal_archives: "Archives portugaises",
    turkish_archives: "Archives turques",
  };

  const preferredSources = parsed.preferredArchives.map(
    (x) => preferredSourceMap[x] ?? x
  );

  const generatedQueries = uniq([prompt, ...entities, ...documentTypes]).filter(Boolean);

  const summary = parsed.isHistorical
    ? `Recherche historique interprétée comme ${parsed.intent}, avec priorité aux documents ${
        documentTypes.length ? documentTypes.join(", ") : "historiques"
      } et aux archives ${
        preferredSources.length ? preferredSources.join(", ") : "générales"
      }.`
    : "La demande ne semble pas relever clairement de la recherche historique.";

  return {
    parsed,
    analysis: {
      isHistorical: parsed.isHistorical,
      confidence: parsed.confidence,
      intent: parsed.intent as HistoricalIntent,
      exactDocumentMode,
      extractedYear,
      dateFrom: parsed.dateFrom ?? null,
      dateTo: parsed.dateTo ?? null,
      entities,
      documentTypes,
      preferredSources,
      languages: parsed.searchLanguages,
      summary,
      generatedQueries,
    } satisfies PromptAnalysis,
  };
}

function buildShortQueries(prompt: string, analysis: PromptAnalysis): string[] {
  const q = normalizeForMatch(prompt);
  const shortQueries = new Set<string>();

  const entities = analysis.entities;
  const docs = analysis.documentTypes;
  const year = analysis.extractedYear ? [analysis.extractedYear] : [];

  if (entities.length > 0) {
    shortQueries.add([...entities, ...year].join(" "));
    shortQueries.add([...entities, ...docs, ...year].join(" "));
  }

  if (q.includes("journal officiel")) {
    shortQueries.add("journal officiel france");
    if (analysis.extractedYear) {
      shortQueries.add(`journal officiel france ${analysis.extractedYear}`);
      shortQueries.add(
        `journal officiel republique francaise ${analysis.extractedYear}`
      );
    }
  }

  if (
    q.includes("accords d evian") ||
    q.includes("accords evian") ||
    q.includes("evian")
  ) {
    shortQueries.add("accords evian 1962");
    shortQueries.add("evian accords 1962");
    shortQueries.add("france algerie evian 1962");
  }

  if (q.includes("tafna")) {
    shortQueries.add("traite de tafna");
    shortQueries.add("traité de Tafna");
    shortQueries.add("treaty of tafna");
    shortQueries.add("tafna treaty");
    shortQueries.add("abdelkader tafna 1837");
    shortQueries.add("معاهدة تافنة");
  }

  if (q.includes("pedro iv") && (q.includes("maroc") || q.includes("morocco"))) {
    shortQueries.add("pedro iv maroc 1350");
    shortQueries.add("morocco aragon letter 1350");
    shortQueries.add("carta pedro iv marruecos 1350");
  }

  return Array.from(shortQueries).filter(Boolean);
}

function buildArchiveDrivenQueries(prompt: string) {
  const { parsed, analysis } = convertParsedToAnalysis(prompt);
  const archives = selectBestArchives(parsed);

  const generated = new Set<string>();
  generated.add(prompt);

  if (archives.includes("pares") && paresAdapter.supports(parsed)) {
    paresAdapter.buildQueries(parsed).forEach((q) => generated.add(q));
  }

  if (archives.includes("gallica") && gallicaAdapter.supports(parsed)) {
    gallicaAdapter.buildQueries(parsed).forEach((q) => generated.add(q));
  }

  buildShortQueries(prompt, analysis).forEach((q) => generated.add(q));
  analysis.generatedQueries.forEach((q) => generated.add(q));

  const normalized = normalizeForMatch(prompt);

  if (normalized.includes("traite")) {
    generated.add(prompt.replace(/traité/gi, "treaty"));
    generated.add(prompt.replace(/traite/gi, "treaty"));
    generated.add(prompt.replace(/traité/gi, "معاهدة"));
  }

  if (normalized.includes("pedro iv")) {
    generated.add("Pedro IV of Aragon");
    generated.add("Pedro IV de Aragon");
  }

  if (normalized.includes("sultan du maroc")) {
    generated.add("sultan of morocco");
    generated.add("سلطان المغرب");
  }

  return {
    queries: Array.from(generated).filter(Boolean),
    analysis,
    parsed,
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
    title.includes("manuscrit") ||
    title.includes("carta")
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

  const promptTokens = q.split(" ").filter((t) => t.length > 2);
  const titleTokens = new Set(title.split(" ").filter((t) => t.length > 2));

  let overlap = 0;
  for (const token of promptTokens) {
    if (titleTokens.has(token)) overlap += 1;
  }
  score += overlap;

  const promptYearMatch = q.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (item.year && promptYearMatch && item.year.includes(promptYearMatch[1])) {
    score += 4;
  }

  if (item.documentType === "Manuscrit") score += 2;
  if (item.documentType === "Journal") score += 1;
  if (item.sourceType === "Source primaire") score += 2;

  if (analysis.intent === "document_exact" && item.sourceType === "Source primaire") {
    score += 3;
  }

  if (analysis.intent === "bibliography" && item.documentType === "Livre") {
    score += 4;
  }

  if (
    analysis.intent === "event" &&
    (item.documentType === "Journal" || item.documentType === "Archive")
  ) {
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

function computeHistoricalRelevance(
  item: UnifiedResult,
  prompt: string
): { score: number; label: RelevanceLabel } {
  const q = normalizeForMatch(prompt);
  const title = normalizeForMatch(item.title);

  let score = 0;
  const keywords = q.split(" ").filter((w) => w.length > 3);

  if (title.includes(q)) score += 50;

  keywords.forEach((word) => {
    if (title.includes(word)) score += 8;
  });

  if (q.includes("tafna") && title.includes("tafna")) score += 25;

  if (
    (q.includes("traite") || q.includes("treaty")) &&
    (title.includes("traite") || title.includes("treaty"))
  ) {
    score += 20;
  }

  if (q.includes("abdelkader") && title.includes("abdelkader")) {
    score += 15;
  }

  if (q.includes("evian") && title.includes("evian")) {
    score += 25;
  }

  if (
    (q.includes("accord") || q.includes("agreement")) &&
    (title.includes("accord") || title.includes("agreement"))
  ) {
    score += 18;
  }

  const yearMatch = q.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (yearMatch && item.year?.includes(yearMatch[1])) {
    score += 10;
  }

  if (item.sourceType === "Source primaire") score += 8;
  if (item.source.includes("Gallica")) score += 5;
  if (item.source.includes("Internet Archive")) score += 5;

  if (score >= 70) return { score, label: "exact" };
  if (score >= 40) return { score, label: "strong" };
  return { score, label: "related" };
}

function sortHistoricalResults(results: ScoredResult[]): ScoredResult[] {
  const order: Record<RelevanceLabel, number> = {
    exact: 3,
    strong: 2,
    related: 1,
  };

  return [...results].sort((a, b) => {
    if (order[b.relevanceLabel] !== order[a.relevanceLabel]) {
      return order[b.relevanceLabel] - order[a.relevanceLabel];
    }

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

function applyFilters<T extends UnifiedResult>(
  results: T[],
  filters: {
    source?: string;
    documentType?: string;
    primaryOnly?: boolean;
    yearFrom?: number | null;
    yearTo?: number | null;
  }
): T[] {
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

async function searchInternetArchive(
  query: string,
  page: number
): Promise<UnifiedResult[]> {
  const rows = 50;

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
    sourceType:
      doc.mediatype === "texts" ? "Source secondaire" : "Source primaire",
    officialUrl: doc.identifier
      ? `https://archive.org/details/${doc.identifier}`
      : null,
    thumbnailUrl: doc.identifier
      ? `https://archive.org/services/img/${doc.identifier}`
      : null,
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

async function searchLibraryOfCongress(
  query: string,
  page: number
): Promise<UnifiedResult[]> {
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

function resolveKnownHistoricalWork(prompt: string): UnifiedResult | null {
  const q = normalizeForMatch(prompt);

  const knownWorks = [
    {
      aliases: [
        "كتاب الانيس المطرب بروض القرطاس",
        "الانيس المطرب بروض القرطاس",
        "روض القرطاس",
        "rawd al qirtas",
        "rawdolkirtas",
        "rawd qirtas",
      ],
      result: {
        id: "ia-rawdolkirtas",
        title: "الأنيس المطرب بروض القرطاس",
        year: null,
        language: "ar",
        documentType: "Livre",
        sourceType: "Source secondaire",
        officialUrl: "https://archive.org/details/rawdolkirtas",
        thumbnailUrl: null,
        source: "Internet Archive",
      } satisfies UnifiedResult,
    },
    {
      aliases: [
        "le maroc etude commerciale et agricole",
        "le maroc étude commerciale et agricole",
        "maroc etude commerciale et agricole",
      ],
      result: {
        id: "gallica-maroc-etude-commerciale",
        title: "Le Maroc : étude commerciale et agricole",
        year: null,
        language: "fr",
        documentType: "Livre",
        sourceType: "Source secondaire",
        officialUrl: "https://gallica.bnf.fr/ark:/12148/bpt6k5801135s",
        thumbnailUrl: null,
        source: "Gallica / BnF",
      } satisfies UnifiedResult,
    },
  ];

  for (const work of knownWorks) {
    if (work.aliases.some((alias) => q.includes(normalizeForMatch(alias)))) {
      return work.result;
    }
  }

  return null;
}

function removeArabicBookPrefix(value: string): string {
  return value.replace(/^كتاب\s+/i, "").trim();
}

function generateTitleVariants(prompt: string): string[] {
  const q = normalizeForMatch(prompt);
  const variants = new Set<string>();

  variants.add(prompt.trim());
  variants.add(q);

  const noBookPrefix = removeArabicBookPrefix(q);
  if (noBookPrefix) variants.add(noBookPrefix);

  const withoutPunctuation = q
    .replace(/[:.,;!?()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutPunctuation) variants.add(withoutPunctuation);

  const words = q.split(" ").filter((w) => w.length > 2);

  if (words.length >= 2) {
    variants.add(words.join(" "));
  }

  if (words.length >= 3) {
    variants.add(words.slice(0, 3).join(" "));
    variants.add(words.slice(-3).join(" "));
  }

  if (q.includes("روض القرطاس") || q.includes("الانيس المطرب")) {
    variants.add("روض القرطاس");
    variants.add("الأنيس المطرب بروض القرطاس");
    variants.add("rawd al qirtas");
    variants.add("rawdolkirtas");
  }

  if (
    q.includes("etude commerciale et agricole") ||
    q.includes("étude commerciale et agricole")
  ) {
    variants.add("le maroc etude commerciale et agricole");
    variants.add("maroc etude commerciale agricole");
    variants.add("le maroc étude commerciale et agricole");
  }

  if (q.includes("traité de tafna") || q.includes("traite de tafna") || q.includes("tafna")) {
    variants.add("traité de tafna");
    variants.add("traite de tafna");
    variants.add("treaty of tafna");
    variants.add("tafna treaty");
    variants.add("abdelkader tafna");
    variants.add("abdelkader 1837");
    variants.add("معاهدة تافنة");
  }

  if (q.includes("معاهدة")) {
    variants.add("treaty");
    variants.add("treaty tafna");
    variants.add("tafna treaty");
  }

  if (q.includes("تافنة")) {
    variants.add("tafna");
    variants.add("treaty of tafna");
    variants.add("abdelkader tafna");
  }

  return Array.from(variants).filter(Boolean);
}

function computeTitleSimilarityScore(prompt: string, title: string): number {
  const q = normalizeForMatch(prompt);
  const t = normalizeForMatch(title);

  if (!q || !t) return 0;

  let score = 0;

  if (t === q) score += 120;
  if (t.includes(q)) score += 60;
  if (q.includes(t) && t.length > 8) score += 30;

  const qTokens = tokenize(q);
  const tTokens = new Set(tokenize(t));

  let overlap = 0;
  for (const token of qTokens) {
    if (tTokens.has(token)) overlap += 1;
  }

  score += overlap * 10;

  const rareBoostTerms = [
    "tafna",
    "evian",
    "qirtas",
    "قرطاس",
    "الانيس",
    "المطرب",
    "abdelkader",
    "journal",
    "officiel",
    "maroc",
  ];

  for (const term of rareBoostTerms) {
    if (
      q.includes(normalizeForMatch(term)) &&
      t.includes(normalizeForMatch(term))
    ) {
      score += 12;
    }
  }

  const strongTerms = [
    "tafna",
    "abdelkader",
    "evian",
    "maroc",
    "qirtas",
    "قرطاس",
    "الانيس",
    "المطرب",
  ];

  for (const term of strongTerms) {
    if (q.includes(normalizeForMatch(term)) && t.includes(normalizeForMatch(term))) {
      score += 25;
    }
  }

  return score;
}

function computeResolverScore(item: UnifiedResult, variants: string[]): number {
  let best = 0;

  for (const variant of variants) {
    const score = computeTitleSimilarityScore(variant, item.title);
    if (score > best) best = score;
  }

  if (item.source === "Gallica / BnF") best += 8;
  if (item.source === "Internet Archive") best += 8;
  if (item.sourceType === "Source primaire") best += 6;
  if (item.documentType === "Livre") best += 6;
  if (item.documentType === "Manuscrit") best += 8;
  if (item.officialUrl) best += 4;

  return best;
}

async function resolveHistoricalWorks(
  prompt: string,
  page: number
): Promise<UnifiedResult[]> {
  const variants = generateTitleVariants(prompt);
  const allResults: UnifiedResult[] = [];

  const searches = await Promise.allSettled(
    variants.map((variant) =>
      Promise.allSettled([
        searchInternetArchive(variant, page),
        searchGallica(variant, page),
      ])
    )
  );

  for (const variantSearch of searches) {
    if (variantSearch.status !== "fulfilled") continue;

    for (const sourceResult of variantSearch.value) {
      if (sourceResult.status === "fulfilled") {
        allResults.push(...sourceResult.value);
      }
    }
  }

  const deduped = dedupeByOfficialUrl(allResults);

  return deduped
    .map((item) => ({
      item,
      resolverScore: computeResolverScore(item, variants),
    }))
    .filter((x) => x.resolverScore >= 10)
    .sort((a, b) => b.resolverScore - a.resolverScore)
    .map((x) => x.item);
}

function extractProbableAuthor(title: string): string | null {
  const cleaned = title.trim();

  const patterns = [
    /^([^.:]{3,80})\s*[:.-]\s*(.+)$/i,
    /^(.+?)\s+par\s+([^,.;]{3,80})$/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const first = match[1]?.trim();
      const second = match[2]?.trim();

      if (pattern.source.includes("par")) {
        return second || null;
      }

      if (
        first &&
        !normalizeForMatch(first).includes("maroc") &&
        !normalizeForMatch(first).includes("trait") &&
        first.split(" ").length <= 6
      ) {
        return first;
      }
    }
  }

  return null;
}

function buildCitation(item: UnifiedResult): CitationSet {
  const title = item.title || "Sans titre";
  const year = item.year || "s.d.";
  const source = item.source || "Source non précisée";
  const url = item.officialUrl || "";
  const author = extractProbableAuthor(item.title);

  const authorPart = author ? `${author}. ` : "";
  const titlePart = `${title}.`;

  return {
    chicago: `${authorPart}${titlePart} ${source}, ${year}.${url ? ` ${url}` : ""}`.trim(),
    mla: `${authorPart}${titlePart} ${source}, ${year}.${url ? ` ${url}` : ""}`.trim(),
    apa: `${author ? `${author}. ` : ""}(${year}). ${title}. ${source}.${url ? ` ${url}` : ""}`.trim(),
  };
}

function buildBadges(item: UnifiedResult): ResultBadges {
  return {
    isPrimary: item.sourceType === "Source primaire",
    hasScan: Boolean(item.officialUrl),
    isOfficial:
      item.source.includes("Gallica") ||
      item.source.includes("Archive") ||
      item.source.includes("Library"),
  };
}

function buildHistoricalSummary(
  item: UnifiedResult,
  prompt: string
): string | null {
  const q = normalizeForMatch(prompt);
  const title = normalizeForMatch(item.title);

  const summaryParts: string[] = [];

  if (title.includes("tafna")) {
    summaryParts.push("Document lié au traité de Tafna ou à son contexte historique.");
  }

  if (title.includes("evian")) {
    summaryParts.push("Document lié aux accords d’Évian ou à la guerre d’Algérie.");
  }

  if (title.includes("journal officiel")) {
    summaryParts.push(
      "Source officielle ou périodique administratif potentiellement utile pour la recherche institutionnelle."
    );
  }

  if (item.documentType === "Livre") {
    summaryParts.push("Ouvrage bibliographique consultable comme référence secondaire.");
  }

  if (item.sourceType === "Source primaire") {
    summaryParts.push("Ce résultat est classé comme source primaire.");
  }

  if (item.source.includes("Gallica")) {
    summaryParts.push("Disponible via Gallica, bibliothèque numérique patrimoniale de la BnF.");
  }

  if (item.source.includes("Internet Archive")) {
    summaryParts.push("Disponible via Internet Archive avec accès direct au document numérisé.");
  }

  if (summaryParts.length === 0 && q && title) {
    summaryParts.push("Résultat jugé pertinent pour la requête historique saisie.");
  }

  return summaryParts.join(" ");
}

function extractKeywords(title: string): string[] {
  return normalizeForMatch(title)
    .split(" ")
    .filter((w) => w.length > 4)
    .slice(0, 5);
}

function findRelatedWorks(
  current: UnifiedResult,
  all: UnifiedResult[]
): RelatedWork[] {
  const keywords = extractKeywords(current.title);
  const currentTitle = normalizeForMatch(current.title);

  return all
    .filter((item) => item.id !== current.id)
    .map((item) => {
      const title = normalizeForMatch(item.title);
      let score = 0;

      keywords.forEach((k) => {
        if (title.includes(k)) score += 2;
      });

      if (item.source === current.source) score += 1;
      if (item.documentType === current.documentType) score += 1;
      if (item.year && current.year && item.year === current.year) score += 1;
      if (title === currentTitle) score -= 10;

      return { item, relatedScore: score };
    })
    .filter((x) => x.relatedScore > 1)
    .sort((a, b) => b.relatedScore - a.relatedScore)
    .slice(0, 5)
    .map(({ item }) => ({
      id: item.id,
      title: item.title,
      year: item.year,
      source: item.source,
      officialUrl: item.officialUrl,
    }));
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

  const { analysis } = convertParsedToAnalysis(prompt);
  const knownWork = resolveKnownHistoricalWork(prompt);

  if (knownWork) {
    const knownResult: EnrichedResult = {
      ...knownWork,
      score: 100,
      exactScore: 100,
      relevanceLabel: "exact",
      citation: buildCitation(knownWork),
      badges: buildBadges(knownWork),
      historicalSummary: "Correspondance forte trouvée à partir d’un titre historique connu ou de ses variantes.",
      related: [],
    };

    return NextResponse.json({
      query: prompt,
      analysis: {
        ...analysis,
        exactDocumentMode: true,
        summary:
          "Correspondance forte trouvée à partir d’un titre historique connu ou de ses variantes.",
      },
      expandedQueries: [prompt],
      page: 1,
      pageSize: 1,
      total: 1,
      hasMore: false,
      results: [knownResult],
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
      error: "",
    });
  }

  if (!analysis.isHistorical) {
    return NextResponse.json({
      query: prompt,
      analysis,
      total: 0,
      results: [],
      smartLinks: buildSmartLinks(prompt, analysis),
      externalPortals: buildExternalPortals(prompt),
      expandedQueries: [],
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
  }

  try {
    const { queries } = buildArchiveDrivenQueries(prompt);

    const [resolverResults, responses] = await Promise.all([
      resolveHistoricalWorks(prompt, page),
      Promise.allSettled(
        queries.map((qi) =>
          Promise.allSettled([
            searchInternetArchive(qi, page),
            searchGallica(qi, page),
            searchLibraryOfCongress(qi, page),
            searchNara(qi, page),
          ])
        )
      ),
    ]);

    const allResults: UnifiedResult[] = [...resolverResults];

    responses.forEach((queryResult) => {
      if (queryResult.status === "fulfilled") {
        queryResult.value.forEach((sourceResult) => {
          if (sourceResult.status === "fulfilled") {
            allResults.push(...sourceResult.value);
          }
        });
      }
    });

    const enrichedBase: ScoredResult[] = dedupeResults(allResults)
      .map((item) => {
        const exactScore = computeExactDocumentScore(item, prompt, analysis);
        const relevance = computeHistoricalRelevance(item, prompt);
        const baseScore = computeScore(item, prompt, analysis);

        return {
          ...item,
          score: baseScore + relevance.score,
          exactScore,
          relevanceLabel: relevance.label,
        };
      })
      .filter(() => true);

    const mergedBase = sortHistoricalResults(
      applyFilters(enrichedBase, {
        source,
        documentType,
        primaryOnly,
        yearFrom: yearFrom ?? analysis.dateFrom,
        yearTo: yearTo ?? analysis.dateTo,
      })
    );

    const enrichedResults: EnrichedResult[] = mergedBase.map((item) => ({
      ...item,
      citation: buildCitation(item),
      badges: buildBadges(item),
      historicalSummary: buildHistoricalSummary(item, prompt),
      related: findRelatedWorks(item, mergedBase),
    }));

    return NextResponse.json({
      query: prompt,
      analysis,
      expandedQueries: queries,
      page,
      pageSize: enrichedResults.length,
      total: enrichedResults.length,
      hasMore: enrichedResults.length >= 30,
      results: enrichedResults,
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
      error:
        enrichedResults.length === 0
          ? "Aucun résultat direct trouvé avec les filtres actuels."
          : "",
    });
  } catch (error) {
    console.error("Erreur API search:", error);

    return NextResponse.json({
      query: prompt,
      analysis,
      total: 0,
      results: [],
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
      error: "Aucun résultat direct trouvé avec les filtres actuels.",
    });
  }
}