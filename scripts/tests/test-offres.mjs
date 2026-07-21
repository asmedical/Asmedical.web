// Tests OFFRE COMMERCIALE (Phase 4) — base locale UNIQUEMENT.
// Lancer :  node scripts/tests/test-offres.mjs
import fs from "fs";
process.env.DATABASE_URL = "postgresql://asm:asm@localhost:5432/asmdb";
fs.rmSync(".test-fin", { recursive: true, force: true });
fs.mkdirSync(".test-fin");
fs.copyFileSync("lib/prisma.js", ".test-fin/prisma.js");
const adapter = (chemin) =>
  fs.readFileSync(chemin, "utf8")
    .replaceAll('from "@/lib/prisma"', 'from "./prisma.js"')
    .replaceAll('from "@/lib/telephones"', 'from "./telephones.js"')
    .replaceAll('await import("@/lib/finances")', 'await import("./finances.js")')
    .replaceAll('await import("@/lib/offres")', 'await import("./offres.js")')
    .replaceAll('await import("@/lib/pushEnvoi")', 'await import("./pushEnvoi.js")');
fs.writeFileSync(".test-fin/telephones.js", adapter("lib/telephones.js"));
fs.writeFileSync(".test-fin/offres.js", adapter("lib/offres.js"));
fs.writeFileSync(".test-fin/finances.js", adapter("lib/finances.js"));
fs.writeFileSync(".test-fin/pushEnvoi.js", "export async function envoyerPush() {}\n");

const { validerCode, remiseDuCode, consommerCode, codeParrainageDe, creerDevis, RECOMPENSE_PARRAIN } =
  await import(process.cwd() + "/.test-fin/offres.js");
const { facturerDemande, estimerPrestation, installerTarifsDefaut, compteFinancierPour } =
  await import(process.cwd() + "/.test-fin/finances.js");
const { prisma } = await import(process.cwd() + "/.test-fin/prisma.js");

let ok = 0, ko = 0;
const verif = (nom, cond) => (cond ? (ok++, console.log("  ✓", nom)) : (ko++, console.log("  ✗ ECHEC:", nom)));

// Nettoyage
for (const t of ["codePromoUsage", "codePromo", "pack", "devis", "relancePaiement", "remboursement", "ticketEspeces", "paiement", "ligneFacture", "facture", "remiseClient", "souscription", "planAbonnement", "compteFinancier", "tarif", "sequenceFinance", "notification"]) {
  await prisma[t].deleteMany({});
}
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-OF" } } });
await prisma.reglage.upsert({ where: { id: 1 }, update: { facturationAuto: true }, create: { id: 1, facturationAuto: true } });
await installerTarifsDefaut("test");
const compte = await compteFinancierPour("of-user-1", { role: "patient", prenom: "Nour", nom: "TEST-OF", telephone: "0555 20 30 40" });

// 1. PACK forfaitaire : estimation = prix du pack, facture = UNE ligne au prix du pack
const pack = await prisma.pack.create({
  data: { nom: "Pack Dialyse mensuel", service: "transport", prix: 18000, dureeMin: 90, actif: true },
});
const est = await estimerPrestation({ service: "transport", packId: pack.id });
verif("estimation d'un pack = prix affiché exact", est.total === 18000 && est.lignes.length === 1);
const dPack = await prisma.demande.create({
  data: {
    service: "transport", nom: "Nour TEST-OF", telephone: "0555 20 30 40",
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10) + "T09:00",
    statut: "TERMINEE", finLe: new Date(), packId: pack.id, typeTrajet: "aller_retour", prioritaire: true,
  },
});
const f1 = await facturerDemande(dPack);
verif("facture pack : forfait tout compris (pas de suppléments)", f1.ok && f1.facture.total === 18000 && f1.facture.lignes.length === 1);

// 2. CODE PROMO : validation stricte
const promo = await prisma.codePromo.create({
  data: { code: "BIENVENUE10", type: "pourcentage", valeur: 10, plafond: 1500, debut: "2026-01-01", maxUsages: 2 },
});
verif("code valide accepté", (await validerCode("bienvenue10", { service: "transport", telephone: "0555 11 22 33" })).ok === true);
verif("code inconnu refusé", (await validerCode("RIEN", {})).erreur === "code_invalide");
const perime = await prisma.codePromo.create({ data: { code: "VIEUX", type: "fixe", valeur: 500, debut: "2026-01-01", fin: "2026-02-01" } });
verif("code expiré refusé", (await validerCode("VIEUX", {})).erreur === "code_expire");
const autreService = await prisma.codePromo.create({ data: { code: "DOMICILE5", type: "fixe", valeur: 500, debut: "2026-01-01", service: "domicile" } });
verif("code limité à un autre service refusé", (await validerCode("DOMICILE5", { service: "transport" })).erreur === "code_service");
verif("remise pourcentage plafonnée", remiseDuCode(promo, 50000) === 1500);
verif("remise jamais supérieure au sous-total", remiseDuCode({ type: "fixe", valeur: 9000 }, 2500) === 2500);

