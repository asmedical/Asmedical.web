// Tests GOOGLE MAPS & TARIFICATION KILOMÉTRIQUE — base locale UNIQUEMENT.
// Les appels Google sont SIMULÉS (fetch factice) : aucun appel réseau réel.
// Lancer :  node scripts/tests/test-maps.mjs
import fs from "fs";
process.env.DATABASE_URL = "postgresql://asm:asm@localhost:5432/asmdb";
process.env.GOOGLE_MAPS_SERVER_API_KEY = "cle-de-test";
fs.rmSync(".test-fin", { recursive: true, force: true });
fs.mkdirSync(".test-fin");
fs.copyFileSync("lib/prisma.js", ".test-fin/prisma.js");
const adapter = (chemin) =>
  fs.readFileSync(chemin, "utf8")
    .replaceAll('from "@/lib/prisma"', 'from "./prisma.js"')
    .replaceAll('from "@/lib/telephones"', 'from "./telephones.js"')
    .replaceAll('from "@/lib/geoloc"', 'from "./geoloc.js"')
    .replaceAll('from "@/lib/finances"', 'from "./finances.js"')
    .replaceAll('await import("@/lib/offres")', 'await import("./offres.js")')
    .replaceAll('await import("@/lib/finances")', 'await import("./finances.js")')
    .replaceAll('await import("@/lib/googleMaps")', 'await import("./googleMaps.js")')
    .replaceAll('await import("@/lib/paiementReservation")', 'await import("./paiementReservation.js")')
    .replaceAll('await import("@/lib/pushEnvoi")', 'await import("./pushEnvoi.js")');
for (const f of ["telephones", "geoloc", "finances", "offres", "googleMaps", "trajetLive", "paiementReservation"]) {
  fs.writeFileSync(`.test-fin/${f}.js`, adapter(`lib/${f}.js`));
}
fs.writeFileSync(".test-fin/pushEnvoi.js", "export async function envoyerPush() {}\n");

// ---- fetch FACTICE : simule Google (Places / Geocoding / Routes) ----
globalThis.__appelsGoogle = [];
globalThis.fetch = async (url, options) => {
  globalThis.__appelsGoogle.push(String(url));
  const u = String(url);
  const json = (d) => ({ ok: true, json: async () => d });
  if (u.includes("places:autocomplete")) {
    return json({
      suggestions: [
        { placePrediction: { placeId: "lieu-chu", structuredFormat: { mainText: { text: "CHU Mustapha Pacha" }, secondaryText: { text: "Alger" } } } },
      ],
    });
  }
  if (u.includes("places.googleapis.com/v1/places/")) {
    return json({ location: { latitude: 36.759, longitude: 3.053 }, formattedAddress: "Place du 1er Mai, Alger", displayName: { text: "CHU Mustapha" } });
  }
  if (u.includes("maps/api/geocode")) {
    return json({ results: [{ geometry: { location: { lat: 36.75, lng: 3.04 } }, formatted_address: "Alger centre" }] });
  }
  if (u.includes("computeRoutes")) {
    return json({ routes: [{ distanceMeters: 12300, duration: "1140s", polyline: { encodedPolyline: "abcd" } }] });
  }
  return { ok: false, json: async () => ({}) };
};

const maps = await import(process.cwd() + "/.test-fin/googleMaps.js");
const { construireLignes, estimerPrestation, installerTarifsDefaut, completerTarifsDistance, estFerie, tarifsEnVigueur } =
  await import(process.cwd() + "/.test-fin/finances.js");
const { enregistrerPosition, modifierDestination } = await import(process.cwd() + "/.test-fin/trajetLive.js");
const { prisma } = await import(process.cwd() + "/.test-fin/prisma.js");

let ok = 0, ko = 0;
const verif = (nom, cond) => (cond ? (ok++, console.log("  ✓", nom)) : (ko++, console.log("  ✗ ECHEC:", nom)));

