// Tests de la FACTURATION AUTOMATIQUE à la clôture — base locale UNIQUEMENT.
// Lancer :  node scripts/tests/test-facturation-auto.mjs
import fs from "fs";
process.env.DATABASE_URL = "postgresql://asm:asm@localhost:5432/asmdb";
fs.rmSync(".test-fin", { recursive: true, force: true });
fs.mkdirSync(".test-fin");
fs.copyFileSync("lib/prisma.js", ".test-fin/prisma.js");
fs.writeFileSync(".test-fin/finances.js",
  fs.readFileSync("lib/finances.js", "utf8")
    .replace('from "@/lib/prisma"', 'from "./prisma.js"')
    .replace('await import("@/lib/pushEnvoi")', 'await import("./pushEnvoi.js")'));
fs.writeFileSync(".test-fin/pushEnvoi.js", "export async function envoyerPush() {}\n");

const { facturerDemande, installerTarifsDefaut, compteFinancierPour, estimerPrestation } = await import(process.cwd() + "/.test-fin/finances.js");
const { prisma } = await import(process.cwd() + "/.test-fin/prisma.js");

let ok = 0, ko = 0;
const verif = (nom, cond) => (cond ? (ok++, console.log("  ✓", nom)) : (ko++, console.log("  ✗ ECHEC:", nom)));

// Nettoyage
for (const t of ["relancePaiement", "remboursement", "ticketEspeces", "paiement", "ligneFacture", "facture", "remiseClient", "souscription", "planAbonnement", "compteFinancier", "tarif", "sequenceFinance", "notification"]) {
  await prisma[t].deleteMany({});
}
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-FA" } } });
await prisma.reglage.upsert({ where: { id: 1 }, update: { facturationAuto: true }, create: { id: 1, facturationAuto: true } });
await installerTarifsDefaut("test");

// Client avec compte financier (téléphone correspondant)
const compte = await compteFinancierPour("user-fa-1", { role: "patient", prenom: "Ali", nom: "TEST-FA", telephone: "0555 44 33 22" });

// 1. Transport aller-retour, prioritaire, le samedi → base×2 + urgence + week-end
const d1 = await prisma.demande.create({
  data: {
    service: "transport", typeTrajet: "aller_retour", nom: "Ali TEST-FA", telephone: "0555 44 33 22",
    date: "2026-07-18T09:00", // samedi
    dureeMin: 60, statut: "TERMINEE", prioritaire: true, finLe: new Date(),
  },
});
const r1 = await facturerDemande(d1);
verif("facture émise à la clôture", r1.ok && r1.facture.numero.startsWith("ASM-"));
verif("aller-retour ×2 + suppléments week-end et urgence (2×2500 + 500 + 1000 = 6500)", r1.facture.total === 6500);
verif("facture reliée à la prestation", r1.facture.demandeId === d1.id);
const notif = await prisma.notification.findFirst({ where: { userId: "user-fa-1" } });
verif("client notifié (facture disponible)", !!notif && notif.corps.includes(r1.facture.numero));

// 2. Anti-doublon : une seconde clôture ne refacture pas
const r2 = await facturerDemande(d1);
verif("double clôture → UNE seule facture (anti-doublon)", r2.deja === true);
verif("aucune facture surnuméraire", (await prisma.facture.count({ where: { demandeId: d1.id } })) === 1);

// 3. Aide à domicile 2 h en semaine → 2 × tarif horaire
const d2 = await prisma.demande.create({
  data: { service: "domicile", nom: "Ali TEST-FA", telephone: "0555 44 33 22", date: "2026-07-15T10:00", dureeMin: 120, statut: "TERMINEE", finLe: new Date() },
});
const r3 = await facturerDemande(d2);
verif("domicile 2 h = 2 × 1200 = 2400", r3.ok && r3.facture.total === 2400);

// 4. Supplément nuit (22h)
const d3 = await prisma.demande.create({
  data: { service: "medicaments", nom: "Ali TEST-FA", telephone: "0555 44 33 22", date: "2026-07-15T22:00", dureeMin: 30, statut: "TERMINEE", finLe: new Date() },
});
const r4 = await facturerDemande(d3);
verif("livraison de nuit = 600 + 800 = 1400", r4.ok && r4.facture.total === 1400);

// 5. Client sans compte identifiable → pas de facture, journalisé
const d4 = await prisma.demande.create({
  data: { service: "transport", nom: "Inconnu TEST-FA", telephone: "0000 11 22 33", date: "2026-07-15T09:00", statut: "TERMINEE", finLe: new Date() },
});
const r5 = await facturerDemande(d4);
verif("client inconnu → aucune facture (à facturer manuellement)", r5.ignoree === "sans_compte");
const jSans = await prisma.journal.findFirst({ where: { action: "finance.facture.auto.impossible", entiteId: String(d4.id) } });
verif("cas journalisé pour l'équipe", !!jSans);

// 6. Prestation non terminée → jamais facturée
const d5 = await prisma.demande.create({
  data: { service: "transport", nom: "Ali TEST-FA", telephone: "0555 44 33 22", date: "2026-07-15T09:00", statut: "EN_COURS" },
});
verif("prestation non terminée → ignorée", (await facturerDemande(d5)).ignoree === "non_terminee");

// 7. Interrupteur OFF → rien ne part
await prisma.reglage.update({ where: { id: 1 }, data: { facturationAuto: false } });
const d6 = await prisma.demande.create({
  data: { service: "transport", nom: "Ali TEST-FA", telephone: "0555 44 33 22", date: "2026-07-15T09:00", statut: "TERMINEE", finLe: new Date() },
});
verif("réglage désactivé → aucune facture automatique", (await facturerDemande(d6)).ignoree === "desactivee");
await prisma.reglage.update({ where: { id: 1 }, data: { facturationAuto: true } });

// 8. Payeur ÉTABLISSEMENT : la réservation faite par un établissement lui est facturée
const compteEtab = await compteFinancierPour("etab-fa-1", { role: "pro", etablissement: "Centre TEST-FA", telephone: "023 11 22 33" });
const d7 = await prisma.demande.create({
  data: {
    service: "transport", nom: "Patient X TEST-FA", telephone: "0555 44 33 22", date: "2026-07-15T09:00",
    statut: "TERMINEE", finLe: new Date(), parEtablissement: "Centre TEST-FA", parEtabUserId: "etab-fa-1",
  },
});
const r8 = await facturerDemande(d7);
verif("réservation d'établissement → facturée à l'ÉTABLISSEMENT (pas au patient)", r8.ok && r8.facture.compteId === compteEtab.id);
verif("mention « Réservé par » sur la facture", r8.facture.notes?.includes("Centre TEST-FA"));

// 9. PARITÉ estimation ↔ facture : mêmes paramètres, même total
const est = await estimerPrestation({ service: "transport", date: "2026-07-18T09:00", dureeMin: 60, typeTrajet: "aller_retour", prioritaire: true, compteId: compte.id });
const factD1 = await prisma.facture.findFirst({ where: { demandeId: d1.id } });
verif("estimation avant réservation = facture finale (mêmes règles)", est.total === factD1.total);

// Nettoyage
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-FA" } } });
console.log(`\nRésultat : ${ok} OK / ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
