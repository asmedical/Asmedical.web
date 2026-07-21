// ─────────────────────────────────────────────────────────────────────────
// Google Maps Platform — couche SERVEUR unique (clé jamais côté navigateur).
// APIs récentes uniquement :
//  - Places API (New)  : suggestions d'adresses (sessions facturées au choix)
//  - Place Details New : coordonnées du lieu choisi
//  - Geocoding API     : repli texte libre + saisie de coordonnées GPS
//  - Routes API v2     : itinéraire, distance, durée, polyline (remplace
//    l'ancienne Directions API — non utilisée ici)
//
// Maîtrise des coûts :
//  - cache mémoire avec durée de vie (itinéraires 10 min, géocodage 24 h) ;
//  - FieldMask minimal sur chaque appel (facturation Google au champ) ;
//  - jetons de session Places (autocomplete + détails = 1 session) ;
//  - biais Algérie (region dz) pour des réponses courtes et pertinentes.
//
// Sans clé configurée, chaque fonction répond null : le site continue de
// fonctionner exactement comme avant (adresses libres, estimation horaire).
// ─────────────────────────────────────────────────────────────────────────

const CLE = process.env.GOOGLE_MAPS_SERVER_API_KEY || "";
export function mapsConfigure() {
  return Boolean(CLE);
}

// Cache mémoire { valeur, expire } — par instance serveur, suffisant pour
// éviter les rafales (le même itinéraire n'est jamais recalculé 2 fois
// en quelques minutes).
const cache = new Map();
function memo(cleCache, ttlMs, calcul) {
  const present = cache.get(cleCache);
  if (present && present.expire > Date.now()) return present.valeur;
  // La promesse est mise en cache immédiatement : des appels simultanés
  // pour le même itinéraire ne déclenchent qu'UN appel Google. Un échec
  // réseau vide l'entrée (pas de panne mémorisée).
  const valeur = Promise.resolve()
    .then(calcul)
    .catch(() => {
      cache.delete(cleCache);
      return null;
    });
  cache.set(cleCache, { valeur, expire: Date.now() + ttlMs });
  if (cache.size > 500) {
    for (const [k, v] of cache) if (v.expire < Date.now()) cache.delete(k);
  }
  return valeur;
}

// Saisie « 36.75, 3.05 » → coordonnées directes (acceptées comme adresse).
export function analyserCoordonnees(texte) {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(String(texte || ""));
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, adresse: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
}

// ---- Places API (New) : suggestions en temps réel ----
export async function suggererAdresses(saisie, { jeton, langue = "fr" } = {}) {
  if (!CLE) return null;
  const q = String(saisie || "").trim();
  if (q.length < 3) return [];
  const coords = analyserCoordonnees(q);
  if (coords) return [{ id: null, principal: coords.adresse, secondaire: "Coordonnées GPS", coords }];

  const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": CLE },
    body: JSON.stringify({
      input: q,
      languageCode: langue === "ar" ? "ar" : "fr",
      includedRegionCodes: ["dz"], // Algérie : rues, villes, établissements de santé…
      sessionToken: jeton || undefined,
    }),
  });
  if (!r.ok) return null;
  const d = await r.json().catch(() => ({}));
  return (d.suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .slice(0, 6)
    .map((p) => ({
      id: p.placeId,
      principal: p.structuredFormat?.mainText?.text || p.text?.text || "",
      secondaire: p.structuredFormat?.secondaryText?.text || "",
    }));
}

// ---- Détails d'un lieu choisi : latitude / longitude ----
export async function detaillerLieu(placeId, { jeton, langue = "fr" } = {}) {
  if (!CLE || !placeId) return null;
  const r = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=${langue === "ar" ? "ar" : "fr"}${jeton ? `&sessionToken=${encodeURIComponent(jeton)}` : ""}`,
    { headers: { "X-Goog-Api-Key": CLE, "X-Goog-FieldMask": "location,formattedAddress,displayName" } }
  );
  if (!r.ok) return null;
  const d = await r.json().catch(() => ({}));
  if (!d.location) return null;
  return {
    lat: d.location.latitude,
    lng: d.location.longitude,
    adresse: d.displayName?.text ? `${d.displayName.text}, ${d.formattedAddress || ""}`.replace(/, $/, "") : d.formattedAddress || "",
  };
}

// ---- Géocodage (repli texte libre) — cache 24 h ----
export async function geocoderAdresse(texte) {
  if (!CLE) return null;
  const q = String(texte || "").trim();
  if (q.length < 3) return null;
  const coords = analyserCoordonnees(q);
  if (coords) return coords;
  return memo(`geo:${q.toLowerCase()}`, 24 * 3600 * 1000, async () => {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=dz&language=fr&key=${CLE}`
    );
    if (!r.ok) return null;
    const d = await r.json().catch(() => ({}));
    const res = d.results?.[0];
    if (!res?.geometry?.location) return null;
    return { lat: res.geometry.location.lat, lng: res.geometry.location.lng, adresse: res.formatted_address || q };
  });
}

// ---- Routes API v2 : itinéraire (distance, durée, polyline) — cache 10 min ----
// `trafic` : true pour une ETA en direct (TRAFFIC_AWARE), false pour une
// estimation de réservation (TRAFFIC_UNAWARE, moins cher et stable).
export async function calculerItineraire({ deLat, deLng, aLat, aLng, trafic = false } = {}) {
  if (!CLE) return null;
  const n = (x) => Number(x);
  if (![deLat, deLng, aLat, aLng].every((x) => Number.isFinite(n(x)))) return null;
  const arrondi = (x) => n(x).toFixed(4); // ~11 m : clé de cache stable
  const cleCache = `route:${arrondi(deLat)},${arrondi(deLng)}>${arrondi(aLat)},${arrondi(aLng)}:${trafic ? "t" : "s"}`;
  return memo(cleCache, (trafic ? 2 : 10) * 60 * 1000, async () => {
    const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": CLE,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: n(deLat), longitude: n(deLng) } } },
        destination: { location: { latLng: { latitude: n(aLat), longitude: n(aLng) } } },
        travelMode: "DRIVE",
        routingPreference: trafic ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE",
        languageCode: "fr",
        units: "METRIC",
      }),
    });
    if (!r.ok) return null;
    const d = await r.json().catch(() => ({}));
    const route = d.routes?.[0];
    if (!route?.distanceMeters) return null;
    return {
      km: Math.round(route.distanceMeters / 100) / 10,
      minutes: Math.max(1, Math.round(parseInt(route.duration, 10) / 60)),
      polyline: route.polyline?.encodedPolyline || null,
    };
  });
}
