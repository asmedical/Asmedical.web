// PAIEMENT À LA RÉSERVATION — logique centrale (testable sans Supabase).
// Toute réservation payante passe par un écran de paiement qui détecte,
// CÔTÉ SERVEUR, la situation réelle du client :
//   gratuit | deja_regle | abonne (couvert) | a_payer
// Moyens à la réservation : abonnement, ticket prépayé d'agence, paiement
// en ligne (fournisseur réel OU simulation clairement étiquetée), ou
// « je paierai à la prestation » (comportement historique, conservé).
//
// La confirmation d'un paiement en ligne réel ne vient JAMAIS du
// navigateur : uniquement du webhook signé (architecture existante).
// La couche fournisseur (lib/paiements) reste l'unique point de branchement
// pour SATIM / CIB / EDAHABIA / Visa / Mastercard plus tard.
import { prisma } from "@/lib/prisma";
import { cleTel } from "@/lib/telephones";
import {
  estimerPrestation, compteFinancierPour, comptePayeurPour, prochainNumero, creerFacture,
} from "@/lib/finances";

const auj = () => new Date().toISOString().slice(0, 10);

// ---- Abonnements ----

// La souscription ACTIVE d'un compte couvrant un service donné, quota
// mensuel compris — ou null. Fait expirer au passage les souscriptions
// dont la date de fin est dépassée (paresseux, sans tâche planifiée).
export async function souscriptionCouvrant(compteId, service, { date } = {}) {
  if (!compteId) return null;
  await prisma.souscription.updateMany({
    where: { compteId, statut: "ACTIF", fin: { not: null, lt: auj() } },
    data: { statut: "EXPIRE" },
  });
  const souscriptions = await prisma.souscription.findMany({
    where: { compteId, statut: "ACTIF" },
    include: { plan: true },
    orderBy: { creeLe: "desc" },
  });
  const mois = String(date || auj()).slice(0, 7);
  for (const s of souscriptions) {
    if (!s.plan?.actif) continue;
    if (s.plan.service && s.plan.service !== service) continue;
    if (s.plan.quantiteIncluse) {
      const utilisees = await prisma.demande.count({
        where: { souscriptionId: s.id, statut: { not: "ANNULEE" }, date: { startsWith: mois } },
      });
      if (utilisees >= s.plan.quantiteIncluse) continue; // quota du mois atteint
    }
    return s;
  }
  return null;
}

// ---- Contexte de l'écran de paiement ----

// Le client (patient, proche réservataire ou établissement) est-il légitime
// sur cette demande ? — mêmes règles que le reste du site.
export function possedeDemande(demande, { userId, telephone }) {
  if (!demande) return false;
  // Rattachement au compte : fiable même si le téléphone du compte diffère
  // (connexion Google sans numéro, numéro tapé autrement…).
  if (userId && demande.creeParUserId && demande.creeParUserId === userId) return true;
  const cle = cleTel(telephone);
  if (cle && cleTel(demande.telephone) === cle) return true;
  return Boolean(demande.parEtabUserId && demande.parEtabUserId === userId);
}

