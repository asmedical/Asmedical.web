// Tests SYSTÈME DE PAIEMENT À LA RÉSERVATION — base locale UNIQUEMENT.
// Lancer :  node scripts/tests/test-paiement.mjs
import fs from "fs";
process.env.DATABASE_URL = "postgresql://asm:asm@localhost:5432/asmdb";
fs.rmSync(".test-fin", { recursive: true, force: true });
fs.mkdirSync(".test-fin");
fs.copyFileSync("lib/prisma.js", ".test-fin/prisma.js");
const adapter = (chemin) =>
  fs.readFileSync(chemin, "utf8")
    .replaceAll('from "@/lib/prisma"', 'from "./prisma.js"')
    .replaceAll('from "@/lib/telephones"', 'from "./telephones.js"')
    .replaceAll('from "@/lib/finances"', 'from "./finances.js"')
    .replaceAll('await import("@/lib/offres")', 'await import("./offres.js")')
    .replaceAll('await import("@/lib/paiementReservation")', 'await import("./paiementReservation.js")')
    .replaceAll('await import("@/lib/pushEnvoi")', 'await import("./pushEnvoi.js")');
fs.writeFileSync(".test-fin/telephones.js", adapter("lib/telephones.js"));
fs.writeFileSync(".test-fin/finances.js", adapter("lib/finances.js"));
fs.writeFileSync(".test-fin/offres.js", adapter("lib/offres.js"));
fs.writeFileSync(".test-fin/paiementReservation.js", adapter("lib/paiementReservation.js"));
fs.writeFileSync(".test-fin/pushEnvoi.js", "export async function envoyerPush() {}\n");

const {
  souscriptionCouvrant, contextePaiement, couvrirParAbonnement, ticketValide,
  utiliserTicket, paiementSimule, souscrirePlan, finPeriode,
} = await import(process.cwd() + "/.test-fin/paiementReservation.js");
const { facturerDemande, installerTarifsDefaut, compteFinancierPour, confirmerPaiement } =
  await import(process.cwd() + "/.test-fin/finances.js");
const { prisma } = await import(process.cwd() + "/.test-fin/prisma.js");

let ok = 0, ko = 0;
const verif = (nom, cond) => (cond ? (ok++, console.log("  ✓", nom)) : (ko++, console.log("  ✗ ECHEC:", nom)));

// ---------- Préparation ----------
for (const t of ["ticketPrepayeUsage", "ticketPrepaye", "codePromoUsage", "codePromo", "pack",
  "relancePaiement", "remboursement", "ticketEspeces", "paiement", "ligneFacture", "facture",
  "souscription", "planAbonnement", "remiseClient", "compteFinancier", "tarif", "sequenceFinance", "notification"]) {
  await prisma[t].deleteMany({});
}
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-PA" } } });
await prisma.journal.deleteMany({ where: { action: { startsWith: "paiement." } } });
await prisma.reglage.upsert({
  where: { id: 1 },
  update: { facturationAuto: true, paiementSimulation: false },
  create: { id: 1, facturationAuto: true, paiementSimulation: false },
});
await installerTarifsDefaut("test");

const TEL = "0555 77 66 55";
const QUI = { userId: "pa-user-1", telephone: "+213 555 77 66 55" }; // format différent : doit matcher
const compte = await compteFinancierPour("pa-user-1", { prenom: "Yasmine", nom: "TEST-PA", telephone: TEL });
const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const creerDemande = (extra = {}) =>
  prisma.demande.create({
    data: { service: "transport", nom: "Yasmine TEST-PA", telephone: TEL, date: `${demain}T09:00`, statut: "CONFIRMEE", ...extra },
  });

// ---------- 1. Détection du contexte ----------
const d1 = await creerDemande();
verif("mauvais téléphone → introuvable (pas de fuite)",
  (await contextePaiement(d1.id, { userId: "intrus", telephone: "0999 88 77 66" })).erreur === "introuvable");
const ctx1 = await contextePaiement(d1.id, QUI);
verif("sans abonnement ni paiement → à payer, montant estimé > 0",
  ctx1.etat === "a_payer" && ctx1.montant > 0);
verif("les plans actifs sont proposés (incitation)", Array.isArray(ctx1.plans));
verif("simulation OFF par défaut", ctx1.simulation === false);

// Prestation gratuite : pack à 0 DZD → rien à payer.
const packZero = await prisma.pack.create({ data: { nom: "Découverte TEST-PA", service: "transport", prix: 0, actif: true } });
const dGratuite = await creerDemande({ packId: packZero.id });
verif("prestation gratuite détectée", (await contextePaiement(dGratuite.id, QUI)).etat === "gratuit");

