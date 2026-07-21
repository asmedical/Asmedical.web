// Cercle familial — logique centrale (testable sans Supabase).
// Un « proche » est un compte qui détient un Rattachement de type "proche"
// ACCEPTE vers le téléphone d'un patient : il peut alors réserver pour lui
// (mêmes garde-fous serveur que les établissements), suivre ses demandes
// et recevoir les comptes-rendus de fin d'intervention.
import { prisma } from "@/lib/prisma";
import { normTel } from "@/lib/rattachements";

function expire(r) {
  return Boolean(r.expiration && r.expiration < new Date().toISOString().slice(0, 10));
}

// Réclame un code de rattachement généré par le patient (usage unique, 24 h).
// Retourne { ok, rattachement } ou { erreur }.
export async function reclamerCodeProche(code, { userId, nom }) {
  const propre = String(code || "").trim().toUpperCase();
  if (!propre) return { erreur: "code_invalide" };
  const r = await prisma.rattachement.findUnique({ where: { code: propre } });
  if (!r || r.statut !== "CODE_ATTENTE") return { erreur: "code_invalide" };
  if (r.codeExpire && r.codeExpire < new Date()) return { erreur: "code_expire" };

  // Un même compte ne détient qu'UN lien actif par patient.
  const actifs = await prisma.rattachement.findMany({
    where: { etabUserId: userId, statut: { in: ["ACCEPTE", "EN_ATTENTE"] } },
  });
  if (actifs.some((l) => normTel(l.patientTel) === normTel(r.patientTel))) {
    return { erreur: "deja_rattache" };
  }

  const maj = await prisma.rattachement.update({
    where: { id: r.id },
    data: {
      etabUserId: userId,
      etabNom: String(nom || "Proche").slice(0, 120),
      type: "proche",
      statut: "ACCEPTE",
      decideLe: new Date(),
      code: null,
      codeExpire: null,
    },
  });
  return { ok: true, rattachement: maj };
}

// Demande d'accès par téléphone : le PATIENT devra accepter depuis son
// espace « Autorisations » (statut EN_ATTENTE, jamais d'accès direct).
export async function inviterProche({ userId, nom, patientNom, patientTel, scopes }) {
  if (normTel(patientTel).length < 8) return { erreur: "telephone_invalide" };
  const propres = String(scopes || "transport,domicile,medicaments")
    .split(",").map((s) => s.trim())
    .filter((s) => ["transport", "domicile", "medicaments"].includes(s))
    .join(",");
  const existants = await prisma.rattachement.findMany({
    where: { etabUserId: userId, statut: { in: ["ACCEPTE", "EN_ATTENTE"] } },
  });
  if (existants.some((r) => normTel(r.patientTel) === normTel(patientTel))) {
    return { erreur: "deja_rattache" };
  }
  const r = await prisma.rattachement.create({
    data: {
      patientTel: String(patientTel).trim().slice(0, 20),
      patientNom: String(patientNom || "").slice(0, 120) || null,
      etabUserId: userId,
      etabNom: String(nom || "Proche").slice(0, 120),
      type: "proche",
      statut: "EN_ATTENTE",
      source: "invitation",
      scopes: propres || "transport,domicile,medicaments",
    },
  });
  return { ok: true, rattachement: r };
}

// Liens détenus par un compte (proche OU établissement) + dernières
// demandes de chaque patient — pour « Mes proches » et le tableau Famille.
// Correspondance téléphone insensible au format.
export async function mesProches(userId, { demandesParProche = 5 } = {}) {
  const liens = await prisma.rattachement.findMany({
    where: { etabUserId: userId, statut: { in: ["EN_ATTENTE", "ACCEPTE", "REFUSE", "REVOQUE"] } },
    orderBy: { creeLe: "desc" },
    take: 100,
  });
  const { idsDemandesParTel } = await import("@/lib/telephones");
  const resultat = [];
  for (const r of liens) {
    let demandes = [];
    if (r.statut === "ACCEPTE" && !expire(r)) {
      const ids = await idsDemandesParTel(normTel(r.patientTel), demandesParProche);
      demandes = await prisma.demande.findMany({
        where: { id: { in: ids } },
        orderBy: { date: "desc" },
        take: demandesParProche,
        select: {
          id: true, service: true, date: true, statut: true, prioritaire: true,
          depart: true, destination: true, compteRendu: true, finLe: true,
          transporteur: { select: { nom: true, vehicule: true, vehiculeCouleur: true, vehiculeImmat: true } },
          soignant: { select: { prenom: true, nom: true } },
        },
      });
    }
    resultat.push({
      id: r.id, patientNom: r.patientNom, patientTel: r.patientTel,
      statut: r.statut, scopes: r.scopes, expiration: r.expiration,
      type: r.type, creeLe: r.creeLe, expiree: expire(r), demandes,
    });
  }
  return resultat;
}

// Comptes autorisés (proches ET établissements) à être informés pour ce
// patient et ce service — rattachement ACCEPTE, non expiré, scope couvert.
export async function prochesAutorises(patientTel, service) {
  const cle = normTel(patientTel);
  if (!cle) return [];
  const liens = await prisma.rattachement.findMany({ where: { statut: "ACCEPTE" } });
  return liens.filter((r) => {
    if (normTel(r.patientTel) !== cle || expire(r) || !r.etabUserId) return false;
    const scopes = String(r.scopes || "").split(",").map((s) => s.trim());
    return !service || scopes.includes(service);
  });
}

// Compte-rendu de fin d'intervention partagé aux proches autorisés :
// notification interne + push (l'email est laissé aux relances financières).
export async function notifierProchesFin(demande) {
  if (!demande || demande.statut !== "TERMINEE") return 0;
  const liens = await prochesAutorises(demande.telephone, demande.service);
  const LIB = { transport: "Transport", domicile: "Aide à domicile", medicaments: "Livraison de médicaments" };
  let envoyees = 0;
  for (const lien of liens) {
    const qui = demande.nom || lien.patientNom || "votre proche";
    const corps =
      `${LIB[demande.service] || "Prestation"} du ${String(demande.date || "").slice(0, 10)} terminée pour ${qui}.` +
      (demande.compteRendu ? ` Compte-rendu : ${String(demande.compteRendu).slice(0, 300)}` : "");
    try {
      await prisma.notification.create({
        data: {
          userId: lien.etabUserId, type: "rdv",
          titre: `Intervention terminée — ${qui}`,
          corps, auteur: "ASM", statut: "NON_LU",
        },
      });
      const { envoyerPush } = await import("@/lib/pushEnvoi");
      await envoyerPush(lien.etabUserId, {
        titre: `Intervention terminée — ${qui}`,
        corps: corps.slice(0, 160),
        url: "/compte/proches",
      });
      envoyees++;
    } catch {}
  }
  return envoyees;
}
