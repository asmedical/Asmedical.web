// Documents rattachés à une demande (ordonnances de livraison) et
// renouvellement en un bouton — logique centrale testable sans Supabase.
// Les fichiers vivent dans le bucket privé « documents » ; ici les règles.
import { prisma } from "@/lib/prisma";
import { cleTel } from "@/lib/telephones";

export const MIMES_ORDONNANCE = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
export const TAILLE_MAX = 8 * 1024 * 1024; // 8 Mo
export const MAX_DOCS_PAR_DEMANDE = 3;
const AGE_MAX_SANS_COMPTE_H = 48; // fenêtre d'ajout après la réservation

// Peut-on joindre une ordonnance à cette demande ? (patient identifié par
// son téléphone — la réservation sans compte reste couverte).
export async function peutJoindre(demande, telephone) {
  if (!demande) return { erreur: "introuvable" };
  if (demande.service !== "medicaments") return { erreur: "service_sans_ordonnance" };
  if (["ANNULEE", "TERMINEE"].includes(demande.statut)) return { erreur: "demande_close" };
  if (!cleTel(telephone) || cleTel(demande.telephone) !== cleTel(telephone)) {
    return { erreur: "non_autorise" };
  }
  const age = Date.now() - new Date(demande.creeLe).getTime();
  if (age > AGE_MAX_SANS_COMPTE_H * 3600 * 1000) return { erreur: "delai_depasse" };
  const nb = await prisma.documentDemande.count({ where: { demandeId: demande.id } });
  if (nb >= MAX_DOCS_PAR_DEMANDE) return { erreur: "limite_atteinte" };
  return { ok: true };
}

// Contrôle du fichier (type et taille) AVANT tout envoi au stockage.
export function fichierValide({ mime, taille }) {
  if (!MIMES_ORDONNANCE.includes(String(mime))) return { erreur: "format_invalide" };
  if (!taille || taille > TAILLE_MAX) return { erreur: "trop_lourd" };
  return { ok: true };
}

export function enregistrerDocument(demandeId, { nom, chemin, mime, taille, par }) {
  return prisma.documentDemande.create({
    data: {
      demandeId: Number(demandeId),
      categorie: "ordonnance",
      nom: String(nom || "ordonnance").slice(0, 160),
      chemin: String(chemin),
      mime: mime || null,
      taille: taille || null,
      par: par || "patient",
    },
  });
}

// Renouvellement en UN bouton : clone la dernière commande de médicaments
// TERMINÉE (adresse, pharmacie, fenêtre) pour demain, réutilise les
// ordonnances déjà transmises (mêmes fichiers), statut « à rappeler »
// pour confirmation par l'équipe. La propriété est vérifiée PAR L'APPELANT.
export async function renouvelerCommande(source, { par = "patient" } = {}) {
  if (!source || source.service !== "medicaments") return { erreur: "service_invalide" };
  if (source.statut !== "TERMINEE") return { erreur: "non_terminee" };

  const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const heure = String(source.date || "").slice(11, 16) || "10:00";

  const clone = await prisma.demande.create({
    data: {
      service: "medicaments",
      nom: source.nom,
      telephone: source.telephone,
      depart: source.depart,
      commune: source.commune,
      date: `${demain}T${heure}`,
      fenetre: source.fenetre,
      pharmacie: source.pharmacie,
      dureeMin: source.dureeMin,
      espace: source.espace,
      sousMode: "fenetre",
      recurrence: "Une seule fois",
      notes: `Renouvellement de la commande n°${source.id}${source.notes ? ` — ${source.notes}` : ""}`.slice(0, 500),
      parEtablissement: source.parEtablissement,
      parEtabUserId: source.parEtabUserId,
    },
  });

  // Les ordonnances de la commande d'origine restent valables : on relie
  // les MÊMES fichiers (aucune copie de stockage).
  const docs = await prisma.documentDemande.findMany({ where: { demandeId: source.id } });
  for (const d of docs) {
    await prisma.documentDemande.create({
      data: {
        demandeId: clone.id, categorie: d.categorie, nom: d.nom,
        chemin: d.chemin, mime: d.mime, taille: d.taille, par,
      },
    });
  }

  await prisma.journal.create({
    data: {
      auteur: par, action: "demande.renouvellement", entite: "demande",
      entiteId: String(clone.id), detail: `depuis n°${source.id} · ${docs.length} ordonnance(s) reprise(s)`,
    },
  }).catch(() => {});

  return { ok: true, demande: clone, ordonnances: docs.length };
}
