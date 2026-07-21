// Tests COMMUNICATION & ASSISTANCE (Phase 7) — base locale UNIQUEMENT.
// Lancer :  node scripts/tests/test-communication.mjs
import fs from "fs";
process.env.DATABASE_URL = "postgresql://asm:asm@localhost:5432/asmdb";
fs.rmSync(".test-fin", { recursive: true, force: true });
fs.mkdirSync(".test-fin");
fs.copyFileSync("lib/prisma.js", ".test-fin/prisma.js");

// Canaux factices : chaque envoi est enregistré pour vérification.
globalThis.__envois = { sms: [], push: [], wa: [] };
fs.writeFileSync(".test-fin/pushEnvoi.js",
  "export async function envoyerPush(userId, p) { globalThis.__envois.push.push({ userId, ...p }); }\n");
fs.writeFileSync(".test-fin/stub-sms.js",
  "export async function creditElite() { return globalThis.__credit ?? '42.0'; }\n" +
  "export async function envoyerElite(tel, texte) { globalThis.__envois.sms.push({ tel, texte }); return { id: 'x' }; }\n");
fs.writeFileSync(".test-fin/stub-wa.js",
  "export async function envoyerWhatsAppModele(tel, modele, params) { globalThis.__envois.wa.push({ tel, modele, params }); return { canal: 'whatsapp' }; }\n");

const adapter = (chemin) =>
  fs.readFileSync(chemin, "utf8")
    .replaceAll('from "@/lib/prisma"', 'from "./prisma.js"')
    .replaceAll('from "@/lib/telephones"', 'from "./telephones.js"')
    .replaceAll('from "@/lib/creneaux"', 'from "./creneaux.js"')
    .replaceAll('from "@/lib/trajets"', 'from "./trajets.js"')
    .replaceAll('await import("@/lib/pushEnvoi")', 'await import("./pushEnvoi.js")')
    .replaceAll('await import("@/lib/sms/elitesms")', 'await import("./stub-sms.js")')
    .replaceAll('await import("@/lib/sms/whatsapp")', 'await import("./stub-wa.js")');
fs.writeFileSync(".test-fin/telephones.js", adapter("lib/telephones.js"));
fs.writeFileSync(".test-fin/creneaux.js", adapter("lib/creneaux.js"));
fs.writeFileSync(".test-fin/trajets.js", adapter("lib/trajets.js"));
fs.writeFileSync(".test-fin/filDemande.js", adapter("lib/filDemande.js"));
fs.writeFileSync(".test-fin/rappels.js", adapter("lib/rappels.js"));
fs.writeFileSync(".test-fin/assistant.js", adapter("lib/assistantScenarios.js"));

const { accesFil, ecrireFil, messagesFil, notifierFil } = await import(process.cwd() + "/.test-fin/filDemande.js");
const { demandesARappeler, envoyerRappels, tickRappels } = await import(process.cwd() + "/.test-fin/rappels.js");
const { repondreAssistant, libelleAction, CIBLES_ACTION } = await import(process.cwd() + "/.test-fin/assistant.js");
const { prisma } = await import(process.cwd() + "/.test-fin/prisma.js");

let ok = 0, ko = 0;
const verif = (nom, cond) => (cond ? (ok++, console.log("  ✓", nom)) : (ko++, console.log("  ✗ ECHEC:", nom)));

// Client Supabase factice : seul le patient 0555 30 40 50 a un compte.
const adminFactice = {
  from: () => ({
    select: () => ({
      ilike: (_c, motif) => ({
        limit: async () => ({ data: motif.includes("55304050") ? [{ id: "co-patient-1" }] : [] }),
      }),
    }),
  }),
};

// ---------- Préparation ----------
await prisma.message.deleteMany({ where: { demandeId: { not: null } } });
await prisma.rappelRdv.deleteMany({});
await prisma.notification.deleteMany({ where: { userId: { startsWith: "co-" } } });
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-CO" } } });
await prisma.rattachement.deleteMany({ where: { etabUserId: { startsWith: "co-" } } });
await prisma.reglage.upsert({ where: { id: 1 }, update: { rappelsAuto: true, rappelsTickLe: null }, create: { id: 1 } });

