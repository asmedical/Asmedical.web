// ─────────────────────────────────────────────────────────────────────────
// Cœur du module financier ASM.
// Montants en DINARS ENTIERS (DZD). Toutes les écritures sensibles sont
// transactionnelles et journalisées par les routes appelantes.
// ─────────────────────────────────────────────────────────────────────────
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const DEVISE = "DZD";
export const STATUTS_FACTURE = ["BROUILLON", "EMISE", "PARTIELLEMENT_PAYEE", "PAYEE", "EN_RETARD", "ANNULEE", "CREDITEE"];
export const MOYENS = ["especes", "cib", "edahabia", "virement"];

const auj = () => new Date().toISOString().slice(0, 10);

// ---- Séquences fiables (numéros uniques, jamais réutilisés) ----
export async function prochainNumero(tx, nom, prefixe, largeur = 6) {
  const seq = await tx.sequenceFinance.upsert({
    where: { nom },
    update: { valeur: { increment: 1 } },
    create: { nom, valeur: 1 },
  });
  return `${prefixe}${String(seq.valeur).padStart(largeur, "0")}`;
}

// ---- Compte financier unique par client (créé au premier besoin) ----
export async function compteFinancierPour(userId, profil) {
  const existant = await prisma.compteFinancier.findUnique({ where: { userId } });
  if (existant) return existant;
  return prisma.$transaction(async (tx) => {
    const deja = await tx.compteFinancier.findUnique({ where: { userId } });
    if (deja) return deja; // anti double création concurrente
    const numero = await prochainNumero(tx, "client", "ASM-CL-");
    return tx.compteFinancier.create({
      data: {
        numero,
        userId,
        type: profil?.role === "pro" ? "pro" : "patient",
        nom: profil?.etablissement || [profil?.prenom, profil?.nom].filter(Boolean).join(" ") || null,
        emailFacturation: profil?.email || null,
        telFacturation: profil?.telephone || null,
      },
    });
  });
}

// ---- Tarifs en vigueur à une date ----
export async function tarifsEnVigueur({ service, date } = {}) {
  const jour = date || auj();
  const tous = await prisma.tarif.findMany({
    where: { actif: true, debut: { lte: jour }, OR: [{ fin: null }, { fin: { gte: jour } }] },
    orderBy: [{ categorie: "asc" }, { code: "asc" }],
  });
  return service ? tous.filter((t) => !t.service || t.service === service) : tous;
}

// Nouvelle version d'un tarif : clôt l'ancienne, n'affecte JAMAIS les
// factures déjà émises (elles portent leurs montants copiés).
export async function versionnerTarif(tarifId, { montant, libelle, debut }, auteur) {
  return prisma.$transaction(async (tx) => {
    const ancien = await tx.tarif.findUnique({ where: { id: Number(tarifId) } });
    if (!ancien) throw new Error("tarif introuvable");
    const jourDebut = debut || auj();
    const veille = new Date(new Date(jourDebut + "T12:00").getTime() - 86400000).toISOString().slice(0, 10);
    await tx.tarif.update({ where: { id: ancien.id }, data: { fin: veille } });
    return tx.tarif.create({
      data: {
        categorie: ancien.categorie, code: ancien.code,
        libelle: libelle ?? ancien.libelle, libelleAr: ancien.libelleAr,
        montant: montant ?? ancien.montant, unite: ancien.unite,
        service: ancien.service, zone: ancien.zone, clientType: ancien.clientType,
        debut: jourDebut, creePar: auteur,
      },
    });
  });
}

// ---- Remises applicables (jamais de total négatif) ----
export async function remisesPour(compteId, service, date) {
  const jour = date || auj();
  const remises = await prisma.remiseClient.findMany({
    where: {
      compteId,
      debut: { lte: jour },
      OR: [{ fin: null }, { fin: { gte: jour } }],
    },
  });
  return remises.filter((r) => !r.service || r.service === service);
}

