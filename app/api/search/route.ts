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

type ScoredResult = UnifiedResult & {
  score: number;
  exactScore: number;
  relevanceLabel: RelevanceLabel;
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

function convertParsedToAnalysis(prompt: string) {
  const parsed = parseHistoricalPrompt(prompt);

  const extractedYear =
    parsed.dateExact && /^\d{4}$/.test(parsed.dateExact)
      ? parsed.dateExact
      : parsed.dateFrom && parsed.dateTo && parsed.dateTo - parsed.dateFrom <= 4
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
      } et aux archives ${preferredSources.length ? preferredSources.join(", ") : "générales"}.`
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
      shortQueries.add(`journal officiel republique francaise ${analysis.extractedYear}`);
    }
  }

  if (q.includes("accords d evian") || q.includes("accords evian") || q.includes("evian")) {
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

  if (analysis.intent === "event" && (item.documentType === "Journal" || item.documentType === "Archive")) {
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

/* =========================
   NOUVEAU : ranking historique
   ========================= */

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
    results: [
      {
        ...knownWork,
        score: 100,
        exactScore: 100,
        relevanceLabel: "exact",
      },
    ],
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

    const enriched = dedupeResults(allResults)
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
      .filter((item) => item.score >= 1 || item.exactScore >= 4);

    const merged = sortHistoricalResults(
      applyFilters(enriched, {
        source,
        documentType,
        primaryOnly,
        yearFrom: yearFrom ?? analysis.dateFrom,
        yearTo: yearTo ?? analysis.dateTo,
      })
    );

    return NextResponse.json({
      query: prompt,
      analysis,
      expandedQueries: queries,
      page,
      pageSize: merged.length,
      total: merged.length,
      hasMore: merged.length >= 30,
      results: merged,
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
      error: merged.length === 0 ? "Aucun résultat direct trouvé avec les filtres actuels." : "",
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