// ---------- 1. Fil de discussion par demande ----------
const TEL = "0555 30 40 50";
const dem = await prisma.demande.create({
  data: { service: "transport", nom: "Lina TEST-CO", telephone: TEL, date: "2026-08-10T09:00", statut: "CONFIRMEE", parEtabUserId: "co-resa-1" },
});
await prisma.rattachement.create({
  data: { etabUserId: "co-proche-1", etabNom: "Karim (fils)", type: "proche", patientTel: TEL, patientNom: "Lina", statut: "ACCEPTE", scopes: "transport" },
});
await prisma.rattachement.create({
  data: { etabUserId: "co-expire-1", etabNom: "Ancien", type: "proche", patientTel: TEL, patientNom: "Lina", statut: "ACCEPTE", scopes: "transport", expiration: "2020-01-01" },
});

verif("patient reconnu (téléphone en autre format)",
  (await accesFil(dem.id, { userId: "co-patient-1", telephone: "+213 555 30 40 50" })).role === "patient");
verif("réservataire reconnu (parEtabUserId)",
  (await accesFil(dem.id, { userId: "co-resa-1", telephone: "0999 99 99 99" })).role === "reservataire");
verif("proche rattaché ACCEPTE reconnu",
  (await accesFil(dem.id, { userId: "co-proche-1", telephone: "0888 88 88 88" })).role === "proche");
verif("rattachement expiré → accès refusé",
  (await accesFil(dem.id, { userId: "co-expire-1", telephone: "0888 00 00 00" })).erreur === "acces_refuse");
verif("étranger → accès refusé",
  (await accesFil(dem.id, { userId: "co-intrus", telephone: "0111 22 33 44" })).erreur === "acces_refuse");
verif("message vide refusé", (await ecrireFil(dem.id, { userId: "co-patient-1", nom: "Lina", texte: "  " })).erreur === "message_vide");

await ecrireFil(dem.id, { userId: "co-proche-1", nom: "Karim (fils)", texte: "Maman sera prête à 8h45." });
await ecrireFil(dem.id, { userId: "equipe", nom: "Sabrina (ASM)", texte: "Parfait, le chauffeur est prévenu.", deEquipe: true });
const filMsgs = await messagesFil(dem.id);
verif("fil ordonné avec auteurs affichés",
  filMsgs.length === 2 && filMsgs[0].nomAuteur === "Karim (fils)" && filMsgs[1].deEquipe === true);

await notifierFil(adminFactice, dem, { auteurUserId: "co-proche-1", nomAuteur: "Karim (fils)", apercu: "Maman sera prête" });
const notifsFil = await prisma.notification.findMany({ where: { userId: { startsWith: "co-" } } });
verif("participants prévenus (patient + réservataire), jamais l'auteur",
  notifsFil.some((n) => n.userId === "co-patient-1") &&
  notifsFil.some((n) => n.userId === "co-resa-1") &&
  !notifsFil.some((n) => n.userId === "co-proche-1"));
verif("le chat personnel n'est pas pollué par le fil",
  (await prisma.message.count({ where: { userId: "co-proche-1", demandeId: null } })) === 0);

// ---------- 2. Rappels automatiques ----------
const dans = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString().slice(0, 16);
const demain = await prisma.demande.create({
  data: { service: "transport", nom: "Rappel TEST-CO", telephone: TEL, date: dans(24), statut: "CONFIRMEE" },
});
const bientot = await prisma.demande.create({
  data: { service: "domicile", nom: "Rappel TEST-CO", telephone: "0666 70 80 90", date: dans(2), statut: "AFFECTEE" },
});
await prisma.demande.create({
  data: { service: "transport", nom: "Rappel TEST-CO", telephone: TEL, date: dans(25), statut: "ANNULEE" },
});
await prisma.demande.create({
  data: { service: "transport", nom: "Rappel TEST-CO", telephone: TEL, date: dans(24 * 10), statut: "CONFIRMEE" },
});

const aFaire = await demandesARappeler();
verif("fenêtre « veille » : la demande de demain uniquement (annulée exclue)",
  aFaire.veille.length === 1 && aFaire.veille[0].id === demain.id);
verif("fenêtre « 2 h avant » : la demande imminente", aFaire.h2.length === 1 && aFaire.h2[0].id === bientot.id);

