import { NextResponse } from "next/server";
import { getReglage } from "@/lib/creneaux";
import { creneauxParRessources, fenetresLivraison } from "@/lib/disponibilites";

export const dynamic = "force-dynamic";

// GET /api/creneaux                                  → réglages (horizon, horaires…)
// GET /api/creneaux?service=…&jour=…&commune=…&duree=…&typeTrajet=…
//   - domicile / transport → créneaux calculés depuis les RESSOURCES réelles
//     (soignants / transporteurs éligibles et libres, trajets et tampons compris)
//   - medicaments          → fenêtres de livraison avec capacité restante
export async function GET(req) {
  try {
    const p = new URL(req.url).searchParams;
    const service = p.get("service");
    const jour = p.get("jour");

    if (!service || !jour) {
      const reglage = await getReglage();
      return NextResponse.json({ reglage });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) {
      return NextResponse.json({ erreur: "jour invalide" }, { status: 400 });
    }

    if (service === "medicaments") {
      const fenetres = await fenetresLivraison(jour);
      return NextResponse.json({ fenetres });
    }

    const duree = Math.min(Math.max(parseInt(p.get("duree"), 10) || 60, 15), 480);
    const commune = (p.get("commune") || "").slice(0, 80);
    const typeTrajet = p.get("typeTrajet") || undefined;
    const { creneaux, mode } = await creneauxParRessources(service, jour, { duree, commune, typeTrajet });
    return NextResponse.json({ creneaux, mode });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
