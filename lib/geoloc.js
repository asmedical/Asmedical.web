// Géolocalisation — calculs SANS fournisseur externe (pas de clé, pas de
// fuite de données) : distance à vol d'oiseau (haversine), corrigée d'un
// coefficient de route, puis temps estimé à vitesse moyenne urbaine.
//
// Pour brancher plus tard un vrai calcul d'itinéraire (Google, Mapbox,
// OpenRouteService…), implémenter la même signature dans un module dédié
// et le sélectionner via la variable d'environnement MAPS_PROVIDER —
// l'interface publique de ce fichier ne change pas.

export const VITESSE_MOYENNE_KMH = 28; // circulation urbaine prudente
export const COEF_ROUTE = 1.3; // la route réelle ≈ 1,3 × le vol d'oiseau

export function positionValide(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180 && (la !== 0 || ln !== 0);
}

// Distance à vol d'oiseau en kilomètres (formule de haversine).
export function distanceKm(lat1, lng1, lat2, lng2) {
  const r = Math.PI / 180;
  const R = 6371; // rayon terrestre moyen (km)
  const dLat = (lat2 - lat1) * r;
  const dLng = (lng2 - lng1) * r;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Minutes estimées pour parcourir cette distance (route corrigée, vitesse
// moyenne). Toujours au moins 1 minute — on ne promet jamais « 0 min ».
export function etaMinutes(km, vitesseKmh = VITESSE_MOYENNE_KMH) {
  const d = Number(km);
  if (!Number.isFinite(d) || d < 0) return null;
  return Math.max(1, Math.round(((d * COEF_ROUTE) / vitesseKmh) * 60));
}

// Distance + ETA entre deux points, en une seule fois (null si invalide).
export function estimationTrajet(lat1, lng1, lat2, lng2) {
  if (!positionValide(lat1, lng1) || !positionValide(lat2, lng2)) return null;
  const km = distanceKm(Number(lat1), Number(lng1), Number(lat2), Number(lng2));
  return { km: Math.round(km * 10) / 10, minutes: etaMinutes(km) };
}
