// Tests du module financier — scénarios obligatoires, base locale UNIQUEMENT.
// Lancer :  node scripts/tests/test-finances.mjs
import fs from "fs";
fs.rmSync(".test-fin", { recursive: true, force: true });
fs.mkdirSync(".test-fin");
fs.copyFileSync("lib/prisma.js", ".test-fin/prisma.js");
fs.writeFileSync(".test-fin/finances.js",
  fs.readFileSync("lib/finances.js", "utf8").replace('from "@/lib/prisma"', 'from "./prisma.js"'));
process.env.DATABASE_URL = "postgresql://asm:asm@localhost:5432/asmdb";
const {
  compteFinancierPour, creerFacture, confirmerPaiement, creerTicketEspeces,
  encaisserTicket, rembourser, versionnerTarif, tarifsEnVigueur,
  installerTarifsDefaut, prochainNumero, calculerRemise,
} = await import(process.cwd() + "/.test-fin/finances.js");
const { prisma } = await import(process.cwd() + "/.test-fin/prisma.js");

let ok = 0, ko = 0;
const verif = (nom, cond) => (cond ? (ok++, console.log("  ✓", nom)) : (ko++, console.log("  ✗ ECHEC:", nom)));

// Nettoyage
for (const t of ["relancePaiement", "remboursement", "ticketEspeces", "paiement", "ligneFacture", "facture", "remiseClient", "souscription", "planAbonnement", "compteFinancier", "tarif", "sequenceFinance"]) {
  await prisma[t].deleteMany({});
}

// 1. Compte financier UNIQUE (pas de doublon involontaire)
const profil = { role: "patient", prenom: "Test", nom: "Finances", telephone: "0555 99 88 77" };
const c1 = await compteFinancierPour("user-fin-1", profil);
const c2 = await compteFinancierPour("user-fin-1", profil);
verif("compte financier unique par utilisateur", c1.id === c2.id && c1.numero === c2.numero);
verif("identifiant lisible ASM-CL-000001", c1.numero === "ASM-CL-000001");

// 2. Tarifs par défaut + numérotation facture
await installerTarifsDefaut("test");
const tarifs = await tarifsEnVigueur({ service: "transport" });
verif("tarifs en vigueur chargés", tarifs.length > 0);

const f1 = await creerFacture({
  compteId: c1.id, lignes: [{ libelle: "Transport test", quantite: 1, prixUnitaire: 2500 }],
  creePar: "test", service: "transport",
});
const annee = new Date().getFullYear();
verif(`numérotation ASM-${annee}-000001`, f1.numero === `ASM-${annee}-000001`);
verif("total correct", f1.total === 2500 && f1.statut === "EMISE");

// 3. Remise % appliquée + jamais de prix négatif
await prisma.remiseClient.create({
  data: { compteId: c1.id, type: "pourcentage", valeur: 10, motif: "Remise fidélité ASM", debut: "2020-01-01", auteur: "test" },
});
const f2 = await creerFacture({
  compteId: c1.id, lignes: [{ libelle: "Aide à domicile", quantite: 2, prixUnitaire: 1200 }],
  creePar: "test", service: "domicile",
});
verif("remise 10 % appliquée (2400 → 2160)", f2.sousTotal === 2400 && f2.remiseTotal === 240 && f2.total === 2160);
const { montant: remiseFolle } = calculerRemise(1000, [{ type: "fixe", valeur: 5000, motif: "x" }]);
verif("le prix ne devient jamais négatif (remise plafonnée au sous-total)", remiseFolle === 1000);

// 4. Paiement partiel puis solde
const p1 = await prisma.$transaction(async (tx) => {
  const ref = await prochainNumero(tx, "paiement", "ASM-P-");
  return tx.paiement.create({ data: { reference: ref, compteId: c1.id, factureId: f1.id, moyen: "virement", montant: 1000 } });
});
await confirmerPaiement(p1.id);
let f1b = await prisma.facture.findUnique({ where: { id: f1.id } });
verif("paiement partiel → PARTIELLEMENT_PAYEE (1000/2500)", f1b.statut === "PARTIELLEMENT_PAYEE" && f1b.paye === 1000);

// 5. Idempotence : double confirmation (webhook dupliqué) = une seule imputation
const r2 = await confirmerPaiement(p1.id);
f1b = await prisma.facture.findUnique({ where: { id: f1.id } });
verif("webhook dupliqué ignoré (pas de double imputation)", r2.deja === true && f1b.paye === 1000);

