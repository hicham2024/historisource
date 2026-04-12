"use client";

import { useState } from "react";

type SearchResult = {
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

type ExternalPortal = {
  name: string;
  url: string;
  note: string;
};

type SearchResponse = {
  query?: string;
  total?: number;
  results?: SearchResult[];
  externalPortals?: ExternalPortal[];
  expandedQueries?: string[];
  error?: string;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [externalPortals, setExternalPortals] = useState<ExternalPortal[]>([]);
  const [expandedQueries, setExpandedQueries] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();

    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResults([]);
    setExternalPortals([]);
    setExpandedQueries([]);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data: SearchResponse = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        return;
      }

      setResults(data.results || []);
      setExternalPortals(data.externalPortals || []);
      setExpandedQueries(data.expandedQueries || []);
    } catch {
      setError("Impossible de lancer la recherche.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(168,85,247,0.25), transparent 30%), linear-gradient(135deg, #07152f 0%, #0a1733 40%, #081226 100%)",
        color: "#ffffff",
        padding: "40px 20px 80px",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <section
          style={{
            textAlign: "center",
            marginBottom: 40,
          }}
        >
          <h1
            style={{
              fontSize: "64px",
              lineHeight: 1,
              margin: 0,
              fontWeight: 800,
              letterSpacing: "-2px",
            }}
          >
            <span
              style={{
                background: "linear-gradient(90deg, #ff3cac, #784ba0, #2b86c5)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Histori
            </span>
            <span style={{ color: "#f8fafc" }}>Source</span>
          </h1>

          <p
            style={{
              marginTop: 18,
              fontSize: 22,
              color: "rgba(255,255,255,0.78)",
              fontWeight: 500,
            }}
          >
            Trouve directement des documents historiques dans plusieurs archives en ligne.
          </p>

          <div
            style={{
              marginTop: 18,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#f8fafc",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                background: "#ff2f92",
                color: "#fff",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              New
            </span>
            Recherche fédérée IA pour archives historiques
          </div>
        </section>

        <section
          style={{
            maxWidth: 760,
            margin: "0 auto",
            background: "#f8fafc",
            color: "#0f172a",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <form onSubmit={handleSearch}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label
                htmlFor="search"
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: 18,
                  marginBottom: 12,
                }}
              >
                Requête historique
              </label>
              <span style={{ color: "#64748b", fontSize: 13 }}>
                {query.length} caractères
              </span>
            </div>

            <textarea
              id="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Exemple : Lettre du sultan du Maroc, à Pedro IV, roi d'Aragon, datée du 25 septembre 1350.`}
              style={{
                width: "100%",
                minHeight: 130,
                padding: 16,
                borderRadius: 14,
                border: "1px solid #cbd5e1",
                resize: "vertical",
                fontSize: 16,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
                background: "#ffffff",
              }}
            />

            <div
              style={{
                marginTop: 12,
                color: "#64748b",
                fontSize: 14,
              }}
            >
              Essaie aussi :{" "}
              <button
                type="button"
                onClick={() =>
                  setQuery("Lettre du sultan du Maroc, à Pedro IV, roi d'Aragon, datée du 25 septembre 1350.")
                }
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#64748b",
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 14,
                }}
              >
                lettre du sultan du Maroc à Pedro IV
              </button>
            </div>

            <div
              style={{
                marginTop: 24,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: "linear-gradient(90deg, #ff2f92, #ff4db8)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 14,
                  padding: "14px 28px",
                  fontSize: 18,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 10px 25px rgba(255,47,146,0.35)",
                }}
              >
                {loading ? "Recherche..." : "Lancer la recherche"}
              </button>
            </div>
          </form>
        </section>

        {loading && (
          <p
            style={{
              marginTop: 24,
              textAlign: "center",
              color: "#e2e8f0",
              fontSize: 16,
            }}
          >
            Recherche en cours dans les archives...
          </p>
        )}

        {error && (
          <p
            style={{
              marginTop: 24,
              textAlign: "center",
              color: "#fda4af",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {error}
          </p>
        )}

        {!loading && !error && expandedQueries.length > 0 && (
          <section
            style={{
              marginTop: 28,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: 18,
              color: "#e2e8f0",
            }}
          >
            <strong style={{ color: "#fff" }}>Variantes de requête utilisées :</strong>
            <div
              style={{
                marginTop: 12,
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              {expandedQueries.map((item) => (
                <span
                  key={item}
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    padding: "8px 12px",
                    borderRadius: 999,
                    fontSize: 14,
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </section>
        )}

        {!loading && !error && results.length === 0 && query.trim() !== "" && (
          <p
            style={{
              marginTop: 24,
              textAlign: "center",
              color: "#e2e8f0",
            }}
          >
            Aucun résultat trouvé pour cette recherche.
          </p>
        )}

        <div
          style={{
            marginTop: 32,
            display: "grid",
            gap: 18,
          }}
        >
          {results.map((item) => (
            <article
              key={item.id}
              style={{
                background: "rgba(255,255,255,0.96)",
                color: "#0f172a",
                borderRadius: 18,
                padding: 18,
                border: "1px solid rgba(255,255,255,0.15)",
                boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 18,
                  alignItems: "flex-start",
                }}
              >
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    style={{
                      width: 110,
                      borderRadius: 10,
                      flexShrink: 0,
                      border: "1px solid #e2e8f0",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 110,
                      height: 150,
                      borderRadius: 10,
                      background: "linear-gradient(135deg, #e2e8f0, #cbd5e1)",
                      flexShrink: 0,
                    }}
                  />
                )}

                <div style={{ flex: 1 }}>
                  <h2
                    style={{
                      margin: "0 0 10px 0",
                      fontSize: 28,
                      lineHeight: 1.2,
                    }}
                  >
                    {item.title}
                  </h2>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        background: "#eef2ff",
                        color: "#4338ca",
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {item.source}
                    </span>
                    <span
                      style={{
                        background: "#fdf2f8",
                        color: "#be185d",
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {item.documentType}
                    </span>
                    <span
                      style={{
                        background: "#ecfeff",
                        color: "#0f766e",
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {item.sourceType}
                    </span>
                  </div>

                  <p style={{ margin: "6px 0" }}>
                    <strong>Date :</strong> {item.year || "Inconnue"}
                  </p>
                  <p style={{ margin: "6px 0" }}>
                    <strong>Langue :</strong> {item.language || "Non renseignée"}
                  </p>

                  {item.officialUrl ? (
                    <a
                      href={item.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-block",
                        marginTop: 12,
                        background: "linear-gradient(90deg, #1d4ed8, #3b82f6)",
                        color: "#fff",
                        padding: "10px 16px",
                        borderRadius: 12,
                        textDecoration: "none",
                        fontWeight: 700,
                      }}
                    >
                      Ouvrir la source officielle
                    </a>
                  ) : (
                    <p style={{ marginTop: 12 }}>Source officielle non disponible</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {externalPortals.length > 0 && (
          <section style={{ marginTop: 42 }}>
            <h2 style={{ color: "#fff", fontSize: 28 }}>
              Autres portails officiels à consulter
            </h2>
            <p style={{ marginTop: 8, color: "#cbd5e1" }}>
              Ces sources sont pertinentes mais ne sont pas encore intégrées automatiquement dans ce MVP.
            </p>

            <div
              style={{
                marginTop: 18,
                display: "grid",
                gap: 14,
              }}
            >
              {externalPortals.map((portal) => (
                <article
                  key={portal.name}
                  style={{
                    background: "rgba(255,255,255,0.92)",
                    color: "#0f172a",
                    borderRadius: 16,
                    padding: 16,
                    boxShadow: "0 10px 24px rgba(0,0,0,0.15)",
                  }}
                >
                  <h3 style={{ margin: "0 0 8px 0" }}>{portal.name}</h3>
                  <p style={{ margin: "0 0 10px 0", color: "#475569" }}>
                    {portal.note}
                  </p>
                  <a
                    href={portal.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "#2563eb",
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    Ouvrir le portail officiel
                  </a>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}