// ─────────────────────────────────────────────────────────────────────────
// Captures d'écran du DOSSIER FONCTIONNEL ASM (business plan).
//
// Environnement 100 % LOCAL de démonstration :
//  - serveur Next local + base PostgreSQL locale (données fictives seed-demo)
//  - AUCUN appel vers la production, AUCUNE donnée réelle
//  - l'authentification est simulée dans le navigateur (session factice +
//    interception réseau) : les écrans capturés sont les vrais écrans du site.
//
// Chaque capture porte une mention CENTRALE indiquant que les noms, numéros
// et comptes affichés sont fictifs (exigence du dossier).
// ─────────────────────────────────────────────────────────────────────────
import { chromium } from "playwright-core";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://asm:asm@localhost:5432/asmdb";
const prisma = new PrismaClient();

const BASE = process.env.CAPTURE_BASE || "http://localhost:3100";
const SORTIE = "business-plan-assets";
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const MENTION =
  "Capture de démonstration — noms, numéros et comptes fictifs, utilisés uniquement pour illustrer ce dossier.";

// ---- Personas de démonstration (fictifs) ----
const PERSONAS = {
  patient: {
    id: "demo-patient-1", phone: "+213555010203", email: "mahmoud.benali.demo@example.com",
    profil: { id: "demo-patient-1", role: "patient", prenom: "Mahmoud", nom: "Benali", telephone: "0555 01 02 03", email: "mahmoud.benali.demo@example.com", commune: "Alger-Centre", contact: "Fille — Samia B. (0661 00 00 00)", etablissement: null, cree_le: "2026-05-02T10:00:00Z" },
    espace: "patient",
  },
  etab: {
    id: "demo-etab-1", phone: "+21323456789", email: "contact.dialyse.demo@example.com",
    profil: { id: "demo-etab-1", role: "pro", prenom: null, nom: null, etablissement: "Centre de dialyse Alger", contact: "Secrétariat — Mme Ferhat", telephone: "023 45 67 89", email: "contact.dialyse.demo@example.com", commune: "Alger-Centre", cree_le: "2026-04-20T09:00:00Z" },
    espace: "pro",
  },
  superadmin: {
    id: "demo-admin-1", phone: "+213550000001", email: "direction.demo@example.com",
    profil: { id: "demo-admin-1", role: "superadmin", prenom: "Karima", nom: "S.", telephone: "0550 00 00 01", email: "direction.demo@example.com", cree_le: "2026-03-01T09:00:00Z" },
    espace: "patient",
  },
  moderateur: {
    id: "demo-mod-1", phone: "+213550000002", email: "regulation.demo@example.com",
    profil: { id: "demo-mod-1", role: "moderateur", prenom: "Amel", nom: "T.", telephone: "0550 00 00 02", email: "regulation.demo@example.com", cree_le: "2026-03-10T09:00:00Z" },
    espace: "patient",
  },
  chauffeur: {
    id: "demo-chauffeur-1", phone: "+213770123456", email: null,
    profil: { id: "demo-chauffeur-1", role: "chauffeur", prenom: "Karim", nom: "Mansouri", telephone: "0770 12 34 56", cree_le: "2026-04-01T09:00:00Z" },
    espace: "patient",
  },
};

// Sérialise proprement (Dates → ISO).
const j = (o) => JSON.parse(JSON.stringify(o));

// ---- Données dynamiques tirées de la base de démonstration locale ----
async function chargerDonnees() {
  const demandes = await prisma.demande.findMany({
    orderBy: { creeLe: "desc" },
    include: {
      soignant: { select: { id: true, prenom: true, nom: true, telephone: true, photoUrl: true } },
      transporteur: { select: { id: true, nom: true, telephone: true, photoUrl: true, vehicule: true, vehiculeCouleur: true, vehiculeImmat: true } },
      avis: { select: { note: true, commentaire: true } },
      abonnement: true,
    },
  });
  const soignants = await prisma.soignant.findMany({ orderBy: { prenom: "asc" } });
  const transporteurs = await prisma.transporteur.findMany({ orderBy: { nom: "asc" } });
  const rattachements = await prisma.rattachement.findMany({ orderBy: { creeLe: "desc" } });
  const notifications = await prisma.notification.findMany({ orderBy: { creeLe: "desc" } });
  const messages = await prisma.message.findMany({ orderBy: { creeLe: "asc" } });
  const journal = await prisma.journal.findMany({ orderBy: { creeLe: "desc" } });
  return j({ demandes, soignants, transporteurs, rattachements, notifications, messages, journal });
}