export function calculerRemise(sousTotal, remises) {
  let total = 0;
  const details = [];
  for (const r of remises) {
    let m = r.type === "pourcentage" ? Math.round((sousTotal * r.valeur) / 100) : r.valeur;
    if (r.plafond) m = Math.min(m, r.plafond);
    m = Math.max(0, m);
    if (m > 0) {
      total += m;
      details.push(r.type === "pourcentage" ? `${r.motif} : -${r.valeur} %` : `${r.motif} : -${r.valeur} ${DEVISE}`);
    }
  }
  total = Math.min(total, sousTotal); // le prix ne devient jamais négatif
  return { montant: total, detail: details.join(" · ") || null };
}

// ---- Création d'une facture (numérotée, montants copiés) ----
export async function creerFacture({ compteId, demandeId, souscriptionId, lignes, echeanceJours = 7, creePar, service, notes, statut = "EMISE" }) {
  if (!lignes?.length) throw new Error("facture sans lignes");
  const propres = lignes.map((l) => {
    const quantite = Math.max(1, parseInt(l.quantite, 10) || 1);
    const pu = Math.max(0, parseInt(l.prixUnitaire, 10) || 0);
    return { libelle: String(l.libelle || "").slice(0, 200), quantite, prixUnitaire: pu, montant: quantite * pu, tarifId: l.tarifId || null };
  });
  const sousTotal = propres.reduce((s, l) => s + l.montant, 0);
  const remises = await remisesPour(compteId, service);
  const { montant: remiseTotal, detail: remiseDetail } = calculerRemise(sousTotal, remises);
  const emission = auj();
  const echeance = new Date(Date.now() + echeanceJours * 86400000).toISOString().slice(0, 10);

  return prisma.$transaction(async (tx) => {
    const annee = new Date().getFullYear();
    const numero = await prochainNumero(tx, `facture-${annee}`, `ASM-${annee}-`);
    return tx.facture.create({
      data: {
        numero, compteId, demandeId: demandeId || null, souscriptionId: souscriptionId || null,
        statut, emissionLe: emission, echeance,
        sousTotal, remiseTotal, remiseDetail, total: sousTotal - remiseTotal,
        notes: notes || null, creePar: creePar || null,
        lignes: { create: propres },
      },
      include: { lignes: true },
    });
  });
}

// ---- Imputation d'un paiement confirmé sur sa facture ----
export async function imputerPaiement(tx, factureId, montant) {
  const f = await tx.facture.findUnique({ where: { id: factureId } });
  if (!f || f.statut === "ANNULEE") throw new Error("facture indisponible");
  const paye = f.paye + montant;
  const statut = paye >= f.total ? "PAYEE" : "PARTIELLEMENT_PAYEE";
  await tx.facture.update({ where: { id: factureId }, data: { paye, statut } });
  return { paye, statut };
}

// Confirme un paiement (webhook ou encaissement) — IDEMPOTENT : un paiement
// déjà confirmé n'est jamais imputé deux fois (anti double débit).
export async function confirmerPaiement(paiementId) {
  return prisma.$transaction(async (tx) => {
    const maj = await tx.paiement.updateMany({
      where: { id: paiementId, statut: "EN_ATTENTE" },
      data: { statut: "CONFIRME", confirmeLe: new Date() },
    });
    if (maj.count === 0) return { deja: true }; // déjà traité → aucune double imputation
    const p = await tx.paiement.findUnique({ where: { id: paiementId } });
    if (p.factureId) await imputerPaiement(tx, p.factureId, p.montant);
    return { deja: false, paiement: p };
  });
}

// ---- Ticket de paiement en espèces (référence non devinable, usage unique) ----
export async function creerTicketEspeces({ facture, compteId, montant, joursValidite = 7 }) {
  const reference = "ASM-T-" + crypto.randomBytes(5).toString("hex").toUpperCase();
  const jeton = crypto.randomBytes(24).toString("hex");
  const du = Math.min(montant || facture.total - facture.paye, facture.total - facture.paye);
  if (du <= 0) throw new Error("rien à payer");
  return prisma.ticketEspeces.create({
    data: {
      reference, jeton, compteId, factureId: facture.id, montant: du,
      expireLe: new Date(Date.now() + joursValidite * 86400000),
    },
  });
}

