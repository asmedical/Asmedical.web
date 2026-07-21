// Multi-établissements — logique centrale (testable sans Supabase).
// Un GROUPE relie plusieurs comptes pro (sites d'une même enseigne) :
// chaque membre voit les chiffres consolidés du groupe. La composition
// est gérée exclusivement par le superadmin.
import { prisma } from "@/lib/prisma";

export function creerGroupe(nom) {
  const propre = String(nom || "").trim().slice(0, 120);
  if (propre.length < 2) return { erreur: "nom_invalide" };
  return prisma.groupeEtablissement
    .create({ data: { nom: propre } })
    .then((groupe) => ({ ok: true, groupe }));
}

// Ajoute un compte pro à un groupe. Un compte n'appartient qu'à UN groupe :
// s'il est déjà membre ailleurs, refus explicite (le retirer d'abord).
export async function ajouterMembre(groupeId, userId, nomSite) {
  const id = Number(groupeId);
  const user = String(userId || "").trim();
  if (!id || !user) return { erreur: "parametres" };
  const groupe = await prisma.groupeEtablissement.findUnique({ where: { id } });
  if (!groupe) return { erreur: "groupe_introuvable" };
  const existant = await prisma.groupeMembre.findUnique({ where: { userId: user } });
  if (existant) {
    return { erreur: existant.groupeId === id ? "deja_membre" : "membre_autre_groupe" };
  }
  const membre = await prisma.groupeMembre.create({
    data: { groupeId: id, userId: user, nom: nomSite ? String(nomSite).trim().slice(0, 120) : null },
  });
  return { ok: true, membre };
}

export async function retirerMembre(userId) {
  const user = String(userId || "").trim();
  const existant = await prisma.groupeMembre.findUnique({ where: { userId: user } });
  if (!existant) return { erreur: "pas_membre" };
  await prisma.groupeMembre.delete({ where: { userId: user } });
  return { ok: true };
}

export async function supprimerGroupe(groupeId) {
  const id = Number(groupeId);
  if (!id) return { erreur: "parametres" };
  await prisma.groupeEtablissement.delete({ where: { id } }).catch(() => null);
  return { ok: true }; // membres supprimés en cascade
}

// Groupe d'un compte pro (null si aucun) — avec tous les sites membres.
export async function groupeDe(userId) {
  const membre = await prisma.groupeMembre.findUnique({
    where: { userId: String(userId || "") },
    include: { groupe: { include: { membres: { orderBy: { ajouteLe: "asc" } } } } },
  });
  return membre?.groupe || null;
}

// Périmètre de consultation d'un compte pro : lui-même + les sites de son
// groupe. C'est la SEULE liste d'identifiants que ses statistiques peuvent
// couvrir — toujours recalculée côté serveur, jamais fournie par le client.
export async function perimetreDe(userId) {
  const moi = String(userId || "");
  const groupe = await groupeDe(moi);
  if (!groupe) return { userIds: [moi], groupe: null };
  const userIds = [...new Set([moi, ...groupe.membres.map((m) => m.userId)])];
  return { userIds, groupe };
}
