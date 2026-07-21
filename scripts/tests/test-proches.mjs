// Tests du CERCLE FAMILIAL (Phase 1 du Prompt Ultime) — base locale UNIQUEMENT.
// Lancer :  node scripts/tests/test-proches.mjs
import fs from "fs";
process.env.DATABASE_URL = "postgresql://asm:asm@localhost:5432/asmdb";
fs.rmSync(".test-fin", { recursive: true, force: true });
fs.mkdirSync(".test-fin");
fs.copyFileSync("lib/prisma.js", ".test-fin/prisma.js");
const adapter = (chemin) =>
  fs.readFileSync(chemin, "utf8")
    .replaceAll('from "@/lib/prisma"', 'from "./prisma.js"')
    .replaceAll('from "@/lib/rattachements"', 'from "./rattachements.js"')
    .replaceAll('await import("@/lib/telephones")', 'await import("./telephones.js")')
    .replaceAll('await import("@/lib/pushEnvoi")', 'await import("./pushEnvoi.js")');
fs.writeFileSync(".test-fin/rattachements.js", adapter("lib/rattachements.js"));
fs.writeFileSync(".test-fin/telephones.js", adapter("lib/telephones.js"));
fs.writeFileSync(".test-fin/proches.js", adapter("lib/proches.js"));
fs.writeFileSync(".test-fin/pushEnvoi.js", "export async function envoyerPush() {}\n");

const { reclamerCodeProche, inviterProche, mesProches, prochesAutorises, notifierProchesFin } =
  await import(process.cwd() + "/.test-fin/proches.js");
const { autorisationEtablissement } = await import(process.cwd() + "/.test-fin/rattachements.js");
const { prisma } = await import(process.cwd() + "/.test-fin/prisma.js");

let ok = 0, ko = 0;
const verif = (nom, cond) => (cond ? (ok++, console.log("  ✓", nom)) : (ko++, console.log("  ✗ ECHEC:", nom)));

// Nettoyage
await prisma.rattachement.deleteMany({
  where: { OR: [{ patientNom: { contains: "TEST-PR" } }, { patientNom: "Mounia" }, { etabUserId: { in: ["proche-1", "proche-2"] } }] },
});
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-PR" } } });
await prisma.notification.deleteMany({ where: { userId: { in: ["proche-1", "proche-2", "etab-pr-1"] } } });

// Le patient (téléphone avec ESPACES, comme saisi en vrai) génère un code.
const TEL_PATIENT = "0555 66 77 88";
const creerCode = (code, expire = 24) => prisma.rattachement.create({
  data: {
    patientTel: TEL_PATIENT, patientNom: "Mounia TEST-PR",
    statut: "CODE_ATTENTE", source: "code", code,
    codeExpire: new Date(Date.now() + expire * 3600 * 1000),
  },
});

// 1. Réclamation du code par un proche
await creerCode("ASM-TEST01");
const r1 = await reclamerCodeProche("asm-test01", { userId: "proche-1", nom: "Karim (fils)" });
verif("code réclamé (insensible à la casse) → lien ACCEPTE", r1.ok && r1.rattachement.statut === "ACCEPTE");
verif("lien de type « proche », code consommé (usage unique)", r1.rattachement.type === "proche" && r1.rattachement.code === null);

// 2. Anti-doublon : le même proche ne peut pas se rattacher deux fois
await creerCode("ASM-TEST02");
verif("second rattachement au même patient refusé", (await reclamerCodeProche("ASM-TEST02", { userId: "proche-1", nom: "Karim" })).erreur === "deja_rattache");
await prisma.rattachement.deleteMany({ where: { code: "ASM-TEST02" } });

// 3. Codes invalides / expirés
verif("code inconnu refusé", (await reclamerCodeProche("ASM-FAUX99", { userId: "proche-2", nom: "X" })).erreur === "code_invalide");
await creerCode("ASM-VIEUX1", -1);
verif("code expiré refusé", (await reclamerCodeProche("ASM-VIEUX1", { userId: "proche-2", nom: "X" })).erreur === "code_expire");