// Encaissement d'un ticket par le staff — transactionnel et à USAGE UNIQUE.
export async function encaisserTicket({ reference, jeton, caissier, pointId }) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.ticketEspeces.findFirst({
      where: reference ? { reference } : { jeton },
      include: { facture: true },
    });
    if (!t) return { erreur: "introuvable" };
    if (t.statut === "PAYE") return { erreur: "deja_paye", ticket: t };
    if (t.statut !== "EN_ATTENTE") return { erreur: "invalide", ticket: t };
    if (t.expireLe < new Date()) {
      await tx.ticketEspeces.update({ where: { id: t.id }, data: { statut: "EXPIRE" } });
      return { erreur: "expire", ticket: t };
    }
    // Usage unique garanti : la mise à jour conditionnelle ne passe qu'une fois.
    const verrou = await tx.ticketEspeces.updateMany({
      where: { id: t.id, statut: "EN_ATTENTE" },
      data: { statut: "PAYE", payeLe: new Date(), encaissePar: caissier, pointId: pointId || null },
    });
    if (verrou.count === 0) return { erreur: "deja_paye", ticket: t };

    const reference2 = await prochainNumero(tx, "paiement", "ASM-P-");
    const paiement = await tx.paiement.create({
      data: {
        reference: reference2, compteId: t.compteId, factureId: t.factureId,
        moyen: "especes", fournisseur: "interne", refFournisseur: t.reference,
        montant: t.montant, statut: "CONFIRME", encaissePar: caissier,
        pointId: pointId || null, confirmeLe: new Date(),
      },
    });
    await imputerPaiement(tx, t.factureId, t.montant);
    return { ok: true, paiement, ticket: t };
  });
}

// ---- Remboursements (plafonnés au montant disponible) ----
export async function rembourser({ paiementId, montant, motif, auteur }) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.paiement.findUnique({ where: { id: Number(paiementId) }, include: { remboursements: true } });
    if (!p || p.statut === "EN_ATTENTE" || p.statut === "ECHOUE") throw new Error("paiement non remboursable");
    const dejaRembourse = p.remboursements.filter((r) => r.statut !== "REFUSE").reduce((s, r) => s + r.montant, 0);
    const dispo = p.montant - dejaRembourse;
    const m = parseInt(montant, 10);
    if (!m || m <= 0 || m > dispo) throw new Error("montant indisponible");

    // Espèces / virement : traité par ASM. En ligne : à exécuter aussi chez
    // le fournisseur (marqué en attente jusqu'à confirmation manuelle).
    const enLigne = ["cib", "edahabia"].includes(p.moyen);
    const remb = await tx.remboursement.create({
      data: { paiementId: p.id, montant: m, motif: String(motif).slice(0, 300), validePar: auteur, statut: enLigne ? "EN_ATTENTE_FOURNISSEUR" : "EFFECTUE" },
    });
    const totalR = dejaRembourse + m;
    await tx.paiement.update({
      where: { id: p.id },
      data: { statut: totalR >= p.montant ? "REMBOURSE" : "PARTIELLEMENT_REMBOURSE" },
    });
    // La facture redevient due à hauteur du remboursement.
    if (p.factureId) {
      const f = await tx.facture.findUnique({ where: { id: p.factureId } });
      const paye = Math.max(0, f.paye - m);
      await tx.facture.update({
        where: { id: f.id },
        data: { paye, statut: paye >= f.total ? "PAYEE" : paye > 0 ? "PARTIELLEMENT_PAYEE" : "EMISE" },
      });
    }
    return remb;
  });
}

// ---- Impayés : marque EN_RETARD les factures échues ----
export async function marquerRetards() {
  const jour = auj();
  await prisma.facture.updateMany({
    where: { statut: { in: ["EMISE", "PARTIELLEMENT_PAYEE"] }, echeance: { lt: jour } },
    data: { statut: "EN_RETARD" },
  });
}

