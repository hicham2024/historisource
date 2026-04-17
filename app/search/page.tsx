"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FavoriteItem, isFavorite, toggleFavorite } from "@/lib/favorites";

type SearchResult = FavoriteItem & {
  score?: number;
  exactScore?: number;
  relevanceLabel?: "exact" | "strong" | "related";
  historicalSummary?: string | null;
  badges?: {
    isPrimary: boolean;
    hasScan: boolean;
    isOfficial: boolean;
  };
  related?: Array<{
    id: string;
    title: string;
    year: string | null;
    source: string;
    officialUrl: string | null;
  }>;
};

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
    border: "1px solid rgba(15,23,42,0.06)",
  };
}

function relevanceBadge(label?: "exact" | "strong" | "related") {
  if (label === "exact") {
    return {
      text: "🟢 Correspondance exacte",
      style: badgeStyle("#dcfce7", "#166534"),
    };
  }

  if (label === "strong") {
    return {
      text: "🟡 Très pertinent",
      style: badgeStyle("#fef3c7", "#92400e"),
    };
  }

  return {
    text: "🔵 Résultat lié",
    style: badgeStyle("#dbeafe", "#1d4ed8"),
  };
}

function sourceTypeBadge(label?: string) {
  if (label === "Source primaire") {
    return badgeStyle("#ede9fe", "#6d28d9");
  }
  return badgeStyle("#f1f5f9", "#334155");
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
          "linear-gradient(180deg, #eef4ff 0%, #f8fbff 18%, #ffffff 40%, #f8fafc 100%)",
        color: "#0f172a",
      }}
    >
      <section
        style={{
          background:
            "linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(168,85,247,0.10) 35%, rgba(236,72,153,0.08) 100%)",
          borderBottom: "1px solid rgba(15,23,42,0.08)",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "28px 20px 22px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <Link
                href="/"
                style={{
                  textDecoration: "none",
                  fontSize: 34,
                  fontWeight: 900,
                  letterSpacing: -0.8,
                }}
              >
                <span
                  style={{
                    background: "linear-gradient(90deg, #2563eb, #7c3aed, #ec4899)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  HistoriSource
                </span>
              </Link>
              <div style={{ marginTop: 6, color: "#475569", fontSize: 15 }}>
                Sources historiques fiables • accès direct aux documents • recherche FR / AR
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href="/favorites"
                style={{
                  textDecoration: "none",
                  padding: "10px 14px",
                  borderRadius: 999,
                  background: "#fff",
                  border: "1px solid rgba(15,23,42,0.08)",
                  color: "#0f172a",
                  fontWeight: 700,
                  boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
                }}
              >
                ⭐ Mes favoris
              </Link>
            </div>
          </div>

          <form onSubmit={handleSearch} style={{ marginTop: 20 }}>
            <div
              style={{
                background: "#fff",
                borderRadius: 24,
                border: "1px solid rgba(15,23,42,0.08)",
                boxShadow: "0 18px 50px rgba(37,99,235,0.08)",
                padding: 16,
              }}
            >
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: 92,
                  resize: "vertical",
                  border: "none",
                  outline: "none",
                  fontSize: 18,
                  lineHeight: 1.5,
                  color: "#0f172a",
                  background: "transparent",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: 10,
                  marginTop: 12,
                }}
              >
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  style={{
                    padding: "11px 12px",
                    borderRadius: 12,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                  }}
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
                  style={{
                    padding: "11px 12px",
                    borderRadius: 12,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                  }}
                >
                  {availableDocumentTypes.map((item) => (
                    <option key={item} value={item}>
                      {item === "all" ? "Tous les types" : item}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  value={yearFrom}
                  onChange={(e) => setYearFrom(e.target.value)}
                  placeholder="Année min"
                  style={{
                    padding: "11px 12px",
                    borderRadius: 12,
                    border: "1px solid #cbd5e1",
                  }}
                />

                <input
                  type="number"
                  value={yearTo}
                  onChange={(e) => setYearTo(e.target.value)}
                  placeholder="Année max"
                  style={{
                    padding: "11px 12px",
                    borderRadius: 12,
                    border: "1px solid #cbd5e1",
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <label
                  style={{
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

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    padding: "12px 22px",
                    background: "linear-gradient(90deg, #2563eb, #7c3aed)",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: "0 12px 30px rgba(37,99,235,0.22)",
                  }}
                >
                  {loading ? "Recherche..." : "Rechercher"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "24px 20px 60px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 300px",
          gap: 24,
        }}
      >
        <section>
          {analysis && (
            <div
              style={{
                background: "#fff",
                borderRadius: 20,
                border: "1px solid rgba(15,23,42,0.08)",
                padding: 18,
                boxShadow: "0 12px 32px rgba(15,23,42,0.04)",
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
                🧠 Analyse IA
              </div>

              <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
                {analysis.summary}
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  marginTop: 14,
                }}
              >
                <span style={badgeStyle("#eff6ff", "#1d4ed8")}>
                  Intent : {analysis.intent}
                </span>
                <span style={badgeStyle("#f5f3ff", "#6d28d9")}>
                  Confiance : {Math.round(analysis.confidence * 100)}%
                </span>
                <span style={badgeStyle("#fdf2f8", "#be185d")}>
                  Document exact : {analysis.exactDocumentMode ? "Oui" : "Non"}
                </span>
              </div>

              {analysis.entities.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                    Entités détectées
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {analysis.entities.map((item) => (
                      <span key={item} style={badgeStyle("#ecfeff", "#155e75")}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {expandedQueries.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                    Requêtes générées
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {expandedQueries.map((item) => (
                      <span key={item} style={badgeStyle("#f8fafc", "#334155")}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: 18,
                background: "#fff7ed",
                color: "#9a3412",
                border: "1px solid #fdba74",
                borderRadius: 16,
                padding: 14,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              border: "1px solid rgba(15,23,42,0.08)",
              padding: "8px 18px",
              boxShadow: "0 12px 32px rgba(15,23,42,0.04)",
            }}
          >
            {results.length > 0 && (
              <div
                style={{
                  padding: "14px 0 6px",
                  color: "#475569",
                  fontSize: 15,
                }}
              >
                {results.length} résultat{results.length > 1 ? "s" : ""} affiché
                {results.length > 1 ? "s" : ""}
              </div>
            )}

            {results.map((item, index) => {
              const favorite = favoriteIds.includes(item.id);
              const relevance = relevanceBadge(item.relevanceLabel);
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
                  key={`${item.id}-${index}`}
                  style={{
                    padding: "18px 0",
                    borderBottom:
                      index === results.length - 1
                        ? "none"
                        : "1px solid rgba(15,23,42,0.08)",
                  }}
                >
                  <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        style={{
                          width: 90,
                          height: 120,
                          objectFit: "cover",
                          borderRadius: 12,
                          flexShrink: 0,
                          border: "1px solid rgba(15,23,42,0.08)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 90,
                          height: 120,
                          borderRadius: 12,
                          flexShrink: 0,
                          background:
                            "linear-gradient(135deg, rgba(37,99,235,0.10), rgba(168,85,247,0.10))",
                          border: "1px solid rgba(15,23,42,0.06)",
                        }}
                      />
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          marginBottom: 10,
                        }}
                      >
                        <span style={relevance.style}>{relevance.text}</span>
                        <span style={badgeStyle("#eef2ff", "#4338ca")}>{item.source}</span>

                        {item.documentType && (
                          <span style={badgeStyle("#fdf2f8", "#be185d")}>
                            {item.documentType}
                          </span>
                        )}

                        {item.sourceType && (
                          <span style={sourceTypeBadge(item.sourceType)}>
                            {item.sourceType}
                          </span>
                        )}

                        {item.badges?.isOfficial && (
                          <span style={badgeStyle("#ecfeff", "#155e75")}>
                            🏛 Source fiable
                          </span>
                        )}

                        {item.badges?.hasScan && (
                          <span style={badgeStyle("#f0fdf4", "#166534")}>
                            📄 Scan disponible
                          </span>
                        )}
                      </div>

                      <h2
                        style={{
                          margin: "0 0 8px 0",
                          fontSize: 24,
                          lineHeight: 1.35,
                          fontWeight: 700,
                        }}
                      >
                        {item.officialUrl ? (
                          <a
                            href={item.officialUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: "#1d4ed8",
                              textDecoration: "none",
                            }}
                          >
                            {item.title}
                          </a>
                        ) : (
                          item.title
                        )}
                      </h2>

                      <div
                        style={{
                          color: "#475569",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 14,
                          fontSize: 14,
                          marginBottom: 10,
                        }}
                      >
                        <span>
                          <strong>Date :</strong> {item.year || "Inconnue"}
                        </span>
                        <span>
                          <strong>Langue :</strong> {item.language || "Non renseignée"}
                        </span>
                      </div>

                      {item.historicalSummary && (
                        <p
                          style={{
                            margin: "0 0 12px 0",
                            color: "#334155",
                            lineHeight: 1.65,
                          }}
                        >
                          {item.historicalSummary}
                        </p>
                      )}

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {item.officialUrl && (
                          <a
                            href={item.officialUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              textDecoration: "none",
                              padding: "10px 14px",
                              borderRadius: 999,
                              background: "linear-gradient(90deg, #2563eb, #3b82f6)",
                              color: "#fff",
                              fontWeight: 700,
                            }}
                          >
                            Ouvrir le document
                          </a>
                        )}

                        <Link
                          href={`/document/${encodeURIComponent(item.id)}?${detailParams.toString()}`}
                          style={{
                            textDecoration: "none",
                            padding: "10px 14px",
                            borderRadius: 999,
                            background: "#f8fafc",
                            color: "#0f172a",
                            fontWeight: 700,
                            border: "1px solid rgba(15,23,42,0.08)",
                          }}
                        >
                          Voir la fiche
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(item)}
                          style={{
                            border: "1px solid rgba(15,23,42,0.08)",
                            background: favorite ? "#fff7ed" : "#ffffff",
                            color: favorite ? "#c2410c" : "#0f172a",
                            padding: "10px 14px",
                            borderRadius: 999,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {favorite ? "★ Favori" : "☆ Ajouter aux favoris"}
                        </button>
                      </div>

                      {item.related && item.related.length > 0 && (
                        <div
                          style={{
                            marginTop: 14,
                            padding: 12,
                            borderRadius: 14,
                            background: "linear-gradient(135deg, #faf5ff, #eff6ff)",
                            border: "1px solid rgba(15,23,42,0.06)",
                          }}
                        >
                          <div style={{ fontWeight: 800, marginBottom: 8 }}>
                            📚 Travaux liés
                          </div>

                          <div style={{ display: "grid", gap: 8 }}>
                            {item.related.map((related) => (
                              <div
                                key={related.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 10,
                                  flexWrap: "wrap",
                                }}
                              >
                                <div style={{ color: "#334155" }}>
                                  <strong>{related.title}</strong>
                                  <span style={{ color: "#64748b" }}>
                                    {" "}
                                    — {related.source}
                                    {related.year ? `, ${related.year}` : ""}
                                  </span>
                                </div>

                                {related.officialUrl && (
                                  <a
                                    href={related.officialUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      color: "#2563eb",
                                      textDecoration: "none",
                                      fontWeight: 700,
                                    }}
                                  >
                                    Ouvrir
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            {!loading && prompt.trim() !== "" && results.length === 0 && !error && (
              <div
                style={{
                  padding: "24px 0",
                  color: "#475569",
                }}
              >
                Aucun résultat trouvé.
              </div>
            )}

            {hasMore && (
              <div style={{ padding: "20px 0 10px" }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    padding: "12px 18px",
                    background: "linear-gradient(90deg, #7c3aed, #2563eb)",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: loadingMore ? "not-allowed" : "pointer",
                  }}
                >
                  {loadingMore ? "Chargement..." : "Charger plus"}
                </button>
              </div>
            )}
          </div>
        </section>

        <aside>
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              border: "1px solid rgba(15,23,42,0.08)",
              padding: 18,
              boxShadow: "0 12px 32px rgba(15,23,42,0.04)",
              position: "sticky",
              top: 18,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>
              🔎 Accès direct aux archives
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {smartLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    textDecoration: "none",
                    background: "linear-gradient(135deg, #f8fafc, #eef2ff)",
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 14,
                    padding: 14,
                    color: "#0f172a",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{link.name}</div>
                  <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
                    Ouvrir la recherche ciblée
                  </div>
                </a>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}