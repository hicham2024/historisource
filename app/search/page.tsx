"use client";

import { useState } from "react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: any) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    setResults(data.results || []);
    setLoading(false);
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
            }}
          />

          <button
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              border: "none",
              background: "#ec4899",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Rechercher
          </button>
        </form>

        {loading && <p style={{ marginTop: 20 }}>Recherche...</p>}

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
              <h3>{item.title}</h3>
              <p style={{ fontSize: 13, opacity: 0.7 }}>
                {item.source} • {item.year}
              </p>

              {item.officialUrl && (
                <a
                  href={item.officialUrl}
                  target="_blank"
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