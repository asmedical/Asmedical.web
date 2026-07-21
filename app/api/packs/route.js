import { NextResponse } from "next/server";
import { packsActifs } from "@/lib/offres";

export const dynamic = "force-dynamic";

// Packs de prestations visibles publiquement (prix forfaitaires affichés).
export async function GET(req) {
  try {
    const service = new URL(req.url).searchParams.get("service") || undefined;
    const packs = await packsActifs(service);
    return NextResponse.json({
      packs: packs.map((p) => ({
        id: p.id, nom: p.nom, nomAr: p.nomAr, description: p.description,
        descriptionAr: p.descriptionAr, service: p.service, prix: p.prix, dureeMin: p.dureeMin,
      })),
    });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