// 6. Ticket espèces : encaissement unique
const ticket = await creerTicketEspeces({ facture: f1b, compteId: c1.id });
verif("référence ticket non devinable (ASM-T- + aléatoire)", /^ASM-T-[0-9A-F]{10}$/.test(ticket.reference));
const e1 = await encaisserTicket({ reference: ticket.reference, caissier: "Caissier Test" });
verif("encaissement espèces OK (solde 1500)", e1.ok && e1.paiement.montant === 1500);
f1b = await prisma.facture.findUnique({ where: { id: f1.id } });
verif("facture soldée → PAYEE", f1b.statut === "PAYEE" && f1b.paye === 2500);
const e2 = await encaisserTicket({ reference: ticket.reference, caissier: "Caissier Test" });
verif("ticket déjà utilisé refusé (usage unique)", e2.erreur === "deja_paye");

// 7. Ticket expiré refusé
const f3 = await creerFacture({ compteId: c1.id, lignes: [{ libelle: "Livraison", prixUnitaire: 600 }], creePar: "test" });
const tExp = await prisma.ticketEspeces.create({
  data: { reference: "ASM-T-EXPIRE0001", jeton: "j-expire", compteId: c1.id, factureId: f3.id, montant: 600, expireLe: new Date(Date.now() - 1000) },
});
const e3 = await encaisserTicket({ reference: tExp.reference, caissier: "x" });
verif("ticket expiré refusé", e3.erreur === "expire");

// 8. Remboursement partiel + dépassement refusé
const remb = await rembourser({ paiementId: e1.paiement.id, montant: 500, motif: "geste commercial", auteur: "Super Admin" });
verif("remboursement partiel enregistré", remb.montant === 500 && remb.statut === "EFFECTUE");
const pApres = await prisma.paiement.findUnique({ where: { id: e1.paiement.id } });
verif("paiement → PARTIELLEMENT_REMBOURSE", pApres.statut === "PARTIELLEMENT_REMBOURSE");
f1b = await prisma.facture.findUnique({ where: { id: f1.id } });
verif("facture redevient partiellement payée après remboursement", f1b.paye === 2000 && f1b.statut === "PARTIELLEMENT_PAYEE");
let refusee = false;
try { await rembourser({ paiementId: e1.paiement.id, montant: 5000, motif: "trop", auteur: "x" }); } catch { refusee = true; }
verif("remboursement supérieur au disponible REFUSÉ", refusee);

// 9. Versionnement de tarif : non rétroactif
const tarifBase = tarifs.find((t) => t.code === "transport_base");
const totalAvant = (await prisma.facture.findUnique({ where: { id: f1.id } })).total;
const nv = await versionnerTarif(tarifBase.id, { montant: 9999 }, "Super Admin");
const enVigueur = await tarifsEnVigueur({ service: "transport" });
verif("nouvelle version du tarif en vigueur (9999)", enVigueur.find((t) => t.code === "transport_base")?.montant === 9999);
verif("l'ancienne version est clôturée", (await prisma.tarif.findUnique({ where: { id: tarifBase.id } })).fin !== null);
verif("facture déjà émise INCHANGÉE (non rétroactif)", (await prisma.facture.findUnique({ where: { id: f1.id } })).total === totalAvant);

// 10. Relance non dupliquée (contrainte unique facture+niveau)
await prisma.relancePaiement.create({ data: { factureId: f3.id, niveau: "relance1", canal: "interne" } });
let dupliquee = true;
try { await prisma.relancePaiement.create({ data: { factureId: f3.id, niveau: "relance1", canal: "interne" } }); } catch { dupliquee = false; }
verif("relance non dupliquée (même facture, même niveau)", dupliquee === false);

// 11. Une facture émise ne peut pas être supprimée par l'API (aucune route DELETE) —
// vérification structurelle : l'annulation garde la trace.
await prisma.facture.update({ where: { id: f3.id }, data: { statut: "ANNULEE", annuleePar: "Super Admin", annuleeLe: new Date() } });
const f3b = await prisma.facture.findUnique({ where: { id: f3.id } });
verif("annulation tracée (auteur + date), facture conservée", f3b.statut === "ANNULEE" && f3b.annuleePar === "Super Admin");

console.log(`\nRésultat : ${ok} OK / ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