// ---------- 2. Abonnements ----------
const plan = await prisma.planAbonnement.create({
  data: { nom: "ASM Dialyse TEST-PA", prix: 15000, service: "transport", quantiteIncluse: 2, actif: true },
});
verif("sans souscription → non couvert", (await souscriptionCouvrant(compte.id, "transport")) === null);
const sous = await prisma.souscription.create({
  data: { compteId: compte.id, planId: plan.id, prix: 15000, statut: "ACTIF", debut: "2026-01-01" },
});
verif("souscription active couvre le transport", (await souscriptionCouvrant(compte.id, "transport"))?.id === sous.id);
verif("mais pas le domicile (plan limité au transport)", (await souscriptionCouvrant(compte.id, "domicile")) === null);

const ctxAbo = await contextePaiement(d1.id, QUI);
verif("écran de paiement : « Inclus dans votre abonnement »", ctxAbo.etat === "abonne" && ctxAbo.plan.nom.includes("Dialyse"));
const c1 = await couvrirParAbonnement(d1.id, QUI);
verif("couverture appliquée à la demande", c1.ok === true && (await prisma.demande.findUnique({ where: { id: d1.id } })).souscriptionId === sous.id);
verif("second appui → idempotent", (await couvrirParAbonnement(d1.id, QUI)).deja === true);

// Quota mensuel : 2 incluses → la 3e du mois n'est plus couverte.
const d2 = await creerDemande();
await couvrirParAbonnement(d2.id, QUI);
const d3 = await creerDemande();
verif("quota mensuel atteint (2/2) → 3e prestation à payer",
  (await contextePaiement(d3.id, QUI)).etat === "a_payer");

// Souscription expirée → plus de couverture (expiration paresseuse).
await prisma.souscription.update({ where: { id: sous.id }, data: { fin: "2026-01-31" } });
verif("souscription expirée → non couvert + statut EXPIRE",
  (await souscriptionCouvrant(compte.id, "transport")) === null &&
  (await prisma.souscription.findUnique({ where: { id: sous.id } })).statut === "EXPIRE");

// Facturation d'une prestation couverte : facture à ZÉRO, mention claire.
const dCouverte = await prisma.demande.update({ where: { id: d1.id }, data: { statut: "TERMINEE", finLe: new Date() } });
const fAbo = await facturerDemande(dCouverte);
verif("facture d'une prestation couverte = 0 DZD « Inclus dans l'abonnement »",
  fAbo.ok && fAbo.facture.total === 0 && (fAbo.facture.remiseDetail || "").includes("Inclus dans l'abonnement"));

// ---------- 3. Souscription publique + activation AU paiement ----------
const s2 = await souscrirePlan(plan.id, { userId: "pa-user-1", profil: { prenom: "Yasmine", telephone: TEL } });
verif("souscription en ligne : EN_ATTENTE_PAIEMENT + facture émise",
  s2.ok && s2.souscription.statut === "EN_ATTENTE_PAIEMENT" && s2.facture.total === 15000);
verif("double souscription → renvoie l'existante", (await souscrirePlan(plan.id, { userId: "pa-user-1", profil: {} })).deja === true);
const pAbo = await prisma.paiement.create({
  data: { reference: "ASM-P-TESTPA1", compteId: compte.id, factureId: s2.facture.id, moyen: "especes", fournisseur: "interne", montant: 15000 },
});
await confirmerPaiement(pAbo.id);
const sousActive = await prisma.souscription.findUnique({ where: { id: s2.souscription.id } });
verif("l'abonnement ne s'ACTIVE qu'au paiement (fin de période posée)",
  sousActive.statut === "ACTIF" && sousActive.fin === finPeriode(sousActive.debut, "mensuel"));

// ---------- 4. Tickets prépayés d'agence ----------
const ticket = await prisma.ticketPrepaye.create({
  data: { code: "AG-TESTPA", libelle: "Agence test", maxUsages: 2, services: "transport" },
});
verif("garde-fous : inactif / expiré / épuisé / mauvais service",
  ticketValide({ ...ticket, actif: false }).erreur === "ticket_invalide" &&
  ticketValide({ ...ticket, expireLe: "2020-01-01" }).erreur === "ticket_expire" &&
  ticketValide({ ...ticket, usages: 2 }).erreur === "ticket_epuise" &&
  ticketValide(ticket, "domicile").erreur === "ticket_service");
verif("code inconnu refusé + tentative journalisée (fraude)",
  (await utiliserTicket("NIMPORTE", d3.id, QUI)).erreur === "ticket_invalide" &&
  (await prisma.journal.count({ where: { action: "paiement.ticket.refus" } })) === 1);
