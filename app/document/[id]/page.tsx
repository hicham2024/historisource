import Link from "next/link";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    title?: string;
    year?: string;
    language?: string;
    documentType?: string;
    sourceType?: string;
    officialUrl?: string;
    thumbnailUrl?: string;
    source?: string;
  }>;
};

function badgeStyle(background: string, color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    background,
    color,
  };
}

export default async function DocumentDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const data = await searchParams;

  const title = data.title || "Document historique";
  const year = data.year || "Inconnue";
  const language = data.language || "Non renseignée";
  const documentType = data.documentType || "Document";
  const sourceType = data.sourceType || "Non précisé";
  const officialUrl = data.officialUrl || "";
  const thumbnailUrl = data.thumbnailUrl || "";
  const source = data.source || "Source inconnue";

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
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/search"
            style={{
              color: "#cbd5e1",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            ← Retour à la recherche
          </Link>
        </div>

        <section
          style={{
            background: "rgba(255,255,255,0.96)",
            color: "#0f172a",
            borderRadius: 22,
            padding: 24,
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 24,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={title}
                style={{
                  width: 220,
                  maxWidth: "100%",
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                }}
              />
            ) : (
              <div
                style={{
                  width: 220,
                  height: 300,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)",
                }}
              />
            )}

            <div style={{ flex: 1, minWidth: 280 }}>
              <h1
                style={{
                  margin: "0 0 14px 0",
                  fontSize: 38,
                  lineHeight: 1.15,
                }}
              >
                {title}
              </h1>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                <span style={badgeStyle("#eef2ff", "#4338ca")}>{source}</span>
                <span style={badgeStyle("#fdf2f8", "#be185d")}>{documentType}</span>
                <span style={badgeStyle("#ecfeff", "#0f766e")}>{sourceType}</span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    background: "#f8fafc",
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <strong>Date</strong>
                  <p style={{ margin: "8px 0 0 0", color: "#334155" }}>{year}</p>
                </div>

                <div
                  style={{
                    background: "#f8fafc",
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <strong>Langue</strong>
                  <p style={{ margin: "8px 0 0 0", color: "#334155" }}>{language}</p>
                </div>

                <div
                  style={{
                    background: "#f8fafc",
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <strong>Identifiant interne</strong>
                  <p style={{ margin: "8px 0 0 0", color: "#334155", wordBreak: "break-all" }}>
                    {id}
                  </p>
                </div>
              </div>

              <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
                {officialUrl && (
                  <a
                    href={officialUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-block",
                      background: "linear-gradient(90deg, #2563eb, #3b82f6)",
                      color: "#fff",
                      padding: "12px 18px",
                      borderRadius: 12,
                      textDecoration: "none",
                      fontWeight: 800,
                    }}
                  >
                    Ouvrir la source officielle
                  </a>
                )}

                <Link
                  href="/search"
                  style={{
                    display: "inline-block",
                    background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                    color: "#fff",
                    padding: "12px 18px",
                    borderRadius: 12,
                    textDecoration: "none",
                    fontWeight: 800,
                  }}
                >
                  Revenir aux résultats
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}