// ---- Réponses simulées des API (mêmes formes que les vraies routes) ----
function reponsesApi(persona, D) {
  const p = PERSONAS[persona];
  const tel8 = (s) => String(s || "").replace(/\D/g, "").slice(-8);
  const mesDemandes =
    persona === "etab"
      ? D.demandes.filter((d) => d.parEtabUserId === p.id)
      : D.demandes.filter((d) => tel8(d.telephone) === tel8(p.profil.telephone));

  const auj = new Date().toISOString().slice(0, 10);
  const stats = {
    aRappeler: 0, duJour: D.demandes.filter((d) => d.date?.startsWith(auj)).length,
    prioritaires: 0, enCours: 1, enRetard: 0, nonConfirmees: 2, problemes: 0,
    soignantsAttente: 1, transporteursAttente: 0,
    soignantsActifs: D.soignants.length, transporteursActifs: D.transporteurs.length,
    comptesEmployes: 3, abonnementsActifs: 2, messagesNonLus: 1, suppressionsAttente: 1,
    clients: 4, dernieres: D.demandes.slice(0, 5),
  };

  const clientsListe = [
    PERSONAS.patient.profil,
    { id: "demo-patient-2", role: "patient", prenom: "Yasmina", nom: "Kaci", telephone: "0666 07 08 09", email: null, commune: "El Biar", cree_le: "2026-06-01T09:00:00Z" },
    { id: "demo-patient-3", role: "patient", prenom: "Fatima Zohra", nom: "Ait", telephone: "0555 06 07 08", email: null, commune: "Kouba", cree_le: "2026-06-10T09:00:00Z" },
    { id: "demo-patient-4", role: "patient", prenom: "Rachid", nom: "Meziane", telephone: "0777 03 04 05", email: null, commune: "Hydra", cree_le: "2026-06-15T09:00:00Z" },
  ];

  return {
    "/api/mes-demandes": { demandes: mesDemandes },
    "/api/notifications?compteur=1": { notifs: 2, chat: 1 },
    "/api/notifications": { notifications: D.notifications },
    "/api/messages": { messages: D.messages },
    "/api/rattachements": {
      rattachements: D.rattachements.filter((r) => tel8(r.patientTel) === tel8(p.profil.telephone) && r.statut !== "CODE_ATTENTE"),
      codeActif: null,
    },
    "/api/pro/rattachements": { rattachements: D.rattachements.filter((r) => r.etabUserId === "demo-etab-1") },
    "/api/employe/moi": {
      role: "chauffeur", estChauffeur: true, prenom: "Karim", nom: "Mansouri", mustChangePassword: false,
      intervenant: {
        id: 1, nom: "Karim Mansouri", photoUrl: null, statut: "VALIDE", dispo: "DISPONIBLE",
        telephone: "0770 12 34 56", communes: "Alger-Centre, Hussein Dey, El Harrach",
        heureDebut: 6, heureFin: 20, joursOff: "", conges: "",
        vehicule: "Renault Trafic aménagé", vehiculeCouleur: "blanc", vehiculeImmat: "01234-119-16",
        typeTransport: "accompagne", qualification: null, specialites: "fauteuil roulant, oxygène",
      },
      interventions: D.demandes.filter((d) => d.transporteur?.nom === "Karim Mansouri").map((d) => ({
        id: d.id, service: d.service, date: d.date, statut: d.statut, destination: d.destination,
        depart: d.depart, nom: d.nom, telephone: d.telephone, sousMode: d.sousMode, prioritaire: d.prioritaire, fenetre: d.fenetre,
      })),
    },
    "/api/employe/intervention": (() => {
      const d = D.demandes.find((x) => x.transporteur?.nom === "Karim Mansouri" && x.statut === "AFFECTEE") || D.demandes[0];
      return {
        estChauffeur: true,
        intervention: {
          id: d.id, service: d.service, serviceLib: "Transport", typeTrajet: d.typeTrajet, date: d.date,
          statut: d.statut, etape: "en_route", prioritaire: false, fenetre: d.fenetre,
          client: { nom: d.nom, telephone: d.telephone }, depart: d.depart, destination: d.destination,
          notes: "Patient en fauteuil roulant — prévoir la rampe.", consignes: { besoins: ["fauteuil"], acces: "Interphone 12", code: null },
          accepteeLe: d.accepteeLe, enRouteLe: d.enRouteLe, arriveeLe: null, debutLe: null, finLe: null,
          problemeLe: null, problemeTexte: null, compteRendu: null,
        },
      };
    })(),
    "/api/admin/stats": stats,
    "/api/admin/demandes": { demandes: D.demandes, total: D.demandes.length, page: 1, pages: 1 },
    "/api/admin/planning": { demandes: D.demandes, soignants: D.soignants, transporteurs: D.transporteurs },
    "/api/admin/clients?type=pro": { clients: [PERSONAS.etab.profil] },
    "/api/admin/clients?id=demo-patient-1": {
      profil: PERSONAS.patient.profil,
      demandes: D.demandes.filter((d) => tel8(d.telephone) === tel8(PERSONAS.patient.profil.telephone)),
      rattachements: D.rattachements.filter((r) => tel8(r.patientTel) === tel8(PERSONAS.patient.profil.telephone)),
      documents: [],
    },
    "/api/admin/clients?id=demo-etab-1": {
      profil: PERSONAS.etab.profil,
      demandes: D.demandes.filter((d) => d.parEtabUserId === "demo-etab-1"),
      rattachements: D.rattachements.filter((r) => r.etabUserId === "demo-etab-1"),
      documents: [],
    },
    "/api/admin/clients": { clients: clientsListe },
    "/api/admin/equipe": {
      membres: [PERSONAS.superadmin.profil, PERSONAS.moderateur.profil, { id: "demo-std-1", role: "standardiste", prenom: "Sonia", nom: "B.", telephone: "0550 00 00 03", email: null }],
      journal: D.journal,
      monRole: persona === "moderateur" ? "moderateur" : "superadmin",
    },
    "/api/admin/suppressions": {
      demandes: [
        { id: 1, cibleType: "client", cibleId: "demo-doublon-1", cibleNom: "Compte doublon — M. B.", motif: "Doublon de compte (deux numéros)", demandePar: "Amel T. (modératrice)", statut: "EN_ATTENTE", creeLe: new Date().toISOString() },
        { id: 2, cibleType: "soignant", cibleId: "9", cibleNom: "Fiche test", motif: "Fiche de test", demandePar: "Amel T. (modératrice)", statut: "VALIDEE", decidePar: "Karima S.", creeLe: new Date().toISOString() },
      ],
    },
    "/api/admin/historique": { entrees: D.journal.map((e, i) => ({ id: i + 1, action: e.action, detail: e.detail, auteur: e.auteur, creeLe: e.creeLe })) },
    "/api/admin/notes": { notes: [] },
    "/api/admin/recherche": { resultats: null },
    "/api/admin/notifications": { notifications: [] },
    "/api/admin/messages": { conversations: [] },
    "/api/admin/soignants": { soignants: D.soignants },
    "/api/admin/transporteurs": { transporteurs: D.transporteurs },
    "/api/admin/abonnements": { abonnements: [] },
  };
}

