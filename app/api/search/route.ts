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

async function searchInternetArchive(query: string): Promise<UnifiedResult[]> {
  const url =
    "https://archive.org/advancedsearch.php" +
    `?q=${encodeURIComponent(`(${query}) AND mediatype:texts`)}` +
    "&fl[]=identifier" +
    "&fl[]=title" +
    "&fl[]=year" +
    "&fl[]=language" +
    "&fl[]=mediatype" +
    "&rows=10" +
    "&page=1" +
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

async function searchGallica(query: string): Promise<UnifiedResult[]> {
  const cql = `(gallica all "${query}")`;
  const url =
    "https://gallica.bnf.fr/SRU" +
    `?operation=searchRetrieve&version=1.2&query=${encodeURIComponent(cql)}` +
    "&maximumRecords=10" +
    "&startRecord=1";

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
      sourceType = "Source primaire";
    } else if (rawType.includes("manuscrit")) {
      documentType = "Manuscrit";
      sourceType = "Source primaire";
    } else if (rawType.includes("carte")) {
      documentType = "Carte";
      sourceType = "Source primaire";
    } else if (rawType.includes("image")) {
      documentType = "Image";
      sourceType = "Source primaire";
    }

    results.push({
      id: `gallica:${ark ?? i}`,
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

async function searchLibraryOfCongress(query: string): Promise<UnifiedResult[]> {
  const url =
    "https://www.loc.gov/search/" +
    `?q=${encodeURIComponent(query)}` +
    "&fo=json" +
    "&c=10" +
    "&sp=1";

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
      id: `loc:${doc.id ?? index}`,
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

async function searchNara(query: string): Promise<UnifiedResult[]> {
  const url =
    "https://catalog.archives.gov/api/v2" +
    `?q=${encodeURIComponent(query)}` +
    "&rows=10";

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const docs = data?.body?.hits?.hits ?? [];

  return docs.map((hit: any, index: number) => {
    const source = hit?._source ?? {};
    const title =
      source?.title ||
      source?.record?.title ||
      "Sans titre";

    const naId =
      source?.naId ||
      source?.record?.naId ||
      null;

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
      id: `nara:${naId ?? index}`,
      title,
      year,
      language: null,
      documentType: "Archive",
      sourceType: "Source primaire",
      officialUrl: naId
        ? `https://catalog.archives.gov/id/${naId}`
        : null,
      thumbnailUrl: thumb,
      source: "National Archives (USA)",
    };
  });
}

function buildExternalPortals(query: string): ExternalPortal[] {
  const encoded = encodeURIComponent(query);

  return [
    {
      name: "PARES (archives espagnoles)",
      url:
        "https://pares.cultura.gob.es/metapares/advancedSearchForm" +
        `?title=&authors=&publisher=&year=&language=&centro=&topics=%22${encoded}%22&pagNum=1&pagSize=10`,
      note: "Portail officiel espagnol ajouté avec lien de recherche prérempli.",
    },
    {
      name: "CIA FOIA Reading Room",
      url: "https://www.cia.gov/readingroom/home",
      note:
        "Salle de lecture FOIA officielle de la CIA avec recherche documentaire et documents déclassifiés.",
    },
    {
      name: "CIA Historical Collections",
      url: "https://www.cia.gov/readingroom/historical-collections",
      note:
        "Collections historiques officielles de la CIA : ensembles documentaires thématiques et déclassifiés.",
    },
    {
      name: "CIA Advanced Search",
      url: "https://www.cia.gov/readingroom/advanced-search-view",
      note:
        "Recherche avancée officielle de la CIA Reading Room pour explorer les documents FOIA.",
    },
    {
      name: "CIA CREST Archive",
      url: "https://www.cia.gov/readingroom/collection/crest-25-year-program-archive",
      note:
        "Archive CREST officielle de la CIA, utile pour les recherches historiques déclassifiées.",
    },
    {
      name: "HathiTrust",
      url: "https://babel.hathitrust.org/cgi/ls",
      note:
        "Portail officiel utile, mais pas de vraie API publique de recherche par mot-clé vérifiée ici.",
    },
    {
      name: "World Digital Library",
      url: "https://www.loc.gov/collections/world-digital-library/",
      note:
        "Collection historique aujourd’hui portée par la Library of Congress.",
    },
    {
      name: "Archives Portal Europe",
      url: "https://www.archivesportaleurope.net/",
      note:
        "API existante, mais elle demande compte/clé et dépend des permissions des institutions contributrices.",
    },
    {
      name: "NYPL Digital Collections",
      url: "https://digitalcollections.nypl.org/",
      note:
        "API existante mais authentification requise.",
    },
    {
      name: "Arolsen Archives",
      url: "https://collections.arolsen-archives.org/en/",
      note:
        "Recherche en ligne disponible ; aucune API publique générale vérifiée ici.",
    },
    {
      name: "Smithsonian Open Access",
      url: "https://www.si.edu/openaccess",
      note: "API disponible avec clé API.",
    },
    {
      name: "Devlet Arşivleri Başkanlığı",
      url: "https://www.devletarsivleri.gov.tr/",
      note:
        "Portail officiel trouvé, mais pas de documentation API publique générale vérifiée ici.",
    },
    {
      name: "Archives du Maroc",
      url: "https://www.archivesdumaroc.ma/",
      note:
        "Portail officiel trouvé, mais pas de documentation API publique générale vérifiée ici.",
    },
  ];
}
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

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
          searchInternetArchive(qi),
          searchGallica(qi),
          searchLibraryOfCongress(qi),
          searchNara(qi),
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
      dedupeResults(allResults)
        .map((item) => ({
          ...item,
          score: computeScore(item, q),
        }))
        .filter((item) => item.score >= 2)
    );

    return NextResponse.json({
      query: q,
      expandedQueries: queries,
      total: merged.length,
      results: merged,
      externalPortals: buildExternalPortals(q),
    });
  } catch (error) {
    console.error("Erreur API search:", error);

    return NextResponse.json(
      { error: "Impossible de contacter les archives en ligne." },
      { status: 500 }
    );
  }
}