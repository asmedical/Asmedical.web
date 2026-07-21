// Tests ESPACE PRO & PILOTAGE (Phase 6) — base locale UNIQUEMENT.
// Lancer :  node scripts/tests/test-pilotage.mjs
import fs from "fs";
import { execSync } from "child_process";
process.env.DATABASE_URL = "postgresql://asm:asm@localhost:5432/asmdb";
fs.rmSync(".test-fin", { recursive: true, force: true });
fs.mkdirSync(".test-fin");
fs.copyFileSync("lib/prisma.js", ".test-fin/prisma.js");
const adapter = (chemin) =>
  fs.readFileSync(chemin, "utf8")
    .replaceAll('from "@/lib/prisma"', 'from "./prisma.js"')
    .replaceAll('from "@/lib/telephones"', 'from "./telephones.js"');
fs.writeFileSync(".test-fin/telephones.js", adapter("lib/telephones.js"));
fs.writeFileSync(".test-fin/xlsx.js", adapter("lib/xlsx.js"));
fs.writeFileSync(".test-fin/tournees.js", adapter("lib/tournees.js"));
fs.writeFileSync(".test-fin/groupes.js", adapter("lib/groupes.js"));
fs.writeFileSync(".test-fin/pilotage.js", adapter("lib/pilotage.js"));

const { classeurXlsx } = await import(process.cwd() + "/.test-fin/xlsx.js");
const { ordonnerTournee, etapesTournee, resumeTournee } = await import(process.cwd() + "/.test-fin/tournees.js");
const { creerGroupe, ajouterMembre, retirerMembre, supprimerGroupe, perimetreDe } = await import(process.cwd() + "/.test-fin/groupes.js");
const { statsEtablissement, statsAvancees, derniersMois } = await import(process.cwd() + "/.test-fin/pilotage.js");
const { prisma } = await import(process.cwd() + "/.test-fin/prisma.js");

let ok = 0, ko = 0;
const verif = (nom, cond) => (cond ? (ok++, console.log("  ✓", nom)) : (ko++, console.log("  ✗ ECHEC:", nom)));

// ---------- 1. XLSX sans dépendance ----------
const xl = classeurXlsx([
  ["Client", "Montant (DA)", "Note"],
  ["Aïn Bénian & Cie", 2500, "guillemets \" et <chevrons>"],
  ["Bàb El Oued", 1750, ""],
], "Essai ASM");
verif("archive ZIP valide (signature PK)", xl[0] === 0x50 && xl[1] === 0x4b && xl[2] === 3 && xl[3] === 4);
fs.writeFileSync(".test-fin/essai.xlsx", xl);
const py = execSync(
  `python3 -c "import zipfile;z=zipfile.ZipFile('.test-fin/essai.xlsx');print(z.testzip());print(len(z.namelist()));print(z.read('xl/worksheets/sheet1.xml').decode())"`,
  { encoding: "utf8" }
);
verif("intégrité ZIP confirmée par un lecteur indépendant (CRC)", py.startsWith("None\n"));
verif("5 fichiers XML dans le classeur", py.split("\n")[1] === "5");
verif("nombre stocké comme NOMBRE (sommable dans Excel)", py.includes("<v>2500</v>"));
verif("accents préservés, XML échappé", py.includes("Aïn Bénian &amp; Cie") && py.includes("&lt;chevrons&gt;"));
verif("nom de feuille présent dans le classeur", xl.toString("utf8").includes('name="Essai ASM"'));

// ---------- 2. Tournées chauffeurs ----------
const missions = [
  { id: 1, date: "2026-08-01T14:00", commune: "Kouba" },
  { id: 2, date: "2026-08-01T09:00", commune: "Hydra" },
  { id: 3, date: null, fenetre: "matin (8h–12h)", commune: "Kouba" },
  { id: 4, date: null, fenetre: "matin (8h–12h)", commune: "Bab El Oued" },
  { id: 5, date: null, fenetre: "matin (8h–12h)", commune: "Kouba" },
  { id: 6, date: null, fenetre: "après-midi (15h–19h)", commune: "Hydra" },
];
const ordre = ordonnerTournee(missions).map((m) => m.id);
verif("heures fixes respectées (9h avant 14h)", ordre.indexOf(2) < ordre.indexOf(1));
verif("fenêtre matin (≈8h) placée avant le RDV de 9h", ordre.indexOf(4) < ordre.indexOf(2));
verif("même fenêtre → communes regroupées (les 2 Kouba côte à côte)",
  Math.abs(ordre.indexOf(3) - ordre.indexOf(5)) === 1);
verif("fenêtre après-midi en dernier", ordre[ordre.length - 1] === 6);
const etapes = etapesTournee(missions);
verif("rupture de commune signalée à chaque changement (5 étapes sur 6 missions)",
  etapes[0].nouvelleCommune === "Bab El Oued" && etapes.filter((e) => e.nouvelleCommune).length === 5);
const resume = resumeTournee(missions);
verif("résumé par commune dans l'ordre de passage", resume.length === 5 && resume.reduce((s, r) => s + r.etapes, 0) === 6);

// ---------- Préparation base ----------
await prisma.groupeMembre.deleteMany({});
await prisma.groupeEtablissement.deleteMany({});
await prisma.demande.deleteMany({});
await prisma.relancePaiement.deleteMany({});
await prisma.remboursement.deleteMany({});
await prisma.ticketEspeces.deleteMany({});
await prisma.paiement.deleteMany({});
await prisma.ligneFacture.deleteMany({});
await prisma.facture.deleteMany({});
await prisma.compteFinancier.deleteMany({});

