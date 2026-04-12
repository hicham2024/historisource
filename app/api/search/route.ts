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

function computeScore(item: UnifiedResult, query: string): number {
  const q = query.toLowerCase().trim();
  let score = 0;

  const title = item.title.toLowerCase();

  if (title.includes(q)) score += 5;
  if (title.startsWith(q)) score += 3;

  const queryYearMatch = q.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (item.year && queryYearMatch && item.year.includes(queryYearMatch[1])) {
    score += 4;
  }

  if (item.documentType === "Manuscrit") score += 2;
  if (item.sourceType === "Source primaire") score += 2;

  return score;
}

function sortResults(results: ScoredResult[]): ScoredResult[] {
  return [...results].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const aYear = normalizeYear(a.year);
    const bYear = normalizeYear(b.year);

    if (aYear !== null && bYear !== null) return bYear - aYear;
    if (aYear !== null) return -1;
    if (bYear !== null) return 1;
    return 0;
  });
}

function expandQuery(query: string): string[] {
  const q = query.toLowerCase();
  const expansions = new Set<string>();

  expansions.add(query);

  if (q.includes("traité")) {
    expansions.add(query.replace(/traité/gi, "treaty"));
    expansions.add(query.replace(/traité/gi, "معاهدة"));
  }

  if (q.includes("tafna")) {
    expansions.add("Treaty of Tafna");
    expansions.add("Tafna treaty");
    expansions.add("معاهدة تافنة");
    expansions.add("Tafna 1837");
    expansions.add("Abdelkader Tafna");
    expansions.add("Abd el-Kader Tafna");
  }

  return Array.from(expansions);
}

function buildSmartLinks(query: string): SmartLink[] {
  const encoded = encodeURIComponent(query);

  return [
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
}

function buildExternalPortals(query: string): ExternalPortal[] {
  const encoded = encodeURIComponent(query);

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

    const officialUrl = ark
      ? `https://gallica.bnf.fr/${ark}`
      : identifier || null;

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
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || "1"));

  const source = req.nextUrl.searchParams.get("source") || "all";
  const documentType = req.nextUrl.searchParams.get("documentType") || "all";
  const primaryOnly = req.nextUrl.searchParams.get("primaryOnly") === "true";
  const yearFrom = Number(req.nextUrl.searchParams.get("yearFrom") || "") || null;
  const yearTo = Number(req.nextUrl.searchParams.get("yearTo") || "") || null;

  if (!q) {
    return NextResponse.json(
      { error: "Le paramètre q est obligatoire." },
      { status: 400 }
    );
  }

  try {
    const queries = expandQuery(q);

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
          .map((item) => ({
            ...item,
            score: computeScore(item, q),
          }))
          .filter((item) => item.score >= 2),
        {
          source,
          documentType,
          primaryOnly,
          yearFrom,
          yearTo,
        }
      )
    );

    return NextResponse.json({
      query: q,
      expandedQueries: queries,
      page,
      pageSize: merged.length,
      total: merged.length,
      hasMore: merged.length >= 30,
      results: merged,
      smartLinks: buildSmartLinks(q),
      externalPortals: buildExternalPortals(q),
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