process.env.WHATSAPP_TOKEN = "t";
process.env.WHATSAPP_PHONE_ID = "p";
process.env.WHATSAPP_TEMPLATE_RAPPEL = "asm_rappel";
const envoi1 = await envoyerRappels({ admin: adminFactice });
verif("2 rappels envoyés", envoi1.envoyes === 2);
const rVeille = await prisma.rappelRdv.findUnique({ where: { demandeId_type: { demandeId: demain.id, type: "veille" } } });
const rH2 = await prisma.rappelRdv.findUnique({ where: { demandeId_type: { demandeId: bientot.id, type: "h2" } } });
verif("patient avec compte : notification + push + sms + whatsapp",
  rVeille && ["notification", "push", "sms", "whatsapp"].every((c) => rVeille.canaux.includes(c)));
verif("patient sans compte : sms + whatsapp seulement",
  rH2 && rH2.canaux.includes("sms") && rH2.canaux.includes("whatsapp") && !rH2.canaux.includes("notification"));
verif("textes SMS : « demain » pour la veille, « 2 h » pour l'imminent",
  globalThis.__envois.sms.some((s) => s.texte.includes("demain")) &&
  globalThis.__envois.sms.some((s) => s.texte.includes("2 h")));
verif("modèle WhatsApp utilitaire appelé avec service + heure",
  globalThis.__envois.wa.length === 2 && globalThis.__envois.wa[0].modele === "asm_rappel" && globalThis.__envois.wa[0].params.length === 2);

const envoi2 = await envoyerRappels({ admin: adminFactice });
verif("anti-doublon strict : second passage → 0 envoi", envoi2.envoyes === 0);

// Crédit épuisé → pas de SMS (on préserve les codes de connexion).
await prisma.rappelRdv.deleteMany({});
globalThis.__envois.sms = [];
globalThis.__credit = "3.0";
await envoyerRappels({ admin: adminFactice });
verif("crédit SMS sous le seuil → aucun SMS envoyé", globalThis.__envois.sms.length === 0);
globalThis.__credit = "42.0";

// Verrou opportuniste : une seule exécution par 10 minutes.
await prisma.rappelRdv.deleteMany({});
await prisma.reglage.update({ where: { id: 1 }, data: { rappelsTickLe: null } });
const t1 = await tickRappels({ admin: adminFactice });
const t2 = await tickRappels({ admin: adminFactice });
verif("déclencheur : premier passe, second sauté (verrou 10 min)", t1.envoyes === 2 && t2.saute === true);
await prisma.reglage.update({ where: { id: 1 }, data: { rappelsAuto: false, rappelsTickLe: null } });
verif("rappels désactivables dans les réglages", (await tickRappels({ admin: adminFactice })).saute === true);
await prisma.reglage.update({ where: { id: 1 }, data: { rappelsAuto: true } });

// ---------- 3. Assistant guidé FR/AR ----------
verif("« C'est combien ? » → tarifs (FR)", repondreAssistant("C'est combien le transport ?", "fr").id === "prix");
verif("« بشحال السعر » → tarifs (AR/darija)", repondreAssistant("بشحال السعر ؟", "ar").id === "prix");
verif("« où est le chauffeur » → suivi", repondreAssistant("Où est le chauffeur ?", "fr").id === "suivi");
verif("« وين السائق » → suivi (darija)", repondreAssistant("وين السائق", "ar").id === "suivi");
verif("« je veux annuler » → annulation", repondreAssistant("Je veux annuler mon rendez-vous", "fr").id === "annuler");
verif("« ordonnance » → médicaments avec action", repondreAssistant("livraison avec ordonnance", "fr").action === "medicaments");
verif("réponse arabe rendue en arabe", /[؀-ۿ]/.test(repondreAssistant("السعر", "ar").txt));
verif("texte inconnu → repli honnête vers un humain", repondreAssistant("azerty uiop", "fr").id === "defaut");
verif("chaque action proposée a un libellé et une cible",
  Object.keys(CIBLES_ACTION).every((a) => libelleAction(a, "fr") && libelleAction(a, "ar")));

// ---------- Nettoyage ----------
await prisma.message.deleteMany({ where: { demandeId: { not: null } } });
await prisma.rappelRdv.deleteMany({});
await prisma.notification.deleteMany({ where: { userId: { startsWith: "co-" } } });
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-CO" } } });
await prisma.rattachement.deleteMany({ where: { etabUserId: { startsWith: "co-" } } });

console.log(`\nRésultat : ${ok} OK / ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