// 3. Consommation : une fois par client, quota global respecté
const c1 = await consommerCode(promo, { telephone: "0555 11 22 33" });
verif("consommation enregistrée", c1.ok === true);
const c2 = await consommerCode(promo, { telephone: "+213 555 11 22 33" });
verif("même client (format différent) → pas de double consommation", c2.deja === true);
verif("après consommation, le même client est refusé à la validation", (await validerCode("BIENVENUE10", { telephone: "0555112233" })).erreur === "code_deja_utilise");
await consommerCode(promo, { telephone: "0666 00 00 01" });
verif("quota global atteint → code épuisé", (await validerCode("BIENVENUE10", { telephone: "0777 00 00 02" })).erreur === "code_epuise");

// 4. Facturation avec code promo : remise appliquée puis code consommé
const promo2 = await prisma.codePromo.create({
  data: { code: "MOINS500", type: "fixe", valeur: 500, debut: "2026-01-01" },
});
const dPromo = await prisma.demande.create({
  data: {
    service: "transport", nom: "Nour TEST-OF", telephone: "0555 20 30 40",
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10) + "T10:00",
    statut: "TERMINEE", finLe: new Date(), codePromo: "MOINS500",
  },
});
const f2 = await facturerDemande(dPromo);
verif("facture avec code : -500 DZD appliqués (2500 → 2000)", f2.ok && f2.facture.total === 2000 && (f2.facture.remiseDetail || "").includes("MOINS500"));
verif("code consommé à la facturation", (await prisma.codePromoUsage.count({ where: { codeId: promo2.id } })) === 1);
const dPromo2 = await prisma.demande.create({
  data: {
    service: "transport", nom: "Nour TEST-OF", telephone: "0555 20 30 40",
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10) + "T11:00",
    statut: "TERMINEE", finLe: new Date(), codePromo: "MOINS500",
  },
});
const f3 = await facturerDemande(dPromo2);
verif("second usage par le même client → plein tarif (code ignoré)", f3.ok && f3.facture.total === 2500);

// 5. PARRAINAGE : code personnel + récompense du parrain, une fois par filleul
const parrainCompte = await compteFinancierPour("parrain-1", { role: "patient", prenom: "Walid", nom: "TEST-OF", telephone: "0555 99 88 77" });
const codeParrain = await codeParrainageDe("parrain-1", "Walid");
verif("code de parrainage créé (10 %, plafonné)", codeParrain.code.startsWith("ASM") && codeParrain.valeur === 10 && codeParrain.plafond === 1000);
verif("le même compte reçoit toujours LE MÊME code", (await codeParrainageDe("parrain-1", "Walid")).id === codeParrain.id);
verif("le parrain ne peut pas utiliser son propre code", (await validerCode(codeParrain.code, { userId: "parrain-1" })).erreur === "code_proprietaire");
await consommerCode(codeParrain, { telephone: "0555 20 30 40" });
const recompenses = await prisma.remiseClient.findMany({ where: { compteId: parrainCompte.id } });
verif(`parrain crédité de ${RECOMPENSE_PARRAIN} DZD`, recompenses.length === 1 && recompenses[0].valeur === RECOMPENSE_PARRAIN);
const c3 = await consommerCode(codeParrain, { telephone: "0555 20 30 40" });
verif("même filleul → aucune double récompense", c3.deja === true && (await prisma.remiseClient.count({ where: { compteId: parrainCompte.id } })) === 1);

// 6. DEVIS : numérotation et garde-fous
const dv = await creerDevis({ nom: "Centre TEST-OF", telephone: "023 55 44 33", besoin: "3 transports par semaine vers le centre de dialyse de Kouba." });
verif("devis créé et numéroté ASM-DV-", dv.ok && dv.devis.numero.startsWith("ASM-DV-"));
verif("besoin trop court refusé", (await creerDevis({ nom: "X", telephone: "0555 00 00 00", besoin: "court" })).erreur === "besoin_trop_court");
verif("téléphone invalide refusé", (await creerDevis({ nom: "X", telephone: "12", besoin: "Un besoin décrit correctement ici." })).erreur === "coordonnees");

// Nettoyage
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-OF" } } });
console.log(`\nRésultat : ${ok} OK / ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
