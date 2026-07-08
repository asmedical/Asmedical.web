import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, refus } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// GET /api/admin/historique?entite=soignant&id=12
// Renvoie les actions journalisées concernant une entité (fiche employé).
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const p = new URL(req.url).searchParams;
    const entite = p.get("entite");
    const id = p.get("id");
    if (!entite || !id) return NextResponse.json({ erreur: "paramètres manquants" }, { status: 400 });
    const entrees = await prisma.journal.findMany({
      where: { entite, entiteId: String(id) },
      orderBy: { creeLe: "desc" },
      take: 100,
    });
    return NextResponse.json({ entrees });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
