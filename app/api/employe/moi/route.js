import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { ROLES_EMPLOYE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Identité de l'employé connecté (jeton uniquement). Renvoie son rôle, sa
// fiche intervenant liée et ses interventions/tournées réelles.
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
