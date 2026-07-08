import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/actes — types d'actes à domicile actifs (Mode A).
// Public : uniquement des libellés et durées, aucune donnée personnelle.
export async function GET() {
  try {
    const actes = await prisma.typeActe.findMany({
      where: { actif: true },
      orderBy: { id: "asc" },
      select: { id: true, libelle: true, libelleAr: true, dureeMin: true, qualification: true },
    });
    return NextResponse.json({ actes });
  } catch {
    return NextResponse.json({ actes: [] });
  }
}
