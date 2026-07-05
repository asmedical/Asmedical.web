import { NextResponse } from "next/server";
import { creneauxDuJour, getReglage } from "@/lib/creneaux";

export const dynamic = "force-dynamic";

// GET /api/creneaux?service=transport&jour=2026-07-08
// → créneaux du jour avec leur disponibilité.
// GET /api/creneaux  (sans paramètre) → réglages (horizon, horaires…)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const service = searchParams.get("service");
    const jour = searchParams.get("jour");

    if (!service || !jour) {
      const reglage = await getReglage();
      return NextResponse.json({ reglage });
    }
    const creneaux = await creneauxDuJour(service, jour);
    return NextResponse.json({ creneaux });
  } catch (e) {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