// ---- Session navigateur factice (démonstration locale uniquement) ----
function scriptSession(persona) {
  const p = PERSONAS[persona];
  const session = {
    access_token: "demo-token-" + persona,
    refresh_token: "demo-refresh",
    token_type: "bearer",
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    user: { id: p.id, aud: "authenticated", role: "authenticated", phone: p.phone?.replace("+", "") || "", email: p.email || "", user_metadata: {}, app_metadata: {}, created_at: "2026-05-01T00:00:00Z" },
  };
  return `
    localStorage.setItem("sb-demo-auth-token", ${JSON.stringify(JSON.stringify(session))});
    localStorage.setItem("asm_langue", "fr");
    sessionStorage.setItem("asm_connecte", ${JSON.stringify(p.espace)});
    sessionStorage.setItem("asm_espace", ${JSON.stringify(p.espace)});
  `;
}

// ---- Plan de capture ----
const PLAN = [
  // Espace patient (mobile — usage réel iPhone)
  { fichier: "02-patient/patient-01-accueil.png", url: "/accueil", persona: null, mobile: true },
  { fichier: "02-patient/patient-02-choix-espace.png", url: "/role", persona: null, mobile: true },
  { fichier: "02-patient/patient-03-connexion-rapide.png", url: "/connexion", persona: null, mobile: true, pleinePage: true, mentionHaut: "31%" },
  { fichier: "02-patient/patient-04-connexion-identifiant.png", url: "/connexion?mode=identifiant", persona: null, mobile: true },
  { fichier: "02-patient/patient-05-tableau-de-bord.png", url: "/tableau", persona: "patient", mobile: true },
  { fichier: "09-reservations/patient-06-transport-medical.png", url: "/rdv", persona: "patient", mobile: true, service: "transport", pleinePage: true },
  { fichier: "09-reservations/patient-07-aide-domicile.png", url: "/rdv", persona: "patient", mobile: true, service: "domicile", pleinePage: true },
  { fichier: "09-reservations/patient-08-livraison-medicaments.png", url: "/rdv", persona: "patient", mobile: true, service: "medicaments", pleinePage: true },
  { fichier: "02-patient/patient-09-suivi-vehicule.png", url: "/suivi?id={ID_TRANSPORT}", persona: "patient", mobile: true, defiler: ".suivi-vehicule", mentionHaut: "26%" },
  { fichier: "07-messagerie/patient-10-messagerie.png", url: "/messagerie", persona: "patient", mobile: true },
  { fichier: "02-patient/patient-11-procurations.png", url: "/autorisations", persona: "patient", mobile: true, pleinePage: true },

  // Espace établissement
  { fichier: "03-etablissement/etablissement-01-tableau-de-bord.png", url: "/pro", persona: "etab", mobile: true, pleinePage: true },

  // Espace employé / logistique
  { fichier: "10-logistique/employe-01-espace-chauffeur.png", url: "/employe", persona: "chauffeur", mobile: true, pleinePage: true },
  { fichier: "10-logistique/employe-02-fiche-mission.png", url: "/employe/interventions/1", persona: "chauffeur", mobile: true, pleinePage: true },

  // Centre de gestion (desktop)
  { fichier: "05-administrateur/admin-01-tableau-de-bord.png", url: "/admin", persona: "superadmin" },
  { fichier: "05-administrateur/admin-02-planning-regulation.png", url: "/admin/planning", persona: "superadmin" },
  { fichier: "05-administrateur/admin-03-demandes.png", url: "/admin/demandes", persona: "superadmin" },
  { fichier: "05-administrateur/admin-04-fiche-patient.png", url: "/admin/clients", persona: "superadmin", clic: "Mahmoud", pleinePage: true },
  { fichier: "03-etablissement/admin-05-fiche-etablissement.png", url: "/admin/clients", persona: "superadmin", clics: ["🏥 Établissements", "Centre de dialyse Alger"], pleinePage: true },
  { fichier: "06-super-admin/superadmin-01-equipe-privileges.png", url: "/admin/equipe", persona: "superadmin", pleinePage: true },
  { fichier: "06-super-admin/superadmin-02-exports.png", url: "/admin/exports", persona: "superadmin" },
  { fichier: "04-moderateur/moderateur-01-tableau-de-bord.png", url: "/admin", persona: "moderateur" },
];

