import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, refus } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// GET /api/admin/avis?entite=soignant&id=12 → avis d'un intervenant
// (moyenne, nombre, et les plus récents).
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const p = new URL(req.url).searchParams;
    const entite = p.get("entite");
    const id = Number(p.get("id"));
    if (!["soignant", "transporteur"].includes(entite) || !id) {
      return NextResponse.json({ erreur: "paramètres invalides" }, { status: 400 });
    }
    const where = entite === "soignant" ? { soignantId: id } : { transporteurId: id };
    const [agg, avis] = await Promise.all([
      prisma.avis.aggregate({ where, _avg: { note: true }, _count: true }),
      prisma.avis.findMany({ where, orderBy: { creeLe: "desc" }, take: 20, select: { id: true, note: true, commentaire: true, creeLe: true } }),
    ]);
    return NextResponse.json({
      moyenne: agg._avg.note ? Math.round(agg._avg.note * 10) / 10 : null,
      nombre: agg._count,
      avis,
    });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
