// Tests PRÉPARATION LANCEMENT (Phase 8) — base locale + contrôles de
// sécurité automatiques (rejoués à chaque exécution).
// Lancer :  node scripts/tests/test-lancement.mjs
import fs from "fs";
import { execSync } from "child_process";
process.env.DATABASE_URL = "postgresql://asm:asm@localhost:5432/asmdb";
fs.rmSync(".test-fin", { recursive: true, force: true });
fs.mkdirSync(".test-fin");
fs.copyFileSync("lib/prisma.js", ".test-fin/prisma.js");
fs.copyFileSync("lib/demo.js", ".test-fin/demo.js");

const { compteDemo, estNumeroDemo, verifierDemo } = await import(process.cwd() + "/.test-fin/demo.js");
const { prisma } = await import(process.cwd() + "/.test-fin/prisma.js");

let ok = 0, ko = 0;
const verif = (nom, cond) => (cond ? (ok++, console.log("  ✓", nom)) : (ko++, console.log("  ✗ ECHEC:", nom)));

// ---------- 1. Compte de démonstration whitelisté ----------
verif("aucune variable → aucun accès démo", compteDemo({}) === null && verifierDemo("+213550000000", "123456", {}) === false);
const legacy = { OTP_TEST_CODE: "123456" };
verif("transition : OTP_TEST_CODE seul → SEUL le numéro par défaut passe",
  verifierDemo("+213550000000", "123456", legacy) === true);
verif("⚠ SÉCURITÉ : un AUTRE numéro avec le bon code est refusé (fin du « tout numéro »)",
  verifierDemo("+213661234567", "123456", legacy) === false &&
  verifierDemo("+33612345678", "123456", legacy) === false);
const cible = { DEMO_TEL: "+213555000111", DEMO_CODE: "778899" };
verif("DEMO_TEL/DEMO_CODE : numéro dédié + code exact acceptés",
  verifierDemo("+213555000111", "778899", cible) === true);
verif("mauvais code refusé même pour le numéro démo", verifierDemo("+213555000111", "123456", cible) === false);
verif("numéro démo reconnu quel que soit le format",
  estNumeroDemo("+213 555 000 111", cible) === true && estNumeroDemo("+213555000112", cible) === false);
verif("DEMO_* prioritaire sur l'ancien OTP_TEST_CODE",
  verifierDemo("+213550000000", "123456", { ...legacy, ...cible }) === false &&
  verifierDemo("+213555000111", "778899", { ...legacy, ...cible }) === true);

// ---------- 2. Préparation assurances / mutuelles (modèle) ----------
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-LA" } } });
await prisma.facture.deleteMany({ where: { numero: { contains: "TESTLA" } } });
await prisma.compteFinancier.deleteMany({ where: { userId: "la-user-1" } });

const dAssur = await prisma.demande.create({
  data: {
    service: "transport", nom: "Assuré TEST-LA", telephone: "0555 42 42 42",
    date: "2026-09-01T09:00", statut: "CONFIRMEE", prisEnChargePar: "CNAS",
  },
});
verif("champ « pris en charge par » stocké sur la demande",
  (await prisma.demande.findUnique({ where: { id: dAssur.id } })).prisEnChargePar === "CNAS");
const cAssur = await prisma.compteFinancier.create({
  data: { numero: "ASM-CL-TESTLA", userId: "la-user-1", type: "pro", nom: "Clinique TEST-LA", convention: "CONV-CNAS-2026-041" },
});
verif("référence de convention stockée sur le compte", cAssur.convention === "CONV-CNAS-2026-041");
const fAssur = await prisma.facture.create({
  data: {
    numero: "ASM-TESTLA-1", compteId: cAssur.id, statut: "EMISE",
    emissionLe: "2026-09-01", echeance: "2026-09-15",
    sousTotal: 6000, total: 6000, paye: 1000, partAssureur: 4200,
  },
});
verif("part assureur stockée sur la facture (reste patient = 800)",
  fAssur.partAssureur === 4200 && fAssur.total - fAssur.partAssureur - fAssur.paye === 800);
verif("part assureur à 0 par défaut (aucun impact sur l'existant)",
  (await prisma.facture.create({
    data: { numero: "ASM-TESTLA-2", compteId: cAssur.id, statut: "EMISE", emissionLe: "2026-09-01", echeance: "2026-09-15", sousTotal: 100, total: 100 },
  })).partAssureur === 0);

// ---------- 3. Contrôles de sécurité automatiques (statiques) ----------
const routesAdmin = execSync("find app/api/admin -name route.js", { encoding: "utf8" }).trim().split("\n");
verif(`toutes les routes admin exigent verifierAdmin (${routesAdmin.length} routes)`,
  routesAdmin.length > 15 && routesAdmin.every((f) => fs.readFileSync(f, "utf8").includes("verifierAdmin")));

const fichiersGit = execSync("git ls-files", { encoding: "utf8" }).split("\n");
verif("aucun fichier .env réel commité", !fichiersGit.some((f) => /^\.env($|\.(?!example))/.test(f)));

const motifsSecrets = /(sk_live|sk_test_[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|xox[bp]-|-----BEGIN (RSA |EC )?PRIVATE KEY)/;
const suspects = fichiersGit.filter((f) => /\.(js|json|md)$/.test(f) && fs.existsSync(f) && motifsSecrets.test(fs.readFileSync(f, "utf8")));
verif("aucun secret reconnaissable dans les fichiers commités", suspects.length === 0);

const routeOtp = fs.readFileSync("app/api/otp-test/route.js", "utf8");
verif("la route OTP ne lit plus OTP_TEST_CODE directement (whitelist lib/demo)",
  !routeOtp.includes("OTP_TEST_CODE") && routeOtp.includes("verifierDemo"));
verif("la route OTP reste rate-limitée", routeOtp.includes("autorise("));

const routeRappels = fs.readFileSync("app/api/rappels/route.js", "utf8");
verif("la route des rappels est protégée par CRON_SECRET quand il est posé",
  routeRappels.includes("CRON_SECRET") && routeRappels.includes("403"));
verif("le cron Vercel est déclaré", JSON.parse(fs.readFileSync("vercel.json", "utf8")).crons?.[0]?.path === "/api/rappels");

const config = fs.readFileSync("next.config.js", "utf8");
verif("en-têtes de sécurité présents (HSTS, nosniff, X-Frame-Options)",
  ["Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options"].every((h) => config.includes(h)));

// ---------- Nettoyage ----------
await prisma.demande.deleteMany({ where: { nom: { contains: "TEST-LA" } } });
await prisma.facture.deleteMany({ where: { numero: { contains: "TESTLA" } } });
await prisma.compteFinancier.deleteMany({ where: { userId: "la-user-1" } });

console.log(`\nRésultat : ${ok} OK / ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
