// Tests DOCUMENTS & ORDONNANCES (Phase 3) — base locale UNIQUEMENT.
// Lancer :  node scripts/tests/test-documents.mjs
import fs from "fs";
process.env.DATABASE_URL = "postgresql://asm:asm@localhost:5432/asmdb";
fs.rmSync(".test-fin", { recursive: true, force: true });
fs.mkdirSync(".test-fin");
fs.copyFileSync("lib/prisma.js", ".test-fin/prisma.js");
const adapter = (chemin) =>
  fs.readFileSync(chemin, "utf8")
    .replaceAll('from "@/lib/prisma"', 'from "./prisma.js"')
    .replaceAll('from "@/lib/telephones"', 'from "./telephones.js"');
fs.writeFileSync(".test-fin/telephones.js", adapter("lib/telephones.js"));
fs.writeFileSync(".test-fin/documentsDemande.js", adapter("lib/documentsDemande.js"));

const { peutJoindre, fichierValide, enregistrerDocument, renouvelerCommande, MAX_DOCS_PAR_DEMANDE } =
  await import(process.cwd() + "/.test-fin/documentsDemande.js");
const { prisma } = await import(process.cwd() + "/.test-fin/prisma.js");

let ok = 0, ko = 0;
const verif = (nom, cond) => (cond ? (ok++, console.log("  ✓", nom)) : (ko++, console.log("  ✗ ECHEC:", nom)));

await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-DOC" } } });

const TEL = "0561 99 88 77";
const livraison = await prisma.demande.create({
  data: {
    service: "medicaments", nom: "Rachid TEST-DOC", telephone: TEL, date: "2026-07-27T10:00",
    fenetre: "Matin (9h – 12h)", pharmacie: "Pharmacie El Biar", depart: "12 rue des Frères, El Biar",
    commune: "El Biar", statut: "CONFIRMEE",
  },
});

// 1. Contrôles d'accès à l'ajout d'ordonnance
verif("téléphone exact (format différent) → autorisé", (await peutJoindre(livraison, "+213561998877")).ok === true);
verif("mauvais téléphone → refusé", (await peutJoindre(livraison, "0550 00 00 00")).erreur === "non_autorise");
const transport = await prisma.demande.create({
  data: { service: "transport", nom: "Rachid TEST-DOC", telephone: TEL, date: "2026-07-27T10:00", statut: "CONFIRMEE" },
});
verif("service sans ordonnance → refusé", (await peutJoindre(transport, TEL)).erreur === "service_sans_ordonnance");
const vieille = await prisma.demande.create({
  data: { service: "medicaments", nom: "Vieux TEST-DOC", telephone: TEL, date: "2026-07-01T10:00", statut: "CONFIRMEE", creeLe: new Date(Date.now() - 3 * 86400000) },
});
verif("demande trop ancienne (48 h) → refusé", (await peutJoindre(vieille, TEL)).erreur === "delai_depasse");

// 2. Contrôle des fichiers
verif("photo JPEG 2 Mo acceptée", fichierValide({ mime: "image/jpeg", taille: 2 * 1024 * 1024 }).ok === true);
verif("PDF accepté", fichierValide({ mime: "application/pdf", taille: 500000 }).ok === true);
verif("exécutable refusé", fichierValide({ mime: "application/x-msdownload", taille: 1000 }).erreur === "format_invalide");
verif("fichier de 20 Mo refusé", fichierValide({ mime: "image/png", taille: 20 * 1024 * 1024 }).erreur === "trop_lourd");

// 3. Limite de documents par demande
for (let i = 0; i < MAX_DOCS_PAR_DEMANDE; i++) {
  await enregistrerDocument(livraison.id, { nom: `ordonnance-${i}.jpg`, chemin: `demandes/${livraison.id}/test-${i}.jpg`, mime: "image/jpeg", taille: 1000 });
}
verif("plafond de pièces par demande respecté", (await peutJoindre(livraison, TEL)).erreur === "limite_atteinte");

// 4. Renouvellement en un bouton
verif("demande non terminée → renouvellement refusé", (await renouvelerCommande(livraison)).erreur === "non_terminee");
await prisma.demande.update({ where: { id: livraison.id }, data: { statut: "TERMINEE", finLe: new Date() } });
const source = await prisma.demande.findUnique({ where: { id: livraison.id } });
const r = await renouvelerCommande(source, { par: "Rachid" });
verif("renouvellement créé", r.ok === true && r.demande.id !== livraison.id);
verif("adresse, pharmacie et fenêtre reprises", r.demande.depart === source.depart && r.demande.pharmacie === source.pharmacie && r.demande.fenetre === source.fenetre);
verif("programmé pour demain, à confirmer par l'équipe", r.demande.date > new Date().toISOString().slice(0, 10) && r.demande.statut === "A_RAPPELER");
verif("ordonnances reprises sans copier les fichiers", r.ordonnances === MAX_DOCS_PAR_DEMANDE);
const docsClone = await prisma.documentDemande.findMany({ where: { demandeId: r.demande.id } });
const docsSource = await prisma.documentDemande.findMany({ where: { demandeId: livraison.id } });
verif("mêmes chemins de stockage (aucune duplication)", docsClone.every((d) => docsSource.some((x) => x.chemin === d.chemin)));
verif("note de traçabilité sur la nouvelle demande", r.demande.notes.includes(`n°${livraison.id}`));
verif("un transport ne se renouvelle pas par ce bouton", (await renouvelerCommande({ ...transport, statut: "TERMINEE" })).erreur === "service_invalide");

// 5. Suppression en cascade des métadonnées
await prisma.demande.delete({ where: { id: r.demande.id } });
verif("métadonnées supprimées avec la demande (cascade)", (await prisma.documentDemande.count({ where: { demandeId: r.demande.id } })) === 0);

// Nettoyage
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-DOC" } } });
console.log(`\nRésultat : ${ok} OK / ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
