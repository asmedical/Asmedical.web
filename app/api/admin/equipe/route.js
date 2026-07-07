import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus, ROLES_ADMIN, ROLES_GESTION_EQUIPE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// GET : liste des comptes internes (rôles admin/modérateur/standardiste)
// + journal d'activité récent.
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const { data: membres } = await acces.admin
      .from("profil")
      .select("id, role, prenom, nom, email, telephone, cree_le")
      .in("role", ROLES_ADMIN)
      .order("cree_le", { ascending: true });
    const journal = await prisma.journal.findMany({ orderBy: { creeLe: "desc" }, take: 60 });
    return NextResponse.json({ membres: membres || [], journal, monRole: acces.profil.role });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH : changer le rôle d'un compte (réservé superadmin).
// body : { id, role } — role ∈ rôles internes, ou "patient" pour retirer l'accès.
export async function PATCH(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_EQUIPE);
  if (!acces) return refus();
  try {
    const c = await req.json();
    const rolesValides = [...ROLES_ADMIN, "patient", "pro"];
    if (!c.id || !rolesValides.includes(c.role)) {
      return NextResponse.json({ erreur: "paramètres invalides" }, { status: 400 });
    }
    if (c.id === acces.user.id && c.role !== "superadmin") {
      return NextResponse.json({ erreur: "impossible de retirer son propre accès superadmin" }, { status: 400 });
    }
    const { error } = await acces.admin.from("profil").update({ role: c.role }).eq("id", c.id);
    if (error) throw error;
    await journaliser(acces.nomAffiche, "equipe.role", "client", c.id, `rôle → ${c.role}`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
