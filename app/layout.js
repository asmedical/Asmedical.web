import "./globals.css";

export const metadata = {
  title: "ASM — Assistance Santé Médical",
  description:
    "Transport sanitaire et aide à domicile dans la wilaya d'Alger. Réservez en 1 minute, nous vous rappelons en moins de 30 minutes.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <meta name="color-scheme" content="light only" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,400;6..12,700;6..12,800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
