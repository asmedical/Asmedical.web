// Tests TRAJET TEMPS RÉEL (Phase 5) — base locale UNIQUEMENT.
// Lancer :  node scripts/tests/test-trajet.mjs
import fs from "fs";
process.env.DATABASE_URL = "postgresql://asm:asm@localhost:5432/asmdb";
fs.rmSync(".test-fin", { recursive: true, force: true });
fs.mkdirSync(".test-fin");
fs.copyFileSync("lib/prisma.js", ".test-fin/prisma.js");
const adapter = (chemin) =>
  fs.readFileSync(chemin, "utf8")
    .replaceAll('from "@/lib/prisma"', 'from "./prisma.js"')
    .replaceAll('from "@/lib/telephones"', 'from "./telephones.js"')
    .replaceAll('from "@/lib/geoloc"', 'from "./geoloc.js"')
    .replaceAll('from "@/lib/creneaux"', 'from "./creneaux.js"')
    .replaceAll('from "@/lib/trajets"', 'from "./trajets.js"')
    .replaceAll('from "@/lib/disponibilites"', 'from "./disponibilites.js"')
    .replaceAll('await import("@/lib/pushEnvoi")', 'await import("./pushEnvoi.js")');
fs.writeFileSync(".test-fin/telephones.js", adapter("lib/telephones.js"));
fs.writeFileSync(".test-fin/geoloc.js", adapter("lib/geoloc.js"));
fs.writeFileSync(".test-fin/creneaux.js", adapter("lib/creneaux.js"));
fs.writeFileSync(".test-fin/trajets.js", adapter("lib/trajets.js"));
fs.writeFileSync(".test-fin/disponibilites.js", adapter("lib/disponibilites.js"));
fs.writeFileSync(".test-fin/trajetLive.js", adapter("lib/trajetLive.js"));
fs.writeFileSync(".test-fin/attente.js", adapter("lib/attente.js"));
fs.writeFileSync(".test-fin/pushEnvoi.js", "export async function envoyerPush() {}\n");

const { distanceKm, etaMinutes, positionValide, estimationTrajet } =
  await import(process.cwd() + "/.test-fin/geoloc.js");
const { enregistrerPosition, marquerRetourPret } =
  await import(process.cwd() + "/.test-fin/trajetLive.js");
const { rejoindreAttente, traiterLiberation, attentesAdmin } =
  await import(process.cwd() + "/.test-fin/attente.js");
const { prisma } = await import(process.cwd() + "/.test-fin/prisma.js");

let ok = 0, ko = 0;
const verif = (nom, cond) => (cond ? (ok++, console.log("  ✓", nom)) : (ko++, console.log("  ✗ ECHEC:", nom)));

// ---------- 1. Géolocalisation (calculs purs, sans fournisseur) ----------
verif("distance nulle entre deux points identiques", distanceKm(36.7525, 3.042, 36.7525, 3.042) === 0);
const kmAeroport = distanceKm(36.7525, 3.042, 36.691, 3.2154); // Alger centre → aéroport
verif("Alger centre → aéroport ≈ 17 km à vol d'oiseau", kmAeroport > 15 && kmAeroport < 18);
verif("ETA jamais « 0 min » (minimum 1)", etaMinutes(0) === 1);
verif("ETA 14 km ≈ 39 min (coef route 1,3 · 28 km/h)", etaMinutes(14) === 39);
verif("position hors bornes refusée", positionValide(91, 0) === false && positionValide(10, 200) === false);
verif("position (0,0) refusée (GPS non initialisé)", positionValide(0, 0) === false);
verif("position valide acceptée (chaînes numériques)", positionValide("36.75", "3.04") === true);
verif("estimation refusée si un point est invalide", estimationTrajet(36.75, 3.04, null, null) === null);
const est = estimationTrajet(36.7525, 3.042, 36.691, 3.2154);
verif("estimation complète (km arrondis + minutes)", est && est.km > 15 && est.minutes >= etaMinutes(15));

