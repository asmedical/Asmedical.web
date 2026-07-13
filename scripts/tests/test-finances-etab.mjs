// Tests des FINANCES ÉTABLISSEMENT (facture mensuelle groupée, relevé de
// compte, détail par patient) — base locale UNIQUEMENT.
// Lancer :  node scripts/tests/test-finances-etab.mjs
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

const { facturerDemande, facturerMensuel, demandesAFacturer, releveCompte, moisLisible, installerTarifsDefaut, compteFinancierPour, confirmerPaiement, prochainNumero } =
  await import(process.cwd() + "/.test-fin/finances.js");
const { prisma } = await import(process.cwd() + "/.test-fin/prisma.js");

let ok = 0, ko = 0;
const verif = (nom, cond) => (cond ? (ok++, console.log("  ✓", nom)) : (ko++, console.log("  ✗ ECHEC:", nom)));

// Nettoyage
for (const t of ["relancePaiement", "remboursement", "ticketEspeces", "paiement", "ligneFacture", "facture", "remiseClient", "souscription", "planAbonnement", "compteFinancier", "tarif", "sequenceFinance", "notification"]) {
  await prisma[t].deleteMany({});
}
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-ETB" } } });
await prisma.reglage.upsert({ where: { id: 1 }, update: { facturationAuto: true }, create: { id: 1, facturationAuto: true } });
await installerTarifsDefaut("test");

// Compte de l'établissement, passé en mode MENSUEL
const etab = await compteFinancierPour("etab-etb-1", { role: "pro", etablissement: "Centre de dialyse TEST-ETB", telephone: "023 55 66 77" });
await prisma.compteFinancier.update({ where: { id: etab.id }, data: { modeFacturation: "mensuel" } });
const compte = await prisma.compteFinancier.findUnique({ where: { id: etab.id } });

const creerPresta = (nom, date, extra = {}) => prisma.demande.create({
  data: {
    service: "transport", nom: `${nom} TEST-ETB`, telephone: "0555 00 11 22", date,
    statut: "TERMINEE", finLe: new Date(), parEtablissement: "Centre de dialyse TEST-ETB", parEtabUserId: "etab-etb-1",
    ...extra,
  },
});

// 1. En mode mensuel, la clôture NE facture PAS (différée)
const p1 = await creerPresta("Amine", "2026-06-03T09:00");
const r1 = await facturerDemande(p1);
verif("mode mensuel → clôture différée, aucune facture immédiate", r1.differee === "mensuel");
verif("aucune facture émise à la clôture", (await prisma.facture.count()) === 0);

// 2. Facture mensuelle groupée : 3 prestations de juin, 2 patients → UNE facture
const p2 = await creerPresta("Amine", "2026-06-10T14:00");
const p3 = await creerPresta("Yasmine", "2026-06-24T08:30");
await creerPresta("Karim", "2026-07-02T09:00"); // juillet : hors périmètre
const rm = await facturerMensuel(compte, "2026-06", { auteur: "test" });
verif("facture mensuelle émise", rm.ok && rm.facture.numero.startsWith("ASM-"));
verif("les 3 prestations de juin regroupées (juillet exclu)", rm.prestations === 3);
verif("total = 3 × 2500 (transports simples en semaine)", rm.facture.total === 7500);
verif("libellé du mois sur la facture (« juin 2026 »)", rm.facture.notes.includes("juin 2026") && rm.facture.notes.includes("3 transport(s)"));

// 3. Détail par patient : chaque ligne porte le nom du patient et sa prestation
const lignes = await prisma.ligneFacture.findMany({ where: { factureId: rm.facture.id } });
verif("une ligne par prestation, reliée (demandeId)", new Set(lignes.map((l) => l.demandeId)).size === 3 && lignes.every((l) => l.demandeId));
verif("nom du patient sur chaque ligne", lignes.some((l) => l.libelle.includes("Amine")) && lignes.some((l) => l.libelle.includes("Yasmine")));
verif("date de la prestation sur chaque ligne", lignes.every((l) => /\d{4}-\d{2}-\d{2}/.test(l.libelle)));

// 4. Anti-doublon : relancer le même mois ne refacture pas
const rm2 = await facturerMensuel(compte, "2026-06", { auteur: "test" });
verif("relance du même mois → facture existante, pas de doublon", rm2.deja === true && rm2.facture.id === rm.facture.id);
verif("les prestations de juin ne sont plus « à facturer »", (await demandesAFacturer(compte, "2026-06")).length === 0);

// 5. Une prestation déjà facturée SEULE n'entre jamais dans une groupée
const p5 = await creerPresta("Nadia", "2026-07-08T10:00");
await prisma.compteFinancier.update({ where: { id: etab.id }, data: { modeFacturation: "prestation" } });
const rSeule = await facturerDemande(p5);
verif("retour en mode prestation → facture immédiate à la clôture", rSeule.ok === true);
await prisma.compteFinancier.update({ where: { id: etab.id }, data: { modeFacturation: "mensuel" } });
const aFacturerJuillet = await demandesAFacturer(compte, "2026-07");
verif("juillet à facturer = 1 seule (Karim) — Nadia déjà facturée seule", aFacturerJuillet.length === 1 && aFacturerJuillet[0].nom.includes("Karim"));

// 6. La facturation individuelle refuse une prestation déjà dans une groupée
const rDouble = await facturerDemande(await prisma.demande.findUnique({ where: { id: p2.id } }));
verif("prestation en facture groupée → jamais refacturée seule", rDouble.deja === true && rDouble.facture.id === rm.facture.id);

// 7. Notification à l'établissement
const notif = await prisma.notification.findFirst({ where: { userId: "etab-etb-1", titre: { contains: "juin" } } });
verif("établissement notifié (facture mensuelle disponible)", !!notif && notif.corps.includes(rm.facture.numero));

// 8. Mois sans prestation / paramètres invalides
verif("mois vide → rien à facturer", (await facturerMensuel(compte, "2026-05", { auteur: "test" })).vide === true);
verif("mois invalide refusé", (await facturerMensuel(compte, "n'importe", { auteur: "test" })).erreur !== undefined);

// 9. Relevé de compte : facture au débit, paiement confirmé au crédit
const paiement = await prisma.$transaction(async (tx) => {
  const ref = await prochainNumero(tx, "paiement", "ASM-P-");
  return tx.paiement.create({
    data: { reference: ref, compteId: compte.id, factureId: rm.facture.id, moyen: "virement", montant: 5000, statut: "EN_ATTENTE" },
  });
});
await confirmerPaiement(paiement.id);
const rc = await releveCompte(compte.id, { du: "2026-01-01", au: "2026-12-31" });
verif("relevé : débits = factures émises (7500 groupée + 2500 individuelle)", rc.totalDebit === 10000);
verif("relevé : crédits = paiements confirmés", rc.totalCredit === 5000);
verif("relevé : solde restant dû = 10000 - 5000 = 5000", rc.solde === 5000);
verif("relevé : solde progressif ligne à ligne", rc.lignes[rc.lignes.length - 1].solde === 5000 && rc.lignes.length === 3);
verif("relevé : la facture mensuelle est signalée", rc.lignes.some((l) => l.libelle.includes("(mensuelle)")));

// 10. Libellé du mois
verif("moisLisible(2026-06) = juin 2026", moisLisible("2026-06") === "juin 2026");

// Nettoyage
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-ETB" } } });
console.log(`\nRésultat : ${ok} OK / ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
