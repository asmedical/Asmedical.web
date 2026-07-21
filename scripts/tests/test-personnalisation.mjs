// Tests de la PERSONNALISATION DU SOIN (Phase 2) — base locale UNIQUEMENT.
// Lancer :  node scripts/tests/test-personnalisation.mjs
import fs from "fs";
process.env.DATABASE_URL = "postgresql://asm:asm@localhost:5432/asmdb";
fs.rmSync(".test-fin", { recursive: true, force: true });
fs.mkdirSync(".test-fin");
fs.copyFileSync("lib/prisma.js", ".test-fin/prisma.js");
const adapter = (chemin) =>
  fs.readFileSync(chemin, "utf8")
    .replaceAll('from "@/lib/prisma"', 'from "./prisma.js"')
    .replaceAll('from "@/lib/telephones"', 'from "./telephones.js"')
    .replaceAll('await import("@/lib/telephones")', 'await import("./telephones.js")')
    .replaceAll('from "@/lib/creneaux"', 'from "./creneaux.js"')
    .replaceAll('from "@/lib/trajets"', 'from "./trajets.js"');
fs.writeFileSync(".test-fin/telephones.js", adapter("lib/telephones.js"));
fs.writeFileSync(".test-fin/preferences.js", adapter("lib/preferences.js"));
fs.writeFileSync(".test-fin/creneaux.js", adapter("lib/creneaux.js"));
fs.writeFileSync(".test-fin/trajets.js", adapter("lib/trajets.js"));
fs.writeFileSync(".test-fin/disponibilites.js", adapter("lib/disponibilites.js"));

const { enregistrerPreferences, preferencesPourTel, soignantsConnus, consignesIntervenant } =
  await import(process.cwd() + "/.test-fin/preferences.js");
const { choisirIntervenant } = await import(process.cwd() + "/.test-fin/disponibilites.js");
const { prisma } = await import(process.cwd() + "/.test-fin/prisma.js");

let ok = 0, ko = 0;
const verif = (nom, cond) => (cond ? (ok++, console.log("  ✓", nom)) : (ko++, console.log("  ✗ ECHEC:", nom)));

// Nettoyage + réglage (affectation par ressources : capacité de repli à 0 ?
// non — il faut des soignants configurés, le mode « ressources » s'active seul)
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-PS" } } });
await prisma.preferencePatient.deleteMany({ where: { userId: { in: ["ps-user-1"] } } });
await prisma.soignant.deleteMany({ where: { nom: { contains: "TEST-PS" } } });
await prisma.reglage.upsert({ where: { id: 1 }, update: { affectationAuto: true }, create: { id: 1 } });

// Hermétique : on suspend temporairement les AUTRES soignants valides de la
// base locale (restaurés à la fin) pour que l'affectation ne choisisse
// qu'entre nos deux profils de test.
const autresValides = await prisma.soignant.findMany({ where: { statut: "VALIDE" }, select: { id: true } });
await prisma.soignant.updateMany({ where: { id: { in: autresValides.map((x) => x.id) } }, data: { statut: "INACTIF" } });

// Deux auxiliaires VALIDES : une femme, un homme — mêmes communes/horaires.
const sFemme = await prisma.soignant.create({
  data: { prenom: "Amel", nom: "TEST-PS", genre: "femme", statut: "VALIDE", communes: "", heureDebut: 7, heureFin: 19 },
});
const sHomme = await prisma.soignant.create({
  data: { prenom: "Yacine", nom: "TEST-PS", genre: "homme", statut: "VALIDE", communes: "", heureDebut: 7, heureFin: 19 },
});

// Jour ouvré futur (demain + selon jours off aucun définis)
const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const iso = demain + "T10:00";

// 1. Sans préférence : un des deux est choisi (le moins chargé)
const c1 = await choisirIntervenant("domicile", iso, { duree: 60 });
verif("affectation auto opérationnelle (mode ressources)", !!c1 && [sFemme.id, sHomme.id].includes(c1.id));

// 2. Préférence « femme » respectée
const c2 = await choisirIntervenant("domicile", iso, { duree: 60, prefGenre: "femme" });
verif("préférence femme → auxiliaire femme choisie", c2?.id === sFemme.id);
const c3 = await choisirIntervenant("domicile", iso, { duree: 60, prefGenre: "homme" });
verif("préférence homme → auxiliaire homme choisi", c3?.id === sHomme.id);

