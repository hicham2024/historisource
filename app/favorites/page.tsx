"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FavoriteItem, getFavorites, removeFavorite } from "@/lib/favorites";

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

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  function handleRemove(id: string) {
    removeFavorite(id);
    setFavorites(getFavorites());
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(245,158,11,0.18), transparent 28%), linear-gradient(135deg, #07152f 0%, #0b1733 45%, #111827 100%)",
        color: "#fff",
        padding: "40px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <Link
            href="/search"
            style={{ color: "#cbd5e1", textDecoration: "none", fontWeight: 700 }}
          >
            ← Retour à la recherche
          </Link>
        </div>

        <h1 style={{ fontSize: 48, margin: 0, fontWeight: 900 }}>Mes favoris</h1>
        <p style={{ marginTop: 12, color: "#cbd5e1", fontSize: 18 }}>
          Ta bibliothèque personnelle de documents historiques sauvegardés.
        </p>

        <div style={{ marginTop: 28, display: "grid", gap: 18 }}>
          {favorites.map((item) => {
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
                    <h2 style={{ margin: "0 0 10px 0", fontSize: 28 }}>{item.title}</h2>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                      <span style={badgeStyle("#eef2ff", "#4338ca")}>{item.source}</span>
                      {item.documentType && (
                        <span style={badgeStyle("#fdf2f8", "#be185d")}>{item.documentType}</span>
                      )}
                      {item.sourceType && (
                        <span style={badgeStyle("#ecfeff", "#0f766e")}>{item.sourceType}</span>
                      )}
                      {item.relevanceLabel && (
                        <span
                          style={
                            item.relevanceLabel === "Très pertinent"
                              ? badgeStyle("#dcfce7", "#166534")
                              : item.relevanceLabel === "Pertinent"
                              ? badgeStyle("#fef3c7", "#92400e")
                              : badgeStyle("#e2e8f0", "#334155")
                          }
                        >
                          {item.relevanceLabel}
                        </span>
                      )}
                    </div>

                    <p style={{ margin: "6px 0", color: "#334155" }}>
                      <strong>Date :</strong> {item.year || "Inconnue"}
                    </p>

                    <p style={{ margin: "6px 0", color: "#334155" }}>
                      <strong>Langue :</strong> {item.language || "Non renseignée"}
                    </p>

                    {item.historicalSummary && (
                      <p
                        style={{
                          marginTop: 10,
                          color: "#475569",
                          background: "#f8fafc",
                          padding: 12,
                          borderRadius: 12,
                        }}
                      >
                        {item.historicalSummary}
                      </p>
                    )}

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
                        onClick={() => handleRemove(item.id)}
                        style={{
                          border: "none",
                          background: "linear-gradient(90deg, #f59e0b, #f97316)",
                          color: "#fff",
                          padding: "10px 16px",
                          borderRadius: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {favorites.length === 0 && (
          <div
            style={{
              marginTop: 28,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: 18,
              color: "#e2e8f0",
              textAlign: "center",
            }}
          >
            Aucun favori enregistré pour le moment.
          </div>
        )}
      </div>
    </main>
  );
}