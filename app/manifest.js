// PWA : le site s'installe sur l'écran d'accueil en attendant les vraies apps
export default function manifest() {
  return {
    name: "ASM — Assistance Santé Médical",
    short_name: "ASM",
    description:
      "Transport sanitaire, aide à domicile et livraison de médicaments à Alger. Rappel en moins de 30 minutes.",
    start_url: "/",
    display: "standalone",
    background_color: "#0E6B3F",
    theme_color: "#0E6B3F",
    lang: "fr",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