const u1 = await utiliserTicket("ag-testpa", d3.id, QUI); // minuscules acceptées
verif("ticket accepté → paiement CONFIRMÉ enregistré (historique)",
  u1.ok && u1.paiement.moyen === "ticket" && u1.paiement.statut === "CONFIRME" && u1.paiement.refFournisseur === "AG-TESTPA");
verif("même demande → idempotent, compteur intact",
  (await utiliserTicket("AG-TESTPA", d3.id, QUI)).deja === true &&
  (await prisma.ticketPrepaye.findUnique({ where: { id: ticket.id } })).usages === 1);
verif("écran de paiement : demande désormais « déjà réglée »",
  (await contextePaiement(d3.id, QUI)).etat === "deja_regle");
const d4 = await creerDemande();
await utiliserTicket("AG-TESTPA", d4.id, QUI);
const d5 = await creerDemande();
verif("nombre maximal d'utilisations atteint → refus définitif",
  (await utiliserTicket("AG-TESTPA", d5.id, QUI)).erreur === "ticket_epuise");

// Facturation d'une demande payée par ticket → facture PAYÉE, paiement rattaché.
const d3T = await prisma.demande.update({ where: { id: d3.id }, data: { statut: "TERMINEE", finLe: new Date() } });
const fT = await facturerDemande(d3T);
verif("à la clôture : prépaiement imputé, facture PAYÉE",
  fT.ok && (await prisma.facture.findUnique({ where: { id: fT.facture.id } })).statut === "PAYEE");
verif("le paiement du ticket est rattaché à la facture",
  (await prisma.paiement.findFirst({ where: { demandeId: d3.id } })).factureId === fT.facture.id);

// ---------- 5. Simulation de paiement ----------
verif("simulation désactivée par défaut → refus",
  (await paiementSimule(d5.id, { ...QUI, moyen: "cib", resultat: "accepte" })).erreur === "simulation_desactivee");
await prisma.reglage.update({ where: { id: 1 }, data: { paiementSimulation: true } });
const simKo = await paiementSimule(d5.id, { ...QUI, moyen: "cib", resultat: "refuse" });
verif("paiement refusé enregistré (ECHOUE, étiqueté simulation)",
  simKo.ok && simKo.paiement.statut === "ECHOUE" && simKo.paiement.fournisseur === "simulation");
verif("un refus ne règle rien : la demande n'est PAS « déjà réglée »",
  (await contextePaiement(d5.id, QUI)).etat !== "deja_regle");
const simOk = await paiementSimule(d5.id, { ...QUI, moyen: "edahabia", resultat: "accepte" });
verif("paiement accepté (CONFIRMÉ, étiqueté simulation)",
  simOk.ok && simOk.paiement.statut === "CONFIRME" && simOk.paiement.fournisseur === "simulation");
verif("l'écran signale « déjà réglée » (simulation visible)",
  (await contextePaiement(d5.id, QUI)).simulation === true);

// ---------- 6. Bons cumulables ----------
await prisma.codePromo.createMany({
  data: [
    { code: "CUMUL1", type: "fixe", valeur: 300, debut: "2026-01-01", cumulable: true },
    { code: "CUMUL2", type: "fixe", valeur: 200, debut: "2026-01-01", cumulable: true },
    { code: "SOLO", type: "fixe", valeur: 500, debut: "2026-01-01", cumulable: false },
    { code: "OFFERT", type: "gratuit", valeur: 100, debut: "2026-01-01", service: "transport" },
  ],
});
const dCumul = await creerDemande({ statut: "TERMINEE", finLe: new Date(), codePromo: "CUMUL1+CUMUL2" });
const fCumul = await facturerDemande(dCumul);
verif("deux bons cumulables → remises additionnées (-500)",
  fCumul.ok && fCumul.facture.remiseTotal >= 500 && (fCumul.facture.remiseDetail || "").includes("CUMUL1"));
const dSolo = await creerDemande({ statut: "TERMINEE", finLe: new Date(), codePromo: "SOLO+CUMUL2" });
const fSolo = await facturerDemande(dSolo);
verif("bon NON cumulable présent → un seul bon appliqué (-500)",
  fSolo.ok && fSolo.facture.remiseTotal === 500 && !(fSolo.facture.remiseDetail || "").includes("CUMUL2"));
const dOffert = await creerDemande({ statut: "TERMINEE", finLe: new Date(), codePromo: "OFFERT" });
const fOffert = await facturerDemande(dOffert);
verif("bon « gratuit » (trajet offert) → facture à 0",
  fOffert.ok && fOffert.facture.total === 0);

// ---------- Nettoyage ----------
await prisma.reglage.update({ where: { id: 1 }, data: { paiementSimulation: false } });
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-PA" } } });
await prisma.journal.deleteMany({ where: { action: { startsWith: "paiement." } } });

console.log(`\nRésultat : ${ok} OK / ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
