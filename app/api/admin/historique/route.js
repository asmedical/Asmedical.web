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

    // ---- Vue GLOBALE filtrable (écran « Équipe & journal ») ----
    // Tout le journal, filtré par auteur / action / entité / période / texte.
    if (p.get("vue") === "global") {
      const where = {};
      if (p.get("auteur")) where.auteur = { contains: p.get("auteur"), mode: "insensitive" };
      if (p.get("entite")) where.entite = p.get("entite");
      if (p.get("action")) where.action = { contains: p.get("action"), mode: "insensitive" };
      if (p.get("q")) where.detail = { contains: p.get("q"), mode: "insensitive" };
      const debut = (p.get("debut") || "").slice(0, 10);
      const fin = (p.get("fin") || "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(debut)) where.creeLe = { ...(where.creeLe || {}), gte: new Date(debut + "T00:00:00") };
      if (/^\d{4}-\d{2}-\d{2}$/.test(fin)) where.creeLe = { ...(where.creeLe || {}), lte: new Date(fin + "T23:59:59") };
      const page = Math.max(1, parseInt(p.get("page"), 10) || 1);
      const parPage = 50;
      const [total, entrees] = await Promise.all([
        prisma.journal.count({ where }),
        prisma.journal.findMany({ where, orderBy: { creeLe: "desc" }, skip: (page - 1) * parPage, take: parPage }),
      ]);
      return NextResponse.json({ entrees, total, pages: Math.ceil(total / parPage), page });
    }

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