// ---------- 1. Couche Google (simulée) ----------
verif("coordonnées GPS acceptées comme adresse", maps.analyserCoordonnees("36.75, 3.05")?.lat === 36.75);
verif("coordonnées hors bornes refusées", maps.analyserCoordonnees("95, 200") === null);
const sug = await maps.suggererAdresses("chu mustapha", { jeton: "j1" });
verif("suggestions Places (établissement de santé)", sug?.[0]?.principal === "CHU Mustapha Pacha");
const lieu = await maps.detaillerLieu("lieu-chu", { jeton: "j1" });
verif("détail du lieu → latitude/longitude", lieu?.lat === 36.759 && lieu?.lng === 3.053);
const route1 = await maps.calculerItineraire({ deLat: 36.75, deLng: 3.04, aLat: 36.759, aLng: 3.053 });
verif("itinéraire Routes API : 12,3 km · 19 min · polyline", route1?.km === 12.3 && route1?.minutes === 19 && route1?.polyline === "abcd");
const avant = globalThis.__appelsGoogle.filter((u) => u.includes("computeRoutes")).length;
await maps.calculerItineraire({ deLat: 36.75, deLng: 3.04, aLat: 36.759, aLng: 3.053 });
verif("CACHE : le même itinéraire ne rappelle pas Google",
  globalThis.__appelsGoogle.filter((u) => u.includes("computeRoutes")).length === avant);
verif("moins de 3 caractères → aucun appel", (await maps.suggererAdresses("ab", {}))?.length === 0);

// ---------- 2. Tarification kilométrique ----------
for (const t of ["ticketPrepayeUsage", "ticketPrepaye", "codePromoUsage", "codePromo", "pack", "relancePaiement",
  "remboursement", "ticketEspeces", "paiement", "ligneFacture", "facture", "souscription", "planAbonnement",
  "remiseClient", "compteFinancier", "tarif", "sequenceFinance", "notification"]) {
  await prisma[t].deleteMany({});
}
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-GM" } } });
await prisma.reglage.upsert({
  where: { id: 1 },
  update: { facturationAuto: true, joursFeries: "01-01,07-05" },
  create: { id: 1, facturationAuto: true, joursFeries: "01-01,07-05" },
});
await installerTarifsDefaut("test");
const ajoutes = await completerTarifsDistance("test");
verif("codes kilométriques ajoutés SANS toucher aux tarifs existants", ajoutes === 6 && (await completerTarifsDistance("test")) === 0);

verif("jour férié détecté (5 juillet)", estFerie("2026-07-05T09:00", "01-01,07-05") === true && estFerie("2026-07-06T09:00", "01-01,07-05") === false);

const tarifs = await tarifsEnVigueur({ service: "transport" });
const lignesKm = construireLignes(
  { service: "transport", date: "2026-08-03T10:00", distanceKm: 12.3, details: JSON.stringify({ besoinsCles: ["b_fauteuil", "b_oxygene"] }) },
  tarifs, { joursFeries: "" }
);
const total = (l) => l.reduce((s, x) => s + x.quantite * x.prixUnitaire, 0);
verif("course au km : prise en charge (500) + 13 km × 60 + fauteuil (400) + oxygène (800)",
  total(lignesKm) === 500 + 13 * 60 + 400 + 800);
const lignesAR = construireLignes({ service: "transport", date: "2026-08-03T10:00", distanceKm: 12.3, typeTrajet: "aller_retour" }, tarifs, {});
verif("aller-retour : kilomètres doublés (25 km)", lignesAR.some((l) => l.quantite === 25));
const lignesFerie = construireLignes({ service: "transport", date: "2026-07-05T10:00", distanceKm: 5 }, tarifs, { joursFeries: "01-01,07-05" });
verif("supplément jour férié appliqué le 5 juillet", lignesFerie.some((l) => l.libelle.includes("férié")));
const lignesAcc = construireLignes({ service: "transport", date: "2026-08-03T10:00", distanceKm: 5, typeTrajet: "accompagne" }, tarifs, {});
verif("supplément accompagnement appliqué", lignesAcc.some((l) => l.libelle.includes("accompagnement")));
const lignesSans = construireLignes({ service: "transport", date: "2026-08-03T10:00" }, tarifs, {});
verif("SANS distance → course au forfait historique (aucune régression)",
  lignesSans[0].libelle.includes("Transport médical"));