async function main() {
  const D = await chargerDonnees();
  const navigateur = await chromium.launch({ executablePath: CHROME, headless: true });
  const rapport = [];

  for (const etape of PLAN) {
    const mobile = !!etape.mobile;
    const contexte = await navigateur.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      deviceScaleFactor: 2,
      locale: "fr-FR",
      timezoneId: "Africa/Algiers",
    });

    // Session + espace simulés AVANT le chargement de la page.
    if (etape.persona) await contexte.addInitScript(scriptSession(etape.persona));
    else await contexte.addInitScript(`localStorage.setItem("asm_langue","fr");`);
    if (etape.service) await contexte.addInitScript(`sessionStorage.setItem("asm_service", ${JSON.stringify(etape.service)});`);

    // Gèle les animations pour des captures nettes.
    await contexte.addInitScript(`
      const st = document.createElement("style");
      st.textContent = "*{animation-duration:0s!important;transition-duration:0s!important}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st));
    `);

    // Interception Supabase (auth + profils) — tout reste local.
    const reponses = etape.persona ? reponsesApi(etape.persona, D) : {};
    await contexte.route("**demo.supabase.co/**", async (route) => {
      const url = route.request().url();
      const persona = etape.persona ? PERSONAS[etape.persona] : null;
      if (url.includes("/auth/v1/user")) {
        return route.fulfill({ json: persona ? { id: persona.id, aud: "authenticated", phone: persona.phone?.replace("+", ""), email: persona.email || "", user_metadata: {}, app_metadata: {}, created_at: "2026-05-01T00:00:00Z" } : {}, status: persona ? 200 : 401 });
      }
      if (url.includes("/rest/v1/profil")) {
        const m = /id=eq\.([\w-]+)/.exec(url);
        const cible = Object.values(PERSONAS).find((x) => x.id === m?.[1]);
        const objet = route.request().headers()["accept"]?.includes("pgrst.object");
        const corps = cible ? cible.profil : null;
        return route.fulfill({ json: objet ? corps : corps ? [corps] : [] });
      }
      return route.fulfill({ json: {} });
    });

    // Interception des API applicatives protégées (réponses de démonstration).
    await contexte.route("**/api/**", async (route) => {
      const u = new URL(route.request().url());
      const chemin = u.pathname + (u.search || "");
      if (route.request().method() !== "GET") return route.fulfill({ json: { ok: true } });
      // Endpoints publics : le serveur local répond avec la base de démo.
      if (["/api/actes", "/api/creneaux", "/api/reglages", "/api/otp-canal", "/api/otp-test"].some((p) => u.pathname === p)) {
        return route.fallback();
      }
      // Correspondance la plus spécifique d'abord.
      const cles = Object.keys(reponses).sort((a, b) => b.length - a.length);
      const cle = cles.find((k) => (k.includes("?") ? chemin.startsWith(k) || chemin.includes(k) : u.pathname === k.split("?")[0] && chemin.startsWith(k)));
      if (cle) return route.fulfill({ json: reponses[cle] });
      return route.fulfill({ json: {} });
    });

    const page = await contexte.newPage();
    const dest = path.join(SORTIE, etape.fichier);
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    try {
      const idTransport = D.demandes.find((x) => x.service === "transport" && x.nom === "Mahmoud Benali")?.id || "";
      await page.goto(BASE + etape.url.replace("{ID_TRANSPORT}", idTransport), { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(1400);
      if (etape.pleinePage) {
        await page.addStyleTag({ content: "nav.barre,.bulle-assistant,.adm-tabbar{display:none!important}" });
      }
      if (etape.defiler) {
        await page.waitForSelector(etape.defiler, { timeout: 8000 });
        await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: "center" }), etape.defiler);
        await page.waitForTimeout(500);
      }
      for (const clic of etape.clics || (etape.clic ? [etape.clic] : [])) {
        await page.getByText(clic).first().click({ timeout: 8000 });
        await page.waitForTimeout(1600);
      }
      // Mention centrale : données fictives (exigence du dossier).
      await page.evaluate(({ txt, haut }) => {
        const d = document.createElement("div");
        d.textContent = txt;
        Object.assign(d.style, {
          position: "fixed", top: haut || "50%", left: "50%", transform: "translate(-50%,-50%)",
          zIndex: 999999, background: "rgba(10,82,48,.88)", color: "#fff",
          padding: "12px 20px", borderRadius: "14px", textAlign: "center",
          font: "700 13.5px/1.45 'Nunito Sans',sans-serif", maxWidth: "84%",
          boxShadow: "0 8px 30px rgba(0,0,0,.3)", pointerEvents: "none",
          border: "1px solid rgba(255,255,255,.35)",
        });
        document.body.appendChild(d);
      }, { txt: MENTION, haut: etape.mentionHaut });
      await page.waitForTimeout(250);
      await page.screenshot({ path: dest, fullPage: !!etape.pleinePage });
      rapport.push({ fichier: etape.fichier, statut: "OK" });
      console.log("✓", etape.fichier);
    } catch (e) {
      rapport.push({ fichier: etape.fichier, statut: "ECHEC : " + e.message.split("\n")[0] });
      console.log("✗", etape.fichier, "—", e.message.split("\n")[0]);
    }
    await contexte.close();
  }

  await navigateur.close();
  fs.writeFileSync(path.join(SORTIE, "rapport-captures.json"), JSON.stringify(rapport, null, 2));
  const echecs = rapport.filter((r) => r.statut !== "OK").length;
  console.log(`\n${rapport.length - echecs}/${rapport.length} captures réussies.`);
  process.exit(echecs ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