// 4. Invitation (demande d'accès) : EN_ATTENTE tant que le patient n'accepte pas
const r4 = await inviterProche({ userId: "proche-2", nom: "Sarah (fille)", patientNom: "Mounia", patientTel: "+213555667788" });
verif("invitation créée EN_ATTENTE", r4.ok && r4.rattachement.statut === "EN_ATTENTE");
verif("invitation en double refusée", (await inviterProche({ userId: "proche-2", nom: "Sarah", patientTel: "0555667788" })).erreur === "deja_rattache");
verif("téléphone invalide refusé", (await inviterProche({ userId: "proche-2", nom: "S", patientTel: "12" })).erreur === "telephone_invalide");

// 5. Réserver pour un proche : la procuration ACCEPTE ouvre le droit — pas l'invitation
const v1 = await autorisationEtablissement("proche-1", TEL_PATIENT, "transport");
verif("proche ACCEPTE autorisé à réserver un transport", v1.ok === true);
const v2 = await autorisationEtablissement("proche-2", TEL_PATIENT, "transport");
verif("invitation EN_ATTENTE → réservation refusée", v2.ok === false && v2.raison === "aucune_procuration");

// 6. Périmètre de services respecté
await prisma.rattachement.updateMany({ where: { etabUserId: "proche-1" }, data: { scopes: "transport" } });
verif("service hors périmètre refusé", (await autorisationEtablissement("proche-1", TEL_PATIENT, "medicaments")).ok === false);
await prisma.rattachement.updateMany({ where: { etabUserId: "proche-1" }, data: { scopes: "transport,domicile,medicaments" } });

// 7. Tableau Famille : demandes du patient retrouvées malgré les formats différents
await prisma.demande.create({
  data: { service: "transport", nom: "Mounia TEST-PR", telephone: "+213555667788", date: "2026-07-28T09:00", statut: "CONFIRMEE" },
});
await prisma.demande.create({
  data: { service: "domicile", nom: "Mounia TEST-PR", telephone: "05-55-66-77-88", date: "2026-07-26T10:00", statut: "TERMINEE", finLe: new Date(), compteRendu: "Toilette et pansement faits, tension correcte." },
});
const mp = await mesProches("proche-1");
verif("mesProches : 1 lien avec les demandes du patient", mp.length === 1 && mp[0].demandes.length === 2);
verif("compte-rendu visible dans le tableau Famille", mp[0].demandes.some((d) => (d.compteRendu || "").includes("tension")));

// 8. prochesAutorises : filtre statut + périmètre
const aut = await prochesAutorises("0555667788", "transport");
verif("seul le proche ACCEPTE est informé (pas l'invitation en attente)", aut.length === 1 && aut[0].etabUserId === "proche-1");

// 9. Compte-rendu de fin partagé : notification créée pour le proche
const dFin = await prisma.demande.findFirst({ where: { nom: "Mounia TEST-PR", statut: "TERMINEE" } });
const n1 = await notifierProchesFin(dFin);
const notif = await prisma.notification.findFirst({ where: { userId: "proche-1" }, orderBy: { id: "desc" } });
verif("notification de fin envoyée au proche", n1 === 1 && !!notif && notif.titre.includes("Intervention terminée"));
verif("le compte-rendu figure dans la notification", notif.corps.includes("tension correcte"));
verif("demande non terminée → aucune notification", (await notifierProchesFin({ ...dFin, statut: "EN_COURS" })) === 0);

// 10. Expiration d'une procuration
await prisma.rattachement.updateMany({ where: { etabUserId: "proche-1" }, data: { expiration: "2020-01-01" } });
verif("procuration expirée → réservation refusée", (await autorisationEtablissement("proche-1", TEL_PATIENT, "transport")).ok === false);
verif("procuration expirée → plus de notifications", (await prochesAutorises(TEL_PATIENT, "transport")).length === 0);
const mp2 = await mesProches("proche-1");
verif("tableau Famille : lien marqué expiré, sans données", mp2[0].expiree === true && mp2[0].demandes.length === 0);

// Nettoyage
await prisma.rattachement.deleteMany({
  where: { OR: [{ patientNom: { contains: "TEST-PR" } }, { patientNom: "Mounia" }, { etabUserId: { in: ["proche-1", "proche-2"] } }] },
});
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-PR" } } });
await prisma.notification.deleteMany({ where: { userId: { in: ["proche-1", "proche-2"] } } });
console.log(`\nRésultat : ${ok} OK / ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
