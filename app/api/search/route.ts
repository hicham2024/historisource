"use client";

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
    border: "1px solid rgba(255,255,255,0.08)",
  };
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [smartLinks, setSmartLinks] = useState<SmartLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();

    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResults([]);
    setSmartLinks([]);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data: SearchResponse = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        return;
      }

      setResults(data.results || []);
      setSmartLinks(data.smartLinks || []);
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
          "radial-gradient(circle at top, rgba(168,85,247,0.22), transparent 28%), linear-gradient(135deg, #07152f 0%, #0b1733 45%, #111827 100%)",
        color: "#fff",
        padding: "40px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <section style={{ textAlign: "center", marginBottom: 36 }}>
          <h1
            style={{
              fontSize: 60,
              margin: 0,
              fontWeight: 900,
              letterSpacing: -2,
              lineHeight: 1,
            }}
          >
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
            <span style={{ color: "#f8fafc" }}>Source</span>
          </h1>

          <p
            style={{
              marginTop: 18,
              fontSize: 20,
              color: "rgba(255,255,255,0.78)",
              maxWidth: 720,
              marginInline: "auto",
            }}
          >
            Recherchez des documents historiques dans plusieurs archives mondiales,
            avec accès direct aux sources officielles.
          </p>

          <div
            style={{
              marginTop: 18,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                background: "#ec4899",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 11,
              }}
            >
              BETA
            </span>
            Moteur historique multilingue
          </div>
        </section>

        <section
          style={{
            maxWidth: 820,
            margin: "0 auto",
            background: "rgba(255,255,255,0.94)",
            color: "#0f172a",
            borderRadius: 22,
            padding: 24,
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <form onSubmit={handleSearch}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <label
                htmlFor="historisource-search"
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                Requête historique
              </label>

              <span style={{ color: "#64748b", fontSize: 13 }}>
                {query.length} caractères
              </span>
            </div>

            <textarea
              id="historisource-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Exemple : Lettre du sultan du Maroc, à Pedro IV, roi d'Aragon, datée du 25 septembre 1350."
              style={{
                width: "100%",
                minHeight: 140,
                padding: 16,
                borderRadius: 16,
                border: "1px solid #cbd5e1",
                resize: "vertical",
                fontSize: 16,
                lineHeight: 1.5,
                fontFamily: "inherit",
                boxSizing: "border-box",
                outline: "none",
                background: "#fff",
              }}
            />

            <div style={{ marginTop: 12, color: "#64748b", fontSize: 14 }}>
              Astuce : essaie aussi{" "}
              <button
                type="button"
                onClick={() =>
                  setQuery(
                    "Lettre du sultan du Maroc, à Pedro IV, roi d'Aragon, datée du 25 septembre 1350."
                  )
                }
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  color: "#475569",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                la lettre du sultan du Maroc à Pedro IV
              </button>
            </div>

            <div
              style={{
                marginTop: 22,
                display: "flex",
                justifyContent: "center",
              }}
            >
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
                  opacity: loading ? 0.75 : 1,
                  boxShadow: "0 14px 34px rgba(236,72,153,0.35)",
                }}
              >
                {loading ? "Recherche en cours..." : "Lancer la recherche"}
              </button>
            </div>
          </form>
        </section>

        {error && (
          <div
            style={{
              maxWidth: 820,
              margin: "22px auto 0",
              padding: 14,
              borderRadius: 14,
              background: "rgba(127,29,29,0.35)",
              border: "1px solid rgba(248,113,113,0.35)",
              color: "#fecaca",
            }}
          >
            {error}
          </div>
        )}

        {smartLinks.length > 0 && (
          <section
            style={{
              maxWidth: 980,
              margin: "26px auto 0",
            }}
          >
            <h2 style={{ fontSize: 24, marginBottom: 14 }}>
              🔎 Accès direct aux archives
            </h2>

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
                    backdropFilter: "blur(8px)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
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

        <section
          style={{
            maxWidth: 980,
            margin: "30px auto 0",
          }}
        >
          {results.length > 0 && (
            <h2 style={{ fontSize: 28, marginBottom: 16 }}>
              Résultats trouvés
            </h2>
          )}

          <div
            style={{
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
                  boxShadow: "0 14px 32px rgba(0,0,0,0.2)",
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
                        height: 150,
                        objectFit: "cover",
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 110,
                        height: 150,
                        borderRadius: 12,
                        background:
                          "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)",
                        border: "1px solid #e2e8f0",
                        flexShrink: 0,
                      }}
                    />
                  )}

                  <div style={{ flex: 1 }}>
                    <h3
                      style={{
                        margin: "0 0 10px 0",
                        fontSize: 28,
                        lineHeight: 1.2,
                      }}
                    >
                      {item.title}
                    </h3>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                        marginBottom: 14,
                      }}
                    >
                      <span style={badgeStyle("#eef2ff", "#4338ca")}>
                        {item.source}
                      </span>

                      {item.documentType && (
                        <span style={badgeStyle("#fdf2f8", "#be185d")}>
                          {item.documentType}
                        </span>
                      )}

                      {item.sourceType && (
                        <span style={badgeStyle("#ecfeff", "#0f766e")}>
                          {item.sourceType}
                        </span>
                      )}
                    </div>

                    <p style={{ margin: "6px 0", color: "#334155" }}>
                      <strong>Date :</strong> {item.year || "Inconnue"}
                    </p>

                    <p style={{ margin: "6px 0", color: "#334155" }}>
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
                          background: "linear-gradient(90deg, #2563eb, #3b82f6)",
                          color: "#fff",
                          padding: "10px 16px",
                          borderRadius: 12,
                          textDecoration: "none",
                          fontWeight: 800,
                          boxShadow: "0 10px 24px rgba(37,99,235,0.25)",
                        }}
                      >
                        Ouvrir la source officielle
                      </a>
                    ) : (
                      <p style={{ marginTop: 12, color: "#475569" }}>
                        Source officielle non disponible
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

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