// Tarifs par défaut installés au premier lancement (modifiables ensuite
// dans l'administration — AUCUN prix codé en dur ailleurs).
export const TARIFS_DEFAUT = [
  { categorie: "transport", code: "transport_base", libelle: "Transport médical — course", montant: 2500, service: "transport" },
  { categorie: "transport", code: "transport_km_sup", libelle: "Kilomètre supplémentaire", montant: 50, unite: "km", service: "transport" },
  { categorie: "transport", code: "transport_attente", libelle: "Temps d'attente (par heure)", montant: 500, unite: "heure", service: "transport" },
  { categorie: "domicile", code: "domicile_heure", libelle: "Aide à domicile (par heure)", montant: 1200, unite: "heure", service: "domicile" },
  { categorie: "domicile", code: "domicile_infirmier", libelle: "Soin infirmier — passage", montant: 2000, service: "domicile" },
  { categorie: "medicaments", code: "livraison_base", libelle: "Livraison de médicaments", montant: 600, service: "medicaments" },
  { categorie: "supplement", code: "nuit", libelle: "Supplément nuit (20h–6h)", montant: 800 },
  { categorie: "supplement", code: "weekend", libelle: "Supplément week-end / férié", montant: 500 },
  { categorie: "supplement", code: "urgence", libelle: "Supplément urgence", montant: 1000 },
  { categorie: "penalite", code: "annulation_tardive", libelle: "Annulation tardive (moins de 2 h)", montant: 1000 },
  { categorie: "penalite", code: "absence", libelle: "Absence du patient", montant: 1500 },
];

export async function installerTarifsDefaut(auteur = "système") {
  const n = await prisma.tarif.count();
  if (n > 0) return 0;
  await prisma.tarif.createMany({
    data: TARIFS_DEFAUT.map((t) => ({ ...t, debut: auj(), creePar: auteur })),
  });
  return TARIFS_DEFAUT.length;
}

// ═══════════ FACTURATION AUTOMATIQUE À LA CLÔTURE ═══════════
// Quand une prestation passe à « Terminée », la facture est émise toute
// seule : tarif en vigueur du service, durée réelle, aller-retour ×2,
// suppléments nuit / week-end si définis, remises du client appliquées.
// Garde-fous : réglage désactivable, anti-doublon (une prestation = une
// facture), aucune facture si le client n'a pas de compte identifiable.

function estNuit(date) {
  const h = Number(String(date || "").slice(11, 13));
  return h >= 20 || h < 6;
}
function estWeekend(date) {
  const j = new Date(String(date).slice(0, 10) + "T12:00").getDay();
  return j === 5 || j === 6; // vendredi / samedi (Algérie)
}

// Retrouve (ou crée) le compte financier du payeur d'une demande :
// l'établissement si la réservation a été faite par lui, sinon le patient
// (compte existant par téléphone, sinon via son profil Supabase).
export async function comptePayeurPour(demande) {
  // 1. Réservation faite par un établissement → c'est lui le payeur.
  if (demande.parEtabUserId) {
    const existant = await prisma.compteFinancier.findUnique({ where: { userId: demande.parEtabUserId } });
    if (existant) return existant;
  }
  const cibleUserId = demande.parEtabUserId || null;

  // 2. Compte financier existant dont le téléphone correspond (hors ligne).
  const tel8 = String(demande.telephone || "").replace(/\D/g, "").slice(-8);
  if (!cibleUserId && tel8) {
    const comptes = await prisma.compteFinancier.findMany({ take: 500 });
    const trouve = comptes.find((c) => String(c.telFacturation || "").replace(/\D/g, "").slice(-8) === tel8);
    if (trouve) return trouve;
  }

  // 3. Profil Supabase (service serveur) → création du compte financier.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, key, { auth: { persistSession: false } });
  if (cibleUserId) {
    const { data: profil } = await admin.from("profil").select("*").eq("id", cibleUserId).maybeSingle();
    return profil ? compteFinancierPour(cibleUserId, profil) : null;
  }
  if (!tel8) return null;
  const { data: profils } = await admin
    .from("profil")
    .select("id, role, prenom, nom, telephone, email, etablissement")
    .or("role.eq.patient,role.is.null")
    .limit(500);
  const profil = (profils || []).find((p) => String(p.telephone || "").replace(/\D/g, "").slice(-8) === tel8);
  return profil ? compteFinancierPour(profil.id, profil) : null;
}

