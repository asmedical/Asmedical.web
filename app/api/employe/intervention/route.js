import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { ROLES_EMPLOYE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Statuts qu'un intervenant peut poser lui-même sur SES interventions.
const STATUTS_EMPLOYE = ["EN_COURS", "TERMINEE", "ABSENT"];

// PATCH /api/employe/intervention { id, statut }
// L'employé ne peut modifier que les demandes qui lui sont affectées.
export async function PATCH(req) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ erreur: "config" }, { status: 500 });

    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });

    const { data: profil } = await admin.from("profil").select("role").eq("id", user.id).maybeSingle();
    const role = profil?.role || user.user_metadata?.role || "";
    if (!ROLES_EMPLOYE.includes(role)) return NextResponse.json({ erreur: "refusé" }, { status: 403 });

    const { id, statut } = await req.json();
    if (!id || !STATUTS_EMPLOYE.includes(statut)) return NextResponse.json({ erreur: "invalide" }, { status: 400 });

    const estChauffeur = role === "chauffeur" || role === "transporteur";
    const intervenant = estChauffeur
      ? await prisma.transporteur.findUnique({ where: { userId: user.id } })
      : await prisma.soignant.findUnique({ where: { userId: user.id } });
    if (!intervenant) return NextResponse.json({ erreur: "aucune fiche liée" }, { status: 403 });

    const demande = await prisma.demande.findUnique({ where: { id: Number(id) } });
    const proprietaire = estChauffeur ? demande?.transporteurId === intervenant.id : demande?.soignantId === intervenant.id;
    if (!demande || !proprietaire) return NextResponse.json({ erreur: "non autorisé" }, { status: 403 });

    await prisma.demande.update({ where: { id: Number(id) }, data: { statut } });
    await prisma.journal.create({
      data: {
        auteur: `${intervenant.prenom || intervenant.nom || "employé"}`.trim(),
        action: "intervention.statut",
        entite: "demande",
        entiteId: String(id),
        detail: `→ ${statut} (par l'intervenant)`,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