// ---------- Préparation base ----------
const TEL = "0555 66 77 88";
for (const t of ["listeAttente"]) await prisma[t].deleteMany({});
await prisma.notification.deleteMany({ where: { userId: { startsWith: "tr-att-" } } });
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-TR" } } });
await prisma.transporteur.deleteMany({ where: { nom: { contains: "TEST-TR" } } });

// ---------- 2. Position du chauffeur (garde-fous serveur) ----------
const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
let course = await prisma.demande.create({
  data: { service: "transport", nom: "Amine TEST-TR", telephone: TEL, date: `${demain}T09:00`, statut: "AFFECTEE" },
});
verif("position refusée avant « je suis en route »", (await enregistrerPosition(course, 36.75, 3.04)).erreur === "pas_en_route");
course = await prisma.demande.update({ where: { id: course.id }, data: { enRouteLe: new Date() } });
verif("position hors bornes refusée (serveur)", (await enregistrerPosition(course, 123, 3.04)).erreur === "position_invalide");
verif("position enregistrée pendant le trajet", (await enregistrerPosition(course, 36.7525, 3.042)).ok === true);
const apresPos = await prisma.demande.findUnique({ where: { id: course.id } });
verif("posLat/posLng/posLe stockés sur la demande", apresPos.posLat === 36.7525 && apresPos.posLng === 3.042 && apresPos.posLe !== null);
const soin = await prisma.demande.create({
  data: { service: "domicile", nom: "Amine TEST-TR", telephone: TEL, date: `${demain}T10:00`, statut: "EN_COURS", enRouteLe: new Date() },
});
verif("position refusée hors transport", (await enregistrerPosition(soin, 36.75, 3.04)).erreur === "hors_transport");
const close = await prisma.demande.create({
  data: { service: "transport", nom: "Amine TEST-TR", telephone: TEL, date: `${demain}T11:00`, statut: "TERMINEE", enRouteLe: new Date(), finLe: new Date() },
});
verif("position refusée sur mission close", (await enregistrerPosition(close, 36.75, 3.04)).erreur === "mission_close");

// ---------- 3. « Je suis prêt » (retour) ----------
course = await prisma.demande.update({ where: { id: course.id }, data: { statut: "EN_COURS", debutLe: new Date() } });
verif("mauvais téléphone → introuvable (pas de fuite)", (await marquerRetourPret(course.id, "0777 00 00 00")).erreur === "introuvable");
const pret = await marquerRetourPret(course.id, "+213 555 66 77 88"); // autre format, même numéro
verif("« Je suis prêt » accepté (téléphone en autre format)", pret.ok === true && pret.demande.retourPretLe !== null);
verif("second appui → idempotent (deja)", (await marquerRetourPret(course.id, TEL)).deja === true);
verif("refusé hors transport", (await marquerRetourPret(soin.id, TEL)).erreur === "hors_transport");
verif("refusé sur mission close", (await marquerRetourPret(close.id, TEL)).erreur === "mission_close");

// ---------- 4. Liste d'attente intelligente ----------
// Hermétique : un seul transporteur actif (les autres suspendus, restaurés à la fin).
const autresValides = await prisma.transporteur.findMany({ where: { statut: "VALIDE" }, select: { id: true } });
await prisma.transporteur.updateMany({ where: { id: { in: autresValides.map((x) => x.id) } }, data: { statut: "INACTIF" } });
const camion = await prisma.transporteur.create({
  data: { nom: "Fourgon TEST-TR", statut: "VALIDE", typeTransport: "medicalise", heureDebut: 7, heureFin: 19 },
});

// Client Supabase factice : seul le 0666… possède un compte.
const CLE_AVEC_COMPTE = "66112233";
const adminFactice = {
  from: () => ({
    select: () => ({
      ilike: (_c, motif) => ({
        limit: async () => ({ data: motif.includes(CLE_AVEC_COMPTE) ? [{ id: "tr-att-user1" }] : [] }),
      }),
    }),
  }),
};

