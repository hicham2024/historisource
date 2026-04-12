export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
export const metadata = {
  title: "HistoriSource",
  description: "Recherche historique IA",
  manifest: "/manifest.json",
};