import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { ROLES_EMPLOYE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Identité de l'employé connecté (jeton uniquement). Renvoie son rôle, sa
// fiche intervenant liée et ses interventions/tournées réelles.
// Client service_role + identité employé à partir du jeton. Renvoie
// { admin, user, profil, role, estChauffeur } ou une réponse d'erreur.
async function contexte(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { err: NextResponse.json({ erreur: "non connecté" }, { status: 401 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { err: NextResponse.json({ erreur: "config" }, { status: 500 }) };
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return { err: NextResponse.json({ erreur: "non connecté" }, { status: 401 }) };
  const { data: profil } = await admin.from("profil").select("role, prenom, nom, telephone, email").eq("id", user.id).maybeSingle();
  const role = profil?.role || user.user_metadata?.role || "";
  if (!ROLES_EMPLOYE.includes(role)) return { err: NextResponse.json({ erreur: "pas un employé", role }, { status: 403 }) };
  return { admin, user, profil, role, estChauffeur: role === "chauffeur" || role === "transporteur" };
}

// PATCH /api/employe/moi { dispo } — l'employé met à jour sa propre
// disponibilité (DISPONIBLE | OCCUPE | ABSENT).
export async function PATCH(req) {
  try {
    const ctx = await contexte(req);
    if (ctx.err) return ctx.err;
    const { dispo } = await req.json();
    if (!["DISPONIBLE", "OCCUPE", "ABSENT"].includes(dispo)) return NextResponse.json({ erreur: "invalide" }, { status: 400 });
    const modele = ctx.estChauffeur ? prisma.transporteur : prisma.soignant;
    const iv = await modele.findUnique({ where: { userId: ctx.user.id } });
    if (!iv) return NextResponse.json({ erreur: "aucune fiche liée" }, { status: 403 });
    await modele.update({ where: { id: iv.id }, data: { dispo } });
    return NextResponse.json({ ok: true, dispo });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ erreur: "config" }, { status: 500 });

    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });

    const { data: profil } = await admin
      .from("profil")
      .select("role, prenom, nom, telephone, email")
      .eq("id", user.id)
      .maybeSingle();

    const role = profil?.role || user.user_metadata?.role || "";
    if (!ROLES_EMPLOYE.includes(role)) {
      return NextResponse.json({ erreur: "pas un employé", role }, { status: 403 });
    }

    const estChauffeur = role === "chauffeur" || role === "transporteur";
    const intervenant = estChauffeur
      ? await prisma.transporteur.findUnique({ where: { userId: user.id } })
      : await prisma.soignant.findUnique({ where: { userId: user.id } });

    // Interventions / tournées liées (aujourd'hui + à venir + récentes).
    let interventions = [];
    if (intervenant) {
      const where = estChauffeur ? { transporteurId: intervenant.id } : { soignantId: intervenant.id };
      interventions = await prisma.demande.findMany({
        where,
        orderBy: { date: "asc" },
        take: 60,
        select: {
          id: true, service: true, date: true, statut: true, destination: true,
          depart: true, nom: true, telephone: true, sousMode: true, prioritaire: true, fenetre: true,
        },
      });
    }

    return NextResponse.json({
      role,
      estChauffeur,
      prenom: profil?.prenom || user.user_metadata?.prenom || "",
      nom: profil?.nom || user.user_metadata?.nom || "",
      mustChangePassword: Boolean(user.user_metadata?.must_change_password),
      intervenant: intervenant
        ? {
            id: intervenant.id,
            nom: estChauffeur ? intervenant.nom : `${intervenant.prenom} ${intervenant.nom}`,
            photoUrl: intervenant.photoUrl,
            statut: intervenant.statut,
            dispo: intervenant.dispo,
            telephone: intervenant.telephone,
            communes: estChauffeur ? intervenant.zone : intervenant.communes,
            heureDebut: intervenant.heureDebut,
            heureFin: intervenant.heureFin,
            joursOff: intervenant.joursOff,
            conges: intervenant.conges,
            vehicule: estChauffeur ? intervenant.vehicule : null,
            vehiculeCouleur: estChauffeur ? intervenant.vehiculeCouleur : null,
            vehiculeImmat: estChauffeur ? intervenant.vehiculeImmat : null,
            typeTransport: estChauffeur ? intervenant.typeTransport : null,
            qualification: estChauffeur ? null : intervenant.qualification,
            specialites: intervenant.specialites,
          }
        : null,
      interventions,
    });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
