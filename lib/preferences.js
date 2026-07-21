// Préférences de soin du patient — logique centrale (testable sans Supabase).
// Consignes pratiques (allergies, accès) visibles UNIQUEMENT par
// l'intervenant affecté ; préférence de genre et intervenant favori
// respectés par l'affectation automatique.
import { prisma } from "@/lib/prisma";
import { cleTel } from "@/lib/telephones";

const GENRES = ["homme", "femme"];

// Préférences d'un compte (par identifiant utilisateur).
export function preferencesDe(userId) {
  return prisma.preferencePatient.findUnique({ where: { userId } });
}

// Préférences applicables à une demande (par téléphone, insensible au format).
export async function preferencesPourTel(telephone) {
  const cle = cleTel(telephone);
  if (!cle) return null;
  return prisma.preferencePatient.findFirst({ where: { telCle: cle } });
}

// Soignants qui sont DÉJÀ intervenus chez ce patient (candidats « favori »).
export async function soignantsConnus(telephone) {
  const { idsDemandesParTel } = await import("@/lib/telephones");
  const ids = await idsDemandesParTel(cleTel(telephone), 100);
  const demandes = await prisma.demande.findMany({
    where: { id: { in: ids }, statut: "TERMINEE", soignantId: { not: null } },
    select: { soignant: { select: { id: true, prenom: true, nom: true, genre: true, statut: true } } },
  });
  const vus = new Map();
  for (const d of demandes) {
    if (d.soignant && d.soignant.statut === "VALIDE") vus.set(d.soignant.id, d.soignant);
  }
  return [...vus.values()];
}

// Enregistre les préférences d'un compte. Le favori doit être un soignant
// qui est réellement intervenu chez ce patient (contrôlé serveur).
export async function enregistrerPreferences(userId, telephone, champs = {}) {
  const telCle = cleTel(telephone);
  if (!telCle) return { erreur: "telephone_manquant" };

  const donnees = {
    allergies: champs.allergies ? String(champs.allergies).slice(0, 300) : null,
    etage: champs.etage ? String(champs.etage).slice(0, 40) : null,
    codePorte: champs.codePorte ? String(champs.codePorte).slice(0, 40) : null,
    consignes: champs.consignes ? String(champs.consignes).slice(0, 500) : null,
    prefGenre: GENRES.includes(champs.prefGenre) ? champs.prefGenre : null,
    soignantFavoriId: null,
  };

  if (champs.soignantFavoriId) {
    const connus = await soignantsConnus(telephone);
    if (!connus.some((s) => s.id === Number(champs.soignantFavoriId))) {
      return { erreur: "favori_inconnu" };
    }
    donnees.soignantFavoriId = Number(champs.soignantFavoriId);
  }

  const pref = await prisma.preferencePatient.upsert({
    where: { userId },
    update: { ...donnees, telCle },
    create: { userId, telCle, ...donnees },
  });
  return { ok: true, preferences: pref };
}

// Consignes pratiques pour l'intervenant AFFECTÉ (jamais le reste du profil).
export async function consignesIntervenant(telephone) {
  const p = await preferencesPourTel(telephone);
  if (!p) return null;
  const utile = [p.allergies, p.etage, p.codePorte, p.consignes].some(Boolean);
  if (!utile) return null;
  return { allergies: p.allergies, etage: p.etage, codePorte: p.codePorte, consignes: p.consignes };
}
