import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus, ROLES_GESTION_EQUIPE, ROLES_EMPLOYE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Rôles qu'un super admin peut attribuer à un compte de connexion.
const ROLES_ATTRIBUABLES = [...ROLES_EMPLOYE, "admin", "moderateur", "standardiste"];
const BAN_LONG = "876000h"; // ~100 ans = accès suspendu

function estEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ""));
}

// GET /api/admin/compte?userId=… → état du compte de connexion.
export async function GET(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_EQUIPE);
  if (!acces) return refus();
  try {
    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) return NextResponse.json({ erreur: "userId manquant" }, { status: 400 });
    const { data, error } = await acces.admin.auth.admin.getUserById(userId);
    if (error || !data?.user) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
    const u = data.user;
    return NextResponse.json({
      compte: {
        email: u.email || null,
        telephone: u.phone || null,
        creeLe: u.created_at,
        derniereConnexion: u.last_sign_in_at || null,
        motDePasseTemporaire: Boolean(u.user_metadata?.must_change_password),
        premiereConnexionFaite: Boolean(u.user_metadata?.first_login_at) || Boolean(u.last_sign_in_at),
        suspendu: Boolean(u.banned_until && new Date(u.banned_until) > new Date()),
        role: u.user_metadata?.role || null,
        creePar: u.user_metadata?.cree_par || null,
      },
    });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/admin/compte → crée un compte de connexion pour un employé et,
// si demandé, le rattache à une fiche soignant / transporteur existante.
export async function POST(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_EQUIPE);
  if (!acces) return refus();
  try {
    const c = await req.json();
    const email = String(c.email || "").trim().toLowerCase();
    const telephone = c.telephone ? String(c.telephone).trim() : null;
    const motDePasse = String(c.motDePasse || "");
    const role = c.role;
    const prenom = c.prenom ? String(c.prenom).slice(0, 60) : "";
    const nom = c.nom ? String(c.nom).slice(0, 60) : "";

    if (!estEmail(email)) return NextResponse.json({ erreur: "Email de connexion invalide." }, { status: 400 });
    if (motDePasse.length < 8) return NextResponse.json({ erreur: "Le mot de passe temporaire doit faire au moins 8 caractères." }, { status: 400 });
    if (!ROLES_ATTRIBUABLES.includes(role)) return NextResponse.json({ erreur: "Rôle invalide." }, { status: 400 });

    // Création du compte Supabase (email confirmé → connexion immédiate).
    const { data, error } = await acces.admin.auth.admin.createUser({
      email,
      password: motDePasse,
      email_confirm: true,
      user_metadata: {
        must_change_password: true,
        role,
        prenom,
        nom,
        cree_par: acces.nomAffiche,
        temporary_password_created_at: new Date().toISOString(),
      },
    });
    if (error) {
      const m = String(error.message || "");
      if (/registered|exists|already/i.test(m)) return NextResponse.json({ erreur: "Un compte existe déjà avec cet email." }, { status: 409 });
      return NextResponse.json({ erreur: "Création impossible : " + m }, { status: 400 });
    }
    const userId = data.user.id;

    // Profil (table Supabase) : rôle + identité.
    await acces.admin.from("profil").upsert({
      id: userId,
      role,
      prenom,
      nom,
      telephone,
      email,
      maj_le: new Date().toISOString(),
    });

    // Rattachement éventuel à une fiche intervenant existante.
    if (["soignant", "transporteur"].includes(c.entite) && Number(c.entiteId)) {
      const id = Number(c.entiteId);
      if (c.entite === "soignant") await prisma.soignant.update({ where: { id }, data: { userId } });
      else await prisma.transporteur.update({ where: { id }, data: { userId } });
      await journaliser(acces.nomAffiche, `${c.entite}.compte`, c.entite, id, `compte créé (${email})`);
    }
    await journaliser(acces.nomAffiche, "compte.cree", "compte", userId, `${role} · ${email}`);
    return NextResponse.json({ ok: true, userId });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/admin/compte → actions sur un compte existant.
// { userId, action: "reset" | "forcer" | "suspendre" | "reactiver", motDePasse? }
export async function PATCH(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_EQUIPE);
  if (!acces) return refus();
  try {
    const c = await req.json();
    const userId = c.userId;
    if (!userId) return NextResponse.json({ erreur: "userId manquant" }, { status: 400 });

    let maj = {};
    let libelle = "";
    if (c.action === "reset") {
      const mdp = String(c.motDePasse || "");
      if (mdp.length < 8) return NextResponse.json({ erreur: "Mot de passe trop court (8 caractères min.)." }, { status: 400 });
      maj = { password: mdp, user_metadata: { must_change_password: true, temporary_password_created_at: new Date().toISOString() } };
      libelle = "mot de passe réinitialisé";
    } else if (c.action === "forcer") {
      maj = { user_metadata: { must_change_password: true } };
      libelle = "changement de mot de passe forcé";
    } else if (c.action === "suspendre") {
      maj = { ban_duration: BAN_LONG };
      libelle = "accès suspendu";
    } else if (c.action === "reactiver") {
      maj = { ban_duration: "none" };
      libelle = "accès réactivé";
    } else {
      return NextResponse.json({ erreur: "Action inconnue" }, { status: 400 });
    }

    // Fusionne les métadonnées existantes pour ne pas les écraser.
    if (maj.user_metadata) {
      const { data: actuel } = await acces.admin.auth.admin.getUserById(userId);
      maj.user_metadata = { ...(actuel?.user?.user_metadata || {}), ...maj.user_metadata };
    }
    const { error } = await acces.admin.auth.admin.updateUserById(userId, maj);
    if (error) return NextResponse.json({ erreur: "Action impossible : " + error.message }, { status: 400 });
    await journaliser(acces.nomAffiche, "compte.action", "compte", userId, libelle);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
