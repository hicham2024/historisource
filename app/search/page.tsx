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
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #0f172a, #1e293b, #312e81)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(12px)",
          borderRadius: 16,
          padding: 30,
          width: "100%",
          maxWidth: 700,
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
        }}
      >
        <h1 style={{ fontSize: 32, marginBottom: 10 }}>
          HistoriSource 🔎
        </h1>

        <p style={{ opacity: 0.7, marginBottom: 20 }}>
          Recherchez des archives historiques mondiales
        </p>

        <form onSubmit={handleSearch}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: traité de Tafna, Maroc 1912..."
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              border: "none",
              marginBottom: 10,
              boxSizing: "border-box",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              border: "none",
              background: "#ec4899",
              color: "white",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Recherche..." : "Rechercher"}
          </button>
        </form>

        {error && (
          <p style={{ marginTop: 20, color: "#fca5a5" }}>
            {error}
          </p>
        )}

        {smartLinks.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ marginBottom: 10 }}>🔎 Accès direct aux archives</h3>

            {smartLinks.map((link, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#facc15" }}
                >
                  {link.name}
                </a>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          {results.map((item) => (
            <div
              key={item.id}
              style={{
                background: "rgba(255,255,255,0.08)",
                padding: 15,
                borderRadius: 10,
                marginBottom: 10,
              }}
            >
              <h3 style={{ marginTop: 0 }}>{item.title}</h3>

              <p style={{ fontSize: 13, opacity: 0.85 }}>
                {item.source}
                {item.year ? ` • ${item.year}` : ""}
              </p>

              {item.officialUrl && (
                <a
                  href={item.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#38bdf8" }}
                >
                  Voir le document
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}