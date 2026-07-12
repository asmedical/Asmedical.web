// Application installable (PWA) : icône ASM sur l'écran d'accueil,
// plein écran, raccourcis, notifications push. Fonctionne sur iPhone
// (Safari → Partager → Sur l'écran d'accueil) et Android (Installer).
export default function manifest() {
  return {
    id: "asm-sante",
    name: "ASM — Assistance Santé Médical",
    short_name: "ASM",
    description:
      "Transport sanitaire, aide à domicile et livraison de médicaments à Alger. Réservation en ligne et suivi en direct.",
    start_url: "/accueil?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#0E6B3F",
    lang: "fr",
    categories: ["health", "medical", "lifestyle"],
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icone-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icone-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Réserver", url: "/accueil?source=app", icons: [{ src: "/icone-192.png", sizes: "192x192" }] },
      { name: "Suivi de ma demande", url: "/suivi?source=app", icons: [{ src: "/icone-192.png", sizes: "192x192" }] },
      { name: "Messagerie", url: "/messagerie?source=app", icons: [{ src: "/icone-192.png", sizes: "192x192" }] },
    ],
  };
}
