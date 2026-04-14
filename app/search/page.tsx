"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FavoriteItem, isFavorite, toggleFavorite } from "@/lib/favorites";

type SearchResult = FavoriteItem;

type SmartLink = {
  name: string;
  url: string;
};

type PromptAnalysis = {
  isHistorical: boolean;
  confidence: number;
  intent: string;
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

type SearchResponse = {
  results?: SearchResult[];
  smartLinks?: SmartLink[];
  error?: string;
  hasMore?: boolean;
  availableSources?: string[];
  availableDocumentTypes?: string[];
  analysis?: PromptAnalysis;
  expandedQueries?: string[];
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
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [smartLinks, setSmartLinks] = useState<SmartLink[]>([]);
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null);
  const [expandedQueries, setExpandedQueries] = useState<string[]>([]);
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
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ids = results.filter((item) => isFavorite(item.id)).map((item) => item.id);
    setFavoriteIds(ids);
  }, [results]);

  function refreshFavoriteIds(currentResults: SearchResult[]) {
    const ids = currentResults.filter((item) => isFavorite(item.id)).map((item) => item.id);
    setFavoriteIds(ids);
  }

  function handleToggleFavorite(item: FavoriteItem) {
    toggleFavorite(item);
    refreshFavoriteIds(results);
  }

  function buildSearchUrl(targetPage: number) {
    const params = new URLSearchParams({
      q: prompt,
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
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");
    setResults([]);
    setSmartLinks([]);
    setAnalysis(null);
    setExpandedQueries([]);
    setPage(1);
    setHasMore(false);

    try {
      const res = await fetch(buildSearchUrl(1));
      const data: SearchResponse = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        return;
      }

      const newResults = data.results || [];

      setResults(newResults);
      setSmartLinks(data.smartLinks || []);
      setAnalysis(data.analysis || null);
      setExpandedQueries(data.expandedQueries || []);
      setHasMore(Boolean(data.hasMore));
      setPage(1);
      setAvailableSources(data.availableSources || ["all"]);
      setAvailableDocumentTypes(data.availableDocumentTypes || ["all"]);
      refreshFavoriteIds(newResults);
      setError(data.error || "");
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

      const mergedResults = [...results, ...(data.results || [])];
      setResults(mergedResults);
      setHasMore(Boolean(data.hasMore));
      setPage(nextPage);
      refreshFavoriteIds(mergedResults);
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
            Décris en langage naturel ce que tu recherches en histoire.
          </p>

          <div style={{ marginTop: 16 }}>
            <Link
              href="/favorites"
              style={{
                display: "inline-block",
                background: "linear-gradient(90deg, #f59e0b, #f97316)",
                color: "#fff",
                padding: "10px 18px",
                borderRadius: 12,
                textDecoration: "none",
                fontWeight: 800,
              }}
            >
              Voir mes favoris
            </Link>
          </div>
        </section>

        <section
          style={{
            maxWidth: 950,
            margin: "0 auto",
            background: "rgba(255,255,255,0.94)",
            color: "#0f172a",
            borderRadius: 22,
            padding: 24,
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          }}
        >
          <form onSubmit={handleSearch}>
            <label style={{ display: "block", fontWeight: 800, marginBottom: 10 }}>
              Prompt historique
            </label>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Exemple : Je cherche une lettre diplomatique entre le Maroc et l’Aragon vers 1350, de préférence une source primaire conservée dans les archives espagnoles."
              style={{
                width: "100%",
                minHeight: 140,
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
                {loading ? "Analyse et recherche..." : "Lancer la recherche IA"}
              </button>
            </div>
          </form>
        </section>

        {analysis && (
          <section
            style={{
              maxWidth: 980,
              margin: "24px auto 0",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 18,
              padding: 18,
            }}
          >
            <h2 style={{ marginTop: 0 }}>🧠 Ce que l’IA a compris</h2>
            <p style={{ color: "#e2e8f0" }}>{analysis.summary}</p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
              <span style={badgeStyle("#1e293b", "#fff")}>Intent : {analysis.intent}</span>
              <span style={badgeStyle("#1e293b", "#fff")}>
                Historique : {analysis.isHistorical ? "Oui" : "Non"}
              </span>
              <span style={badgeStyle("#1e293b", "#fff")}>
                Confiance : {Math.round(analysis.confidence * 100)}%
              </span>
              <span style={badgeStyle("#1e293b", "#fff")}>
                Document exact : {analysis.exactDocumentMode ? "Oui" : "Non"}
              </span>
            </div>

            {analysis.entities.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <strong>Entités détectées :</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {analysis.entities.map((item) => (
                    <span key={item} style={badgeStyle("#312e81", "#fff")}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {analysis.documentTypes.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <strong>Types documentaires :</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {analysis.documentTypes.map((item) => (
                    <span key={item} style={badgeStyle("#7e22ce", "#fff")}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {analysis.preferredSources.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <strong>Sources prioritaires :</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {analysis.preferredSources.map((item) => (
                    <span key={item} style={badgeStyle("#0f766e", "#fff")}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {error && <div style={{ marginTop: 20, color: "#fecaca" }}>{error}</div>}

        {expandedQueries.length > 0 && (
          <section style={{ maxWidth: 980, margin: "20px auto 0" }}>
            <h2 style={{ fontSize: 22, marginBottom: 12 }}>Requêtes générées</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {expandedQueries.map((item) => (
                <span key={item} style={badgeStyle("rgba(255,255,255,0.08)", "#fff")}>
                  {item}
                </span>
              ))}
            </div>
          </section>
        )}

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

              const favorite = favoriteIds.includes(item.id);

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

                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(item)}
                          style={{
                            border: "none",
                            background: favorite
                              ? "linear-gradient(90deg, #f59e0b, #f97316)"
                              : "linear-gradient(90deg, #475569, #334155)",
                            color: "#fff",
                            padding: "10px 16px",
                            borderRadius: 12,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          {favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                        </button>
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

          {!loading && prompt.trim() !== "" && results.length === 0 && !error && (
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
              Aucun résultat trouvé pour cette demande.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}