export async function contextePaiement(demandeId, { userId, telephone } = {}) {
  const demande = await prisma.demande.findUnique({ where: { id: Number(demandeId) } });
  if (!possedeDemande(demande, { userId, telephone })) return { erreur: "introuvable" };
  if (demande.statut === "ANNULEE") return { erreur: "annulee" };

  const base = { demande: { id: demande.id, service: demande.service, date: demande.date } };

  // Déjà réglée ? (prépaiement confirmé, ticket utilisé, ou facture payée)
  const prepaye = await prisma.paiement.findFirst({
    where: { demandeId: demande.id, statut: "CONFIRME" },
  });
  if (prepaye) {
    return { ...base, etat: "deja_regle", moyen: prepaye.moyen, reference: prepaye.reference, simulation: prepaye.fournisseur === "simulation" };
  }
  const facture = await prisma.facture.findFirst({
    where: { demandeId: demande.id, statut: "PAYEE" },
  });
  if (facture) return { ...base, etat: "deja_regle", reference: facture.numero };

  // Couverte par un abonnement déjà appliqué ?
  if (demande.souscriptionId) {
    const s = await prisma.souscription.findUnique({ where: { id: demande.souscriptionId }, include: { plan: true } });
    if (s) return { ...base, etat: "abonne", plan: { nom: s.plan.nom, id: s.plan.id }, applique: true };
  }

  // Estimation aux tarifs en vigueur (mêmes règles que la facture finale).
  const compte = userId ? await prisma.compteFinancier.findUnique({ where: { userId } }) : null;
  const est = await estimerPrestation({
    service: demande.service, date: demande.date, dureeMin: demande.dureeMin,
    typeTrajet: demande.typeTrajet, prioritaire: demande.prioritaire,
    compteId: compte?.id, packId: demande.packId,
  });
  const montant = est?.total ?? null;

  // Prestation gratuite (tarifs non configurés → estimation nulle : on ne
  // bloque JAMAIS la réservation, l'équipe confirme le prix au rappel).
  if (montant !== null && montant <= 0) return { ...base, etat: "gratuit" };

  // Abonnement actif couvrant ce service ?
  if (compte) {
    const s = await souscriptionCouvrant(compte.id, demande.service, { date: demande.date });
    if (s) return { ...base, etat: "abonne", plan: { nom: s.plan.nom, id: s.plan.id }, applique: false };
  }

  // À payer : moyens réels + simulation si le réglage l'active.
  const reglage = await prisma.reglage.findUnique({ where: { id: 1 } });
  const plans = await prisma.planAbonnement.findMany({
    where: { actif: true },
    orderBy: [{ ordre: "asc" }, { prix: "asc" }],
    select: { id: true, nom: true, prix: true, description: true, frequence: true, service: true, quantiteIncluse: true, populaire: true },
  });
  return {
    ...base,
    etat: "a_payer",
    montant,
    estimation: est?.lignes || null,
    codePromo: demande.codePromo || null,
    simulation: Boolean(reglage?.paiementSimulation),
    plans, // incitation : découvrir les abonnements avant de payer
  };
}

// ---- Couverture par abonnement (le « paiement » de l'abonné) ----
export async function couvrirParAbonnement(demandeId, { userId, telephone } = {}) {
  const demande = await prisma.demande.findUnique({ where: { id: Number(demandeId) } });
  if (!possedeDemande(demande, { userId, telephone })) return { erreur: "introuvable" };
  if (demande.souscriptionId) return { deja: true };
  const compte = userId ? await prisma.compteFinancier.findUnique({ where: { userId } }) : null;
  if (!compte) return { erreur: "sans_compte" };
  const s = await souscriptionCouvrant(compte.id, demande.service, { date: demande.date });
  if (!s) return { erreur: "non_couvert" };
  await prisma.demande.update({ where: { id: demande.id }, data: { souscriptionId: s.id } });
  await prisma.journal.create({
    data: {
      auteur: "Paiement réservation", action: "paiement.abonnement", entite: "demande",
      entiteId: String(demande.id), detail: `couverte par l'abonnement ${s.plan.nom} (souscription n°${s.id})`,
    },
  });
  return { ok: true, plan: s.plan };
}

// ---- Ticket prépayé d'agence ----