const est = await estimerPrestation({ service: "transport", date: "2026-08-03T10:00", distanceKm: 12.3 });
verif("estimation avant réservation : distance → prix exact (500 + 780)", est.total === 500 + 13 * 60);

// ---------- 3. Course réelle (GPS) ----------
let course = await prisma.demande.create({
  data: {
    service: "transport", nom: "Karim TEST-GM", telephone: "0555 12 12 12", date: "2026-08-03T10:00",
    statut: "EN_COURS", enRouteLe: new Date(), departLat: 36.75, departLng: 3.04, destLat: 36.759, destLng: 3.053,
    distanceKm: 12.3, dureeRouteMin: 19, prixEstime: 1280,
  },
});
await enregistrerPosition(course, 36.75, 3.04);
course = await prisma.demande.findUnique({ where: { id: course.id } });
await enregistrerPosition(course, 36.759, 3.053); // ~1,3 km plus loin
course = await prisma.demande.findUnique({ where: { id: course.id } });
verif("distance réelle accumulée entre deux positions", course.distanceReelleKm > 0.9 && course.distanceReelleKm < 2);
await enregistrerPosition(course, 36.9, 4.0); // saut GPS ~90 km → ignoré
const apresSaut = await prisma.demande.findUnique({ where: { id: course.id } });
verif("saut GPS invraisemblable ignoré (pas de kilomètres fantômes)", apresSaut.distanceReelleKm === course.distanceReelleKm);

// ---------- 4. Modification de destination (recalcul + confirmation) ----------
const QUI = { userId: "gm-user", telephone: "+213 555 12 12 12" };
verif("intrus refusé", (await modifierDestination(course.id, { userId: "x", telephone: "0111", destination: "Ailleurs" })).erreur === "introuvable");
const apercu = await modifierDestination(course.id, { ...QUI, destination: "Clinique El Azhar, Dély Ibrahim", lat: 36.76, lng: 2.99 });
verif("aperçu : nouvel itinéraire + nouveau prix SANS écrire",
  apercu.apercu === true && apercu.itineraire?.km === 12.3 && apercu.prixEstime === 1280 &&
  (await prisma.demande.findUnique({ where: { id: course.id } })).destination !== "Clinique El Azhar, Dély Ibrahim");
const conf = await modifierDestination(course.id, { ...QUI, destination: "Clinique El Azhar, Dély Ibrahim", lat: 36.76, lng: 2.99, confirmer: true });
const apresConf = await prisma.demande.findUnique({ where: { id: course.id } });
verif("confirmation : destination + coordonnées + itinéraire + prix mis à jour, journalisé",
  conf.ok && apresConf.destination.includes("El Azhar") && apresConf.destLat === 36.76 &&
  apresConf.distanceKm === 12.3 && apresConf.prixEstime === 1280 &&
  (await prisma.journal.count({ where: { action: "demande.destination_modifiee", entiteId: String(course.id) } })) === 1);

// ---------- 5. Facturation d'une course au kilomètre ----------
const { facturerDemande, compteFinancierPour } = await import(process.cwd() + "/.test-fin/finances.js");
await compteFinancierPour("gm-user", { prenom: "Karim", nom: "TEST-GM", telephone: "0555 12 12 12" });
const finie = await prisma.demande.update({ where: { id: course.id }, data: { statut: "TERMINEE", finLe: new Date() } });
const fact = await facturerDemande(finie);
verif("facture finale = tarif kilométrique (mêmes règles que l'estimation)",
  fact.ok && fact.facture.total === 500 + 13 * 60);
verif("l'historique porte estimé ET réel",
  apresConf.prixEstime === 1280 && apresSaut.distanceReelleKm > 0);

// ---------- Nettoyage ----------
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-GM" } } });
await prisma.journal.deleteMany({ where: { action: "demande.destination_modifiee" } });

console.log(`\nRésultat : ${ok} OK / ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