export async function facturerDemande(demande, { auteur = "Facturation automatique" } = {}) {
  if (!demande || demande.statut !== "TERMINEE") return { ignoree: "non_terminee" };

  // Réglage global (désactivable par le super admin).
  const reglage = await prisma.reglage.findUnique({ where: { id: 1 } });
  if (reglage && reglage.facturationAuto === false) return { ignoree: "desactivee" };

  // Une prestation = UNE facture (les annulées ne comptent pas).
  const existante = await prisma.facture.findFirst({
    where: { demandeId: demande.id, statut: { not: "ANNULEE" } },
  });
  if (existante) return { deja: true, facture: existante };

  const compte = await comptePayeurPour(demande);
  if (!compte) {
    try {
      await prisma.journal.create({
        data: { auteur, action: "finance.facture.auto.impossible", entite: "demande", entiteId: String(demande.id), detail: "aucun compte client identifiable — facturer manuellement" },
      });
    } catch {}
    return { ignoree: "sans_compte" };
  }

  // Lignes au tarif EN VIGUEUR (copié dans la facture, non rétroactif).
  const tarifs = await tarifsEnVigueur({ service: demande.service });
  // Tarif PRINCIPAL du service (jamais un accessoire comme l'attente ou le km).
  const PRINCIPAL = { transport: "transport_base", domicile: "domicile_heure", medicaments: "livraison_base" };
  const candidats = tarifs.filter((t) => !["supplement", "penalite"].includes(t.categorie));
  const base =
    candidats.find((t) => t.code === PRINCIPAL[demande.service]) ||
    candidats.find((t) => t.code.endsWith("_base")) ||
    candidats[0];
  if (!base) return { ignoree: "sans_tarif" };

  const lignes = [];
  let quantite = 1;
  let libelle = `${base.libelle} — prestation n°${demande.id}`;
  if (base.unite === "heure") {
    quantite = Math.max(1, Math.round((demande.dureeMin || 60) / 60));
  } else if (demande.service === "transport" && demande.typeTrajet === "aller_retour") {
    quantite = 2;
    libelle += " (aller-retour)";
  }
  lignes.push({ libelle, quantite, prixUnitaire: base.montant, tarifId: base.id });

  const nuit = tarifs.find((t) => t.code === "nuit");
  if (nuit && estNuit(demande.date)) lignes.push({ libelle: nuit.libelle, quantite: 1, prixUnitaire: nuit.montant, tarifId: nuit.id });
  const weekend = tarifs.find((t) => t.code === "weekend");
  if (weekend && estWeekend(demande.date)) lignes.push({ libelle: weekend.libelle, quantite: 1, prixUnitaire: weekend.montant, tarifId: weekend.id });
  const urgence = tarifs.find((t) => t.code === "urgence");
  if (urgence && demande.prioritaire) lignes.push({ libelle: urgence.libelle, quantite: 1, prixUnitaire: urgence.montant, tarifId: urgence.id });

  const facture = await creerFacture({
    compteId: compte.id, demandeId: demande.id, lignes,
    echeanceJours: 7, creePar: auteur, service: demande.service,
    notes: demande.parEtablissement ? `Réservé par ${demande.parEtablissement}` : null,
  });

  // Journal + notification (interne + push) au payeur.
  try {
    await prisma.journal.create({
      data: { auteur, action: "finance.facture.auto", entite: "facture", entiteId: String(facture.id), detail: `${facture.numero} · ${facture.total} DZD · demande n°${demande.id}` },
    });
    await prisma.notification.create({
      data: {
        userId: compte.userId, type: "info", titre: "Votre facture est disponible",
        corps: `Prestation n°${demande.id} terminée — facture ${facture.numero} de ${facture.total} DZD, à régler avant le ${facture.echeance}.`,
        auteur: "ASM Finances", statut: "NON_LU",
      },
    });
    const { envoyerPush } = await import("@/lib/pushEnvoi");
    await envoyerPush(compte.userId, {
      titre: "Votre facture ASM est disponible",
      corps: `${facture.numero} · ${facture.total} DZD — payez en ligne ou en espèces.`,
      url: "/compte/paiements",
    });
  } catch {}

  return { ok: true, facture };
}
