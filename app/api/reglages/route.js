import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReglage } from "@/lib/creneaux";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const reglage = await getReglage();
    return NextResponse.json(reglage);
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH : l'équipe ajuste horaires / horizon / capacités (rôle interne requis).
export async function PATCH(req) {
  const { verifierAdmin } = await import("@/lib/adminAuth");
  const acces = await verifierAdmin(req);
  if (!acces) return NextResponse.json({ erreur: "Accès refusé" }, { status: 403 });
  try {
    await getReglage(); // garantit la ligne id=1
    const c = await req.json();
    const champs = [
      "heureDebut",
      "heureFin",
      "joursHorizon",
      "capaciteTransport",
      "capaciteDomicile",
      "capaciteMedicaments",
      "tamponMin",
      "trajetDefautMin",
      "capaciteFenetre",
    ];
    const data = {};
    for (const k of champs) {
      const v = parseInt(c[k], 10);
      if (Number.isFinite(v) && v >= 0 && v <= 1000) data[k] = v;
    }
    if (c.affectationAuto !== undefined) data.affectationAuto = Boolean(c.affectationAuto);
    const maj = await prisma.reglage.update({ where: { id: 1 }, data });
    return NextResponse.json({ ok: true, reglage: maj });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
