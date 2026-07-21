import { NextResponse } from "next/server";
import { verifierAdmin, journaliser, refus, ROLES_GESTION_EQUIPE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Groupes d'établissements (multi-sites) — réservé au SUPERADMIN.
// GET : groupes + membres + liste des comptes pro disponibles.
// POST : { action: creer | renommer | supprimer | ajouter | retirer, ... }

export async function GET(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_EQUIPE);
  if (!acces) return refus();
  try {
    const { prisma } = await import("@/lib/prisma");
    const groupes = await prisma.groupeEtablissement.findMany({
      include: { membres: { orderBy: { ajouteLe: "asc" } } },
      orderBy: { nom: "asc" },
    });
    const { data: pros } = await acces.admin
      .from("profil").select("id, etablissement, telephone").eq("role", "pro")
      .order("etablissement", { ascending: true }).limit(500);
    const nomDe = Object.fromEntries((pros || []).map((p) => [p.id, p.etablissement || p.telephone || p.id]));
    return NextResponse.json({
      groupes: groupes.map((g) => ({
        id: g.id,
        nom: g.nom,
        membres: g.membres.map((m) => ({ userId: m.userId, nom: m.nom || nomDe[m.userId] || m.userId })),
      })),
      pros: (pros || []).map((p) => ({ id: p.id, nom: p.etablissement || p.telephone || p.id })),
    });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_EQUIPE);
  if (!acces) return refus();
  try {
    const c = await req.json();
    const g = await import("@/lib/groupes");
    let res;
    if (c.action === "creer") res = await g.creerGroupe(c.nom);
    else if (c.action === "supprimer") res = await g.supprimerGroupe(c.groupeId);
    else if (c.action === "ajouter") res = await g.ajouterMembre(c.groupeId, c.userId, c.nomSite);
    else if (c.action === "retirer") res = await g.retirerMembre(c.userId);
    else return NextResponse.json({ erreur: "action inconnue" }, { status: 400 });
    if (res.erreur) return NextResponse.json({ erreur: res.erreur }, { status: 400 });
    await journaliser(acces.nomAffiche, `groupe.${c.action}`, "groupe", c.groupeId || 0, c.nom || c.userId || "");
    return NextResponse.json(res);
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