export function ticketValide(t, service) {
  if (!t || !t.actif) return { erreur: "ticket_invalide" };
  if (t.expireLe && t.expireLe < auj()) return { erreur: "ticket_expire" };
  if (t.usages >= t.maxUsages) return { erreur: "ticket_epuise" };
  const services = String(t.services || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (services.length && service && !services.includes(service)) return { erreur: "ticket_service" };
  return { ok: true };
}

// Utilise un ticket pour UNE demande : transactionnel, usage unique par
// demande, compteur borné par maxUsages même en cas d'appels simultanés.
// Toute tentative invalide est journalisée (détection de fraude).
export async function utiliserTicket(code, demandeId, { userId, telephone } = {}) {
  const propre = String(code || "").trim().toUpperCase();
  const demande = await prisma.demande.findUnique({ where: { id: Number(demandeId) } });
  if (!possedeDemande(demande, { userId, telephone })) return { erreur: "introuvable" };

  const t = propre ? await prisma.ticketPrepaye.findUnique({ where: { code: propre } }) : null;
  const verdict = ticketValide(t, demande.service);
  if (!verdict.ok) {
    // Fraude / erreur : tracée avec le téléphone du compte. On attend l'écriture
    // (insertion minime) pour que la trace soit garantie avant de refuser.
    await prisma.journal.create({
      data: {
        auteur: "Paiement réservation", action: "paiement.ticket.refus", entite: "demande",
        entiteId: String(demande.id), detail: `code « ${propre.slice(0, 20)} » refusé (${verdict.erreur})`,
      },
    }).catch(() => {});
    return verdict;
  }

  // Montant couvert = estimation actuelle (traçabilité de l'historique).
  const est = await estimerPrestation({
    service: demande.service, date: demande.date, dureeMin: demande.dureeMin,
    typeTrajet: demande.typeTrajet, prioritaire: demande.prioritaire, packId: demande.packId,
  });
  const montant = Math.max(0, est?.total ?? 0);
  const compte = await comptePayeurPour(demande) ||
    (userId ? await compteFinancierPour(userId, { telephone: demande.telephone, prenom: demande.nom }) : null);
  if (!compte) return { erreur: "sans_compte" };

  try {
    return await prisma.$transaction(async (tx) => {
      // Compteur borné ATOMIQUEMENT : ne passe que si une place reste.
      const verrou = await tx.ticketPrepaye.updateMany({
        where: { id: t.id, actif: true, usages: { lt: t.maxUsages } },
        data: { usages: { increment: 1 } },
      });
      if (verrou.count === 0) throw Object.assign(new Error("epuise"), { code: "EPUISE" });
      await tx.ticketPrepayeUsage.create({
        data: { ticketId: t.id, demandeId: demande.id, telCle: cleTel(demande.telephone), montant },
      });
      const reference = await prochainNumero(tx, "paiement", "ASM-P-");
      const paiement = await tx.paiement.create({
        data: {
          reference, compteId: compte.id, demandeId: demande.id,
          moyen: "ticket", fournisseur: "interne", refFournisseur: t.code,
          montant, statut: "CONFIRME", confirmeLe: new Date(),
        },
      });
      await tx.journal.create({
        data: {
          auteur: "Paiement réservation", action: "paiement.ticket", entite: "demande",
          entiteId: String(demande.id), detail: `ticket ${t.code} accepté · ${montant} DZD · reçu ${reference}`,
        },
      });
      return { ok: true, paiement, ticket: { code: t.code, libelle: t.libelle } };
    });
  } catch (e) {
    if (e.code === "EPUISE") return { erreur: "ticket_epuise" };
    if (String(e.code) === "P2002") {
      // Même ticket déjà utilisé pour CETTE demande : idempotent — la
      // transaction annulée a déjà restitué l'incrément du compteur.
      return { deja: true };
    }
    throw e;
  }
}

// ---- Simulation de paiement (avant SATIM) ----
// Activable UNIQUEMENT par le réglage superadmin. Chaque opération est
// enregistrée comme un vrai paiement mais étiquetée fournisseur
// « simulation » — visible sur les reçus, l'admin et les exports.
export async function paiementSimule(demandeId, { moyen, resultat, userId, telephone } = {}) {
  const reglage = await prisma.reglage.findUnique({ where: { id: 1 } });
  if (!reglage?.paiementSimulation) return { erreur: "simulation_desactivee" };
  const demande = await prisma.demande.findUnique({ where: { id: Number(demandeId) } });
  if (!possedeDemande(demande, { userId, telephone })) return { erreur: "introuvable" };
  const STATUTS = { accepte: "CONFIRME", refuse: "ECHOUE", annule: "ANNULE" };
  const statut = STATUTS[resultat];
  if (!statut) return { erreur: "resultat_invalide" };
  const deja = await prisma.paiement.findFirst({ where: { demandeId: demande.id, statut: "CONFIRME" } });
  if (deja) return { deja: true, paiement: deja };

  const est = await estimerPrestation({
    service: demande.service, date: demande.date, dureeMin: demande.dureeMin,
    typeTrajet: demande.typeTrajet, prioritaire: demande.prioritaire, packId: demande.packId,
  });
  const montant = Math.max(0, est?.total ?? 0);
  const compte = await comptePayeurPour(demande) ||
    (userId ? await compteFinancierPour(userId, { telephone: demande.telephone, prenom: demande.nom }) : null);
  if (!compte) return { erreur: "sans_compte" };

  const paiement = await prisma.$transaction(async (tx) => {
    const reference = await prochainNumero(tx, "paiement", "ASM-P-");
    return tx.paiement.create({
      data: {
        reference, compteId: compte.id, demandeId: demande.id,
        moyen: ["cib", "edahabia"].includes(moyen) ? moyen : "cib",
        fournisseur: "simulation", montant, statut,
        confirmeLe: statut === "CONFIRME" ? new Date() : null,
      },
    });
  });
  await prisma.journal.create({
    data: {
      auteur: "Paiement réservation", action: "paiement.simulation", entite: "demande",
      entiteId: String(demande.id), detail: `SIMULATION ${resultat} · ${montant} DZD · ${paiement.reference}`,
    },
  });
  return { ok: true, paiement, resultat };
}

// ---- Imputation des prépaiements à la clôture ----
// À la facturation, les paiements confirmés faits À LA RÉSERVATION sont
// rattachés à la facture et imputés (plafonnés au restant dû).
export async function appliquerPrepaiements(facture, demandeId) {
  const prepayes = await prisma.paiement.findMany({
    where: { demandeId: Number(demandeId), statut: "CONFIRME", factureId: null },
    orderBy: { creeLe: "asc" },
  });
  let imputes = 0;
  for (const p of prepayes) {
    await prisma.$transaction(async (tx) => {
      const f = await tx.facture.findUnique({ where: { id: facture.id } });
      const du = Math.max(0, f.total - f.paye);
      const part = Math.min(p.montant, du);
      await tx.paiement.update({ where: { id: p.id }, data: { factureId: f.id } });
      if (part > 0) {
        const paye = f.paye + part;
        await tx.facture.update({
          where: { id: f.id },
          data: { paye, statut: paye >= f.total ? "PAYEE" : "PARTIELLEMENT_PAYEE" },
        });
      }
    });
    imputes++;
  }
  return { imputes };
}

// ---- Souscription publique (payée via le circuit de factures existant) ----
export async function souscrirePlan(planId, { userId, profil } = {}) {
  if (!userId) return { erreur: "non_connecte" };
  const plan = await prisma.planAbonnement.findUnique({ where: { id: Number(planId) } });
  if (!plan?.actif) return { erreur: "plan_indisponible" };
  const compte = await compteFinancierPour(userId, profil || {});
  // Une seule souscription active ou en attente par plan et par compte.
  const existante = await prisma.souscription.findFirst({
    where: { compteId: compte.id, planId: plan.id, statut: { in: ["ACTIF", "EN_ATTENTE_PAIEMENT"] } },
  });
  if (existante) {
    const facture = await prisma.facture.findFirst({
      where: { souscriptionId: existante.id, statut: { in: ["EMISE", "PARTIELLEMENT_PAYEE", "EN_RETARD"] } },
    });
    return { deja: true, souscription: existante, facture };
  }
  const souscription = await prisma.souscription.create({
    data: {
      compteId: compte.id, planId: plan.id, prix: plan.prix,
      statut: "EN_ATTENTE_PAIEMENT", debut: auj(), creePar: "Souscription en ligne",
    },
  });
  const facture = await creerFacture({
    compteId: compte.id, souscriptionId: souscription.id,
    lignes: [{ libelle: `Abonnement ${plan.nom} — première période (${plan.frequence})`, quantite: 1, prixUnitaire: plan.prix }],
    echeanceJours: 7, creePar: "Souscription en ligne", notes: "L'abonnement s'active dès réception du paiement.",
  });
  await prisma.journal.create({
    data: {
      auteur: "Souscription en ligne", action: "finance.souscription.attente", entite: "souscription",
      entiteId: String(souscription.id), detail: `${plan.nom} · ${plan.prix} DZD · facture ${facture.numero}`,
    },
  });
  return { ok: true, souscription, facture };
}

// Durée d'une période selon la fréquence du plan.
export function finPeriode(debut, frequence) {
  const d = new Date(debut + "T12:00:00Z");
  if (frequence === "annuel") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else if (frequence === "trimestriel") d.setUTCMonth(d.getUTCMonth() + 3);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}