// 3. Préférence impossible → repli sans blocage (personne du genre demandé)
await prisma.soignant.update({ where: { id: sHomme.id }, data: { statut: "SUSPENDU" } });
const c4 = await choisirIntervenant("domicile", iso, { duree: 60, prefGenre: "homme" });
verif("aucun homme disponible → repli sur l'auxiliaire libre (pas d'échec)", c4?.id === sFemme.id);
await prisma.soignant.update({ where: { id: sHomme.id }, data: { statut: "VALIDE" } });

// 4. Le favori passe devant, même plus chargé
await prisma.demande.create({
  data: { service: "domicile", nom: "Autre TEST-PS", telephone: "0000", date: demain + "T14:00", statut: "AFFECTEE", soignantId: sHomme.id, dureeMin: 60 },
});
const c5 = await choisirIntervenant("domicile", iso, { duree: 60, favoriId: sHomme.id });
verif("favori disponible → prioritaire malgré sa charge", c5?.id === sHomme.id);

// 5. Favori indisponible (occupé au même créneau) → un autre est choisi
await prisma.demande.create({
  data: { service: "domicile", nom: "Blocage TEST-PS", telephone: "0000", date: iso, statut: "AFFECTEE", soignantId: sHomme.id, dureeMin: 60 },
});
const c6 = await choisirIntervenant("domicile", iso, { duree: 60, favoriId: sHomme.id });
verif("favori occupé → repli sur un(e) autre", c6?.id === sFemme.id);

// 6. Préférences patient : enregistrement + consignes pour l'intervenant
const TEL = "0555 12 12 12";
// Le favori doit être un soignant DÉJÀ intervenu chez le patient : d'abord refusé…
const r1 = await enregistrerPreferences("ps-user-1", TEL, { soignantFavoriId: sFemme.id });
verif("favori jamais venu → refusé", r1.erreur === "favori_inconnu");
// … puis accepté après une intervention terminée.
await prisma.demande.create({
  data: { service: "domicile", nom: "Mounia TEST-PS", telephone: "+21355512 12 12".replace(" ", " "), date: "2026-07-20T09:00", statut: "TERMINEE", finLe: new Date(), soignantId: sFemme.id },
});
const connus = await soignantsConnus(TEL);
verif("soignants connus du patient (téléphone insensible au format)", connus.length === 1 && connus[0].id === sFemme.id);
const r2 = await enregistrerPreferences("ps-user-1", TEL, {
  allergies: "pénicilline", etage: "3e étage", codePorte: "25B4", consignes: "clé chez la voisine",
  prefGenre: "femme", soignantFavoriId: sFemme.id,
});
verif("préférences enregistrées avec favori valide", r2.ok === true && r2.preferences.soignantFavoriId === sFemme.id);

// 7. Lecture par téléphone (formats différents) + consignes intervenant
const parTel = await preferencesPourTel("+213 555 12-12-12");
verif("préférences retrouvées par téléphone normalisé", parTel?.prefGenre === "femme");
const consignes = await consignesIntervenant(TEL);
verif("consignes intervenant : allergies et accès présents", consignes?.allergies === "pénicilline" && consignes?.codePorte === "25B4");

// 8. Genre invalide neutralisé, champs vidés proprement
const r3 = await enregistrerPreferences("ps-user-1", TEL, { prefGenre: "autre", allergies: "" });
verif("genre invalide → non enregistré, champs vidés", r3.ok && r3.preferences.prefGenre === null && r3.preferences.allergies === null);
verif("plus de consignes utiles → rien transmis à l'intervenant", (await consignesIntervenant(TEL)) === null);

// Nettoyage + restauration des soignants suspendus pour le test
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-PS" } } });
await prisma.preferencePatient.deleteMany({ where: { userId: "ps-user-1" } });
await prisma.soignant.deleteMany({ where: { nom: { contains: "TEST-PS" } } });
await prisma.soignant.updateMany({ where: { id: { in: autresValides.map((x) => x.id) } }, data: { statut: "VALIDE" } });
console.log(`\nRésultat : ${ok} OK / ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