const slot = `${demain}T14:00`;
verif("service invalide refusé", (await rejoindreAttente({ service: "medicaments", date: slot, telephone: "0666 11 22 33" })).erreur === "service_invalide");
verif("créneau passé refusé", (await rejoindreAttente({ service: "transport", date: "2020-01-01T10:00", telephone: "0666 11 22 33" })).erreur === "creneau_passe");
verif("téléphone trop court refusé", (await rejoindreAttente({ service: "transport", date: slot, telephone: "12 34" })).erreur === "telephone_invalide");

// Le créneau est occupé par une course affectée au SEUL fourgon actif.
const occupe = await prisma.demande.create({
  data: { service: "transport", nom: "Salima TEST-TR", telephone: "0770 99 88 77", date: slot, statut: "CONFIRMEE", transporteurId: camion.id },
});
const sansCompte = await rejoindreAttente({ service: "transport", date: slot, telephone: "0555 00 11 22" }); // pas de compte
const avecCompte = await rejoindreAttente({ service: "transport", date: slot, telephone: "0666 11 22 33" }); // compte connu
verif("deux inscriptions enregistrées", sansCompte.ok === true && avecCompte.ok === true);
verif("même client (format différent) → une seule entrée", (await rejoindreAttente({ service: "transport", date: slot, telephone: "+213 666 11 22 33" })).deja === true);

verif("créneau toujours complet → personne n'est prévenu", (await traiterLiberation("transport", slot, { admin: adminFactice })).notifies === 0);

// L'annulation libère UNE place : un seul inscrit est prévenu — et comme le
// premier n'a pas de compte, il garde sa place et le second est notifié.
await prisma.demande.update({ where: { id: occupe.id }, data: { statut: "ANNULEE" } });
const lib = await traiterLiberation("transport", slot, { admin: adminFactice });
verif("libération → exactement 1 inscrit prévenu (1 place)", lib.notifies === 1);
const e1 = await prisma.listeAttente.findFirst({ where: { telCle: "55001122" } });
const e2 = await prisma.listeAttente.findFirst({ where: { telCle: "66112233" } });
verif("l'inscrit sans compte garde sa place (EN_ATTENTE)", e1.statut === "EN_ATTENTE");
verif("l'inscrit avec compte est marqué NOTIFIE", e2.statut === "NOTIFIE" && e2.notifieLe !== null);
const notif = await prisma.notification.findFirst({ where: { userId: "tr-att-user1" } });
verif("notification interne créée (place libérée)", notif && notif.titre.includes("libérée"));

// Anti-abus : 3 attentes actives maximum par client.
await rejoindreAttente({ service: "transport", date: `${demain}T15:00`, telephone: "0555 00 11 22" });
await rejoindreAttente({ service: "transport", date: `${demain}T16:00`, telephone: "0555 00 11 22" });
verif("4e attente active refusée (anti-abus)", (await rejoindreAttente({ service: "transport", date: `${demain}T17:00`, telephone: "0555 00 11 22" })).erreur === "trop_attentes");

// Expiration paresseuse : une entrée dont le créneau est passé disparaît des vues.
await prisma.listeAttente.create({
  data: { service: "transport", date: "2026-01-05T09:00", telephone: "0561 22 33 44", telCle: "61223344" },
});
await attentesAdmin();
const vieille = await prisma.listeAttente.findFirst({ where: { telCle: "61223344" } });
verif("entrée passée expirée automatiquement", vieille.statut === "EXPIREE");

// ---------- Nettoyage ----------
await prisma.transporteur.updateMany({ where: { id: { in: autresValides.map((x) => x.id) } }, data: { statut: "VALIDE" } });
await prisma.transporteur.deleteMany({ where: { nom: { contains: "TEST-TR" } } });
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-TR" } } });
await prisma.listeAttente.deleteMany({});
await prisma.notification.deleteMany({ where: { userId: { startsWith: "tr-att-" } } });

console.log(`\nRésultat : ${ok} OK / ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
