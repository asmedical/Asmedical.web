// Temps de déplacement entre deux interventions — couche d'abstraction.
//
// V1 (honnête, sans fournisseur externe) : estimation par commune.
//  - même commune            → court
//  - communes différentes    → trajet par défaut (réglable)
//  - commune inconnue        → trajet par défaut (prudent)
//
// Pour brancher plus tard un vrai fournisseur (Google Maps, Mapbox, HERE,
// OpenRouteService…), il suffit d'implémenter la même signature dans un
// module dédié et de le sélectionner via TRAJET_PROVIDER — sans toucher
// au moteur de disponibilités.

function normaliser(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// tempsTrajetMin(communeA, communeB, reglage) → minutes estimées.
export function tempsTrajetMin(communeA, communeB, reglage) {
  const defaut = reglage?.trajetDefautMin ?? 20;
  const a = normaliser(communeA);
  const b = normaliser(communeB);
  if (!a || !b) return defaut;
  if (a === b) return Math.min(10, defaut);
  return defaut;
}

// Une commune est-elle couverte par une liste « communes couvertes » ?
// (liste séparée par des virgules ; liste vide = couvre tout)
export function zoneCouvre(communesCouvertes, commune) {
  const liste = String(communesCouvertes || "")
    .split(",")
    .map(normaliser)
    .filter(Boolean);
  if (liste.length === 0) return true;
  const c = normaliser(commune);
  if (!c) return true; // commune du patient inconnue → pas de filtre
  return liste.some((z) => c.includes(z) || z.includes(c));
}
