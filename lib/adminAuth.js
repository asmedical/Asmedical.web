import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

// Rôles internes autorisés à entrer dans l'espace admin.
// superadmin : tout, y compris gérer l'équipe et les rôles
// admin      : gestion opérationnelle complète
// moderateur : gestion demandes / clients / intervenants, pas l'équipe
// standardiste : demandes + clients uniquement
export const ROLES_ADMIN = ["superadmin", "admin", "moderateur", "standardiste"];
export const ROLES_GESTION_EQUIPE = ["superadmin"];
export const ROLES_GESTION_INTERVENANTS = ["superadmin", "admin", "moderateur"];

// Rôles « employé » : accès à l'espace /employe, jamais au back-office /admin.
export const ROLES_EMPLOYE = ["aide_soignant", "infirmier", "chauffeur", "transporteur", "coordinateur", "employe_interne"];
// Tous les rôles reconnus (pour valider une attribution).
export const TOUS_ROLES = [...ROLES_ADMIN, ...ROLES_EMPLOYE, "patient", "pro"];

// Hiérarchie de création de comptes :
//  - superadmin : peut créer TOUT rôle (seul à créer admin/modérateur/standardiste)
//  - admin      : peut créer uniquement des comptes EMPLOYÉS
// Renvoie true si `createur` a le droit de créer un compte de rôle `cible`.
export function peutCreerRole(createur, cible) {
  if (createur === "superadmin") return cible !== "superadmin"; // jamais un 2e superadmin par API
  if (createur === "admin") return ROLES_EMPLOYE.includes(cible);
  return false;
}

// Vérifie côté serveur que l'appelant est un membre interne autorisé.
// Le jeton d'accès Supabase est passé en en-tête Authorization: Bearer …
// Retourne { user, profil, admin } ou null si refusé.
export async function verifierAdmin(req, rolesAutorises = ROLES_ADMIN) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return null;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;

    const admin = createClient(url, key, { auth: { persistSession: false } });
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);
    if (error || !user) return null;

    const { data: profil } = await admin
      .from("profil")
      .select("role, prenom, nom, email, etablissement")
      .eq("id", user.id)
      .maybeSingle();

    if (!profil || !rolesAutorises.includes(profil.role)) return null;

    const nomAffiche =
      [profil.prenom, profil.nom].filter(Boolean).join(" ") || profil.email || user.id.slice(0, 8);
    return { user, profil, admin, nomAffiche };
  } catch {
    return null;
  }
}

// Trace une action dans le journal d'activité (ne bloque jamais l'action).
export async function journaliser(auteur, action, entite, entiteId, detail) {
  try {
    await prisma.journal.create({
      data: { auteur, action, entite, entiteId: String(entiteId), detail: detail || null },
    });
  } catch {}
}

export function refus() {
  return Response.json({ erreur: "Accès refusé" }, { status: 403 });
}
