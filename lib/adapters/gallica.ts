import { ArchiveAdapter, CanonicalHistoricalQuery } from "../types";

function hasEntity(query: CanonicalHistoricalQuery, id: string): boolean {
  return [...query.persons, ...query.places, ...query.institutions, ...query.events].some(
    (e) => e.canonicalId === id
  );
}

export const gallicaAdapter: ArchiveAdapter = {
  id: "gallica",
  name: "Gallica",

  supports(query) {
    return (
      hasEntity(query, "morocco") ||
      hasEntity(query, "france") ||
      query.documentTypes.includes("book") ||
      query.documentTypes.includes("newspaper") ||
      query.documentTypes.includes("journal")
    );
  },

  buildQueries(query) {
    const variants = new Set<string>();

    if (hasEntity(query, "morocco")) {
      variants.add("maroc");
    }

    if (hasEntity(query, "morocco") && query.documentTypes.includes("newspaper")) {
      variants.add("maroc presse");
      variants.add("maroc journaux");
    }

    if (hasEntity(query, "morocco") && query.documentTypes.includes("book")) {
      variants.add("maroc histoire");
      variants.add("maroc bibliographie");
    }

    if (hasEntity(query, "pedro_iv_of_aragon") && hasEntity(query, "morocco")) {
      variants.add("pierre iv maroc");
      variants.add("lettre maroc pierre iv 1350");
    }

    if (query.dateExact) {
      variants.add(`maroc ${query.dateExact}`);
    }

    return Array.from(variants);
  },
};