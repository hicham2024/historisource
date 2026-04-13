"use client";

import Link from "next/link";
import { useState } from "react";

type SearchResult = {
  id: string;
  title: string;
  year: string | null;
  language?: string | null;
  documentType?: string;
  sourceType?: string;
  officialUrl: string | null;
  thumbnailUrl?: string | null;
  source: string;
};

type SmartLink = {
  name: string;
  url: string;
};

type SearchResponse = {
  results?: SearchResult[];
  smartLinks?: SmartLink[];
  error?: string;
  hasMore?: boolean;
  availableSources?: string[];
  availableDocumentTypes?: string[];
};

function badgeStyle(background: string, color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background,
    color,
  };
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [smartLinks, setSmartLinks] = useState<SmartLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [source, setSource] = useState("all");
  const [documentType, setDocumentType] = useState("all");
  const [primaryOnly, setPrimaryOnly] = useState(false);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  const [availableSources, setAvailableSources] = useState<string[]>(["all"]);
  const [availableDocumentTypes, setAvailableDocumentTypes] = useState<string[]>(["all"]);

  function buildSearchUrl(targetPage: number) {
    const params = new URLSearchParams({
      q: query,
      page: String(targetPage),
      source,
      documentType,
      primaryOnly: String(primaryOnly),
      yearFrom,
      yearTo,
    });

    return `/api/search?${params.toString()}`;
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResults([]);
    setSmartLinks([]);
    setPage(1);
    setHasMore(false);

    try {
      const res = await fetch(buildSearchUrl(1));
      const data: SearchResponse = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        return;
      }

      setResults(data.results || []);
      setSmartLinks(data.smartLinks || []);
      setHasMore(Boolean(data.hasMore));
      setPage(1);
      setAvailableSources(data.availableSources || ["all"]);
      setAvailableDocumentTypes(data.availableDocumentTypes || ["all"]);
    } catch {
      setError("Impossible de lancer la recherche.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);

    try {
      const res = await fetch(buildSearchUrl(nextPage));
      const data: SearchResponse = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        return;
      }

      setResults((prev) => [...prev, ...(data.results || [])]);
      setHasMore(Boolean(data.hasMore));
      setPage(nextPage);
    } catch {
      setError("Impossible de charger plus de résultats.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(168,85,247,0.22), transparent 28%), linear-gradient(135deg, #07152f 0%, #0b1733 45%, #111827 100%)",
        color: "#fff",
        padding: "40px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <section style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontSize: 60, margin: 0, fontWeight: 900 }}>
            <span
              style={{
                background: "linear-gradient(90deg, #ff3cac, #7c3aed, #38bdf8)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Histori
            </span>
            <span>Source</span>
          </h1>

          <p style={{ marginTop: 18, fontSize: 20, color: "rgba(255,255,255,0.78)" }}>
            Recherchez des documents historiques dans plusieurs archives mondiales.
          </p>
        </section>

        <section
          style={{
            maxWidth: 900,
            margin: "0 auto",
            background: "rgba(255,255,255,0.94)",
            color: "#0f172a",
            borderRadius: 22,
            padding: 24,
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          }}
        >
          <form onSubmit={handleSearch}>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Exemple : Lettre du sultan du Maroc, à Pedro IV, roi d'Aragon, datée du 25 septembre 1350."
              style={{
                width: "100%",
                minHeight: 120,
                padding: 16,
                borderRadius: 16,
                border: "1px solid #cbd5e1",
                resize: "vertical",
                fontSize: 16,
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />

            <div
              style={{
                marginTop: 16,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #cbd5e1" }}
              >
                {availableSources.map((item) => (
                  <option key={item} value={item}>
                    {item === "all" ? "Toutes les sources" : item}
                  </option>
                ))}
              </select>

              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #cbd5e1" }}
              >
                {availableDocumentTypes.map((item) => (
                  <option key={item} value={item}>
                    {item === "all" ? "Tous les types" : item}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="Année min"
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #cbd5e1" }}
              />

              <input
                type="number"
                placeholder="Année max"
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #cbd5e1" }}
              />
            </div>

            <label
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#334155",
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                checked={primaryOnly}
                onChange={(e) => setPrimaryOnly(e.target.checked)}
              />
              Sources primaires seulement
            </label>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  border: "none",
                  borderRadius: 14,
                  padding: "14px 30px",
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#fff",
                  background: "linear-gradient(90deg, #ec4899, #f43f5e)",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Recherche en cours..." : "Lancer la recherche"}
              </button>
            </div>
          </form>
        </section>

        {error && <div style={{ marginTop: 20, color: "#fecaca" }}>{error}</div>}

        {smartLinks.length > 0 && (
          <section style={{ maxWidth: 980, margin: "26px auto 0" }}>
            <h2 style={{ fontSize: 24, marginBottom: 14 }}>🔎 Accès direct aux archives</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
              }}
            >
              {smartLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    textDecoration: "none",
                    color: "#fff",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 16,
                    padding: 16,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{link.name}</div>
                  <div style={{ marginTop: 8, color: "#cbd5e1", fontSize: 13 }}>
                    Ouvrir la recherche ciblée
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        <section style={{ maxWidth: 980, margin: "30px auto 0" }}>
          <div style={{ display: "grid", gap: 18 }}>
            {results.map((item) => {
              const detailParams = new URLSearchParams({
                title: item.title,
                year: item.year || "",
                language: item.language || "",
                documentType: item.documentType || "",
                sourceType: item.sourceType || "",
                officialUrl: item.officialUrl || "",
                thumbnailUrl: item.thumbnailUrl || "",
                source: item.source,
              });

              return (
                <article
                  key={item.id}
                  style={{
                    background: "rgba(255,255,255,0.96)",
                    color: "#0f172a",
                    borderRadius: 18,
                    padding: 18,
                    boxShadow: "0 14px 32px rgba(0,0,0,0.2)",
                  }}
                >
                  <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        style={{
                          width: 110,
                          height: 150,
                          objectFit: "cover",
                          borderRadius: 12,
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 110,
                          height: 150,
                          borderRadius: 12,
                          background: "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)",
                          flexShrink: 0,
                        }}
                      />
                    )}

                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: "0 0 10px 0", fontSize: 28 }}>{item.title}</h3>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                        <span style={badgeStyle("#eef2ff", "#4338ca")}>{item.source}</span>
                        {item.documentType && (
                          <span style={badgeStyle("#fdf2f8", "#be185d")}>{item.documentType}</span>
                        )}
                        {item.sourceType && (
                          <span style={badgeStyle("#ecfeff", "#0f766e")}>{item.sourceType}</span>
                        )}
                      </div>

                      <p style={{ margin: "6px 0", color: "#334155" }}>
                        <strong>Date :</strong> {item.year || "Inconnue"}
                      </p>

                      <p style={{ margin: "6px 0", color: "#334155" }}>
                        <strong>Langue :</strong> {item.language || "Non renseignée"}
                      </p>

                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                        {item.officialUrl && (
                          <a
                            href={item.officialUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: "inline-block",
                              background: "linear-gradient(90deg, #2563eb, #3b82f6)",
                              color: "#fff",
                              padding: "10px 16px",
                              borderRadius: 12,
                              textDecoration: "none",
                              fontWeight: 800,
                            }}
                          >
                            Ouvrir la source officielle
                          </a>
                        )}

                        <Link
                          href={`/document/${encodeURIComponent(item.id)}?${detailParams.toString()}`}
                          style={{
                            display: "inline-block",
                            background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                            color: "#fff",
                            padding: "10px 16px",
                            borderRadius: 12,
                            textDecoration: "none",
                            fontWeight: 800,
                          }}
                        >
                          Voir la fiche
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {hasMore && (
            <div style={{ marginTop: 24, textAlign: "center" }}>
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{
                  border: "none",
                  borderRadius: 14,
                  padding: "14px 28px",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#fff",
                  background: "linear-gradient(90deg, #7c3aed, #2563eb)",
                  cursor: loadingMore ? "not-allowed" : "pointer",
                }}
              >
                {loadingMore ? "Chargement..." : "Charger plus de résultats"}
              </button>
            </div>
          )}

          {!loading && query.trim() !== "" && results.length === 0 && !error && (
            <div
              style={{
                marginTop: 20,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 16,
                padding: 18,
                color: "#e2e8f0",
                textAlign: "center",
              }}
            >
              Aucun résultat trouvé pour cette recherche.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}