// ---------- 3. Groupes multi-sites ----------
verif("nom de groupe trop court refusé", (await creerGroupe("x")).erreur === "nom_invalide");
const g1 = (await creerGroupe("Cliniques TEST-PI")).groupe;
const g2 = (await creerGroupe("Autre groupe TEST-PI")).groupe;
verif("ajout d'un site au groupe", (await ajouterMembre(g1.id, "pi-site-1", "Site Hydra")).ok === true);
await ajouterMembre(g1.id, "pi-site-2", "Site Kouba");
verif("double ajout refusé (déjà membre)", (await ajouterMembre(g1.id, "pi-site-1")).erreur === "deja_membre");
verif("un compte n'appartient qu'à UN groupe", (await ajouterMembre(g2.id, "pi-site-1")).erreur === "membre_autre_groupe");
const périSans = await perimetreDe("pi-seul");
verif("sans groupe : périmètre = soi-même", périSans.userIds.length === 1 && périSans.groupe === null);
const périAvec = await perimetreDe("pi-site-1");
verif("avec groupe : périmètre = tous les sites", périAvec.userIds.length === 2 && périAvec.groupe.nom === "Cliniques TEST-PI");
await retirerMembre("pi-site-2");
verif("site retiré du groupe", (await perimetreDe("pi-site-1")).userIds.length === 1);
await supprimerGroupe(g1.id);
verif("suppression du groupe → membres détachés (cascade)",
  (await prisma.groupeMembre.count({ where: { userId: "pi-site-1" } })) === 0);

// ---------- 4. Statistiques établissement ----------
const moisCourant = new Date().toISOString().slice(0, 7);
const moisPasse = derniersMois(2)[0];
const demandesSeed = [
  { service: "transport", statut: "TERMINEE", date: `${moisCourant}-05T09:00`, telephone: "0555 10 20 30", parEtabUserId: "pi-etab-A", nom: "TEST-PI" },
  { service: "domicile", statut: "ANNULEE", date: `${moisCourant}-06T10:00`, telephone: "+213 555 10 20 30", parEtabUserId: "pi-etab-A", nom: "TEST-PI" },
  { service: "transport", statut: "CONFIRMEE", date: `${moisCourant}-07T11:00`, telephone: "0666 44 55 66", parEtabUserId: "pi-etab-B", nom: "TEST-PI" },
  { service: "transport", statut: "TERMINEE", date: `${moisPasse}-10T09:00`, telephone: "0555 10 20 30", parEtabUserId: "pi-etab-A", nom: "TEST-PI" },
];
for (const d of demandesSeed) await prisma.demande.create({ data: d });
const compteA = await prisma.compteFinancier.create({
  data: { numero: "ASM-CL-TESTPI1", userId: "pi-etab-A", type: "pro", nom: "Etab A TEST-PI" },
});
await prisma.facture.create({
  data: { numero: "ASM-TESTPI-1", compteId: compteA.id, statut: "EMISE", emissionLe: `${moisCourant}-01`, echeance: `${moisCourant}-28`, sousTotal: 9000, total: 9000, paye: 2000 },
});

const sA = await statsEtablissement(["pi-etab-A"]);
verif("mois courant : 2 réservations pour le site A", sA.moisCourant.total === 2);
verif("même patient sous 2 formats → 1 patient distinct", sA.moisCourant.patients === 1);
verif("terminées / annulées comptées", sA.moisCourant.terminees === 1 && sA.moisCourant.annulees === 1);
verif("historique mensuel : le mois passé compte 1", sA.mois.find((m) => m.mois === moisPasse)?.demandes === 1);
verif("restant dû réel (9000 − 2000)", sA.resteDu === 7000);
const sAB = await statsEtablissement(["pi-etab-A", "pi-etab-B"]);
verif("groupe : consolidation + détail par site", sAB.moisCourant.total === 3 && sAB.parSite["pi-etab-B"] === 1);

// ---------- 5. Statistiques avancées admin ----------
await prisma.paiement.create({
  data: { reference: "ASM-P-TESTPI", compteId: compteA.id, montant: 2000, moyen: "especes", statut: "CONFIRME", confirmeLe: new Date() },
});
await prisma.demande.create({
  data: { service: "medicaments", statut: "TERMINEE", date: `${moisCourant}-08T10:00`, telephone: "0777 88 99 00", commune: "Kouba", nom: "TEST-PI" },
});
const av = await statsAvancees();
const dernierMois = av.mois[av.mois.length - 1];
verif("12 mois renvoyés, le dernier = mois courant", av.mois.length === 12 && dernierMois.mois === moisCourant);
verif("activité par service comptée", dernierMois.transport === 2 && dernierMois.medicaments === 1);
verif("CA facturé et encaissé du mois", dernierMois.facture === 9000 && dernierMois.encaisse === 2000);
verif("top communes alimenté (hors annulées)", av.topCommunes.some((c) => c.commune === "Kouba"));
verif("taux d'annulation calculé", av.totaux.tauxAnnulation === Math.round((1 / 5) * 100));

// ---------- Nettoyage ----------
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-PI" } } });
await prisma.paiement.deleteMany({});
await prisma.facture.deleteMany({});
await prisma.compteFinancier.deleteMany({ where: { userId: { startsWith: "pi-" } } });
await prisma.groupeMembre.deleteMany({});
await prisma.groupeEtablissement.deleteMany({});

console.log(`\nRésultat : ${ok} OK / ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
