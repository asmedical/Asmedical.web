import "./globals.css";
import { AsmProvider } from "./providers";
import { Habillage } from "./components/chrome";
import { Assistant } from "./components/assistant";

export const metadata = {
  title: "ASM — Assistance Santé Médical",
  description:
    "Transport sanitaire, aide à domicile et livraison de médicaments dans la wilaya d'Alger. Réservez en 1 minute, nous vous rappelons en moins de 30 minutes. Toujours proches de vous / دائماً قريبون منكم.",
  keywords: [
    "transport sanitaire Alger",
    "transport dialyse Alger",
    "ambulance Alger",
    "aide à domicile Alger",
    "transport médicalisé",
  ],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0E6B3F",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" dir="ltr">
      <head>
        <meta name="color-scheme" content="light only" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700;6..12,800&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Tajawal:wght@400;500;700;800&family=Amiri:wght@700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/logo-asm.jpg" />
      </head>
      <body>
        <AsmProvider>
          <Habillage assistant={<Assistant />}>{children}</Habillage>
        </AsmProvider>
      </body>
    </html>
  );
}
