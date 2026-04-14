import { ArchiveAdapter, CanonicalHistoricalQuery } from "../types";

function hasEntity(query: CanonicalHistoricalQuery, id: string): boolean {
  return [...query.persons, ...query.places, ...query.institutions, ...query.events].some(
    (e) => e.canonicalId === id
  );
}

export const paresAdapter: ArchiveAdapter = {
  id: "pares",
  name: "PARES",

  supports(query) {
    return (
      hasEntity(query, "aragon") ||
      hasEntity(query, "pedro_iv_of_aragon") ||
      query.originalPrompt.toLowerCase().includes("espagne") ||
      query.originalPrompt.toLowerCase().includes("spain")
    );
  },

  buildQueries(query) {
    const variants = new Set<string>();

    if (hasEntity(query, "pedro_iv_of_aragon") && hasEntity(query, "morocco")) {
      variants.add("Pedro IV Marruecos");
      variants.add("Pedro IV Marruecos 1350");
      variants.add("carta sultan Marruecos Pedro IV");
      variants.add("rey de Aragon Marruecos");
    }

    if (query.dateExact) {
      variants.add(`Pedro IV Marruecos ${query.dateExact}`);
    }

    if (query.documentTypes.includes("letter")) {
      variants.add("carta Pedro IV Marruecos");
    }

    variants.add("Marruecos Aragon");
    return Array.from(variants);
  },
};