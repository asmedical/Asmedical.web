import { NextResponse } from "next/server";
import { ETAPES, TYPES, BESOINS, COMMUNES, FENETRES, PAIEMENTS } from "@/lib/parcours";

export const dynamic = "force-dynamic";

// Structure du parcours de réservation, servie à l'application.
// Le site importe lib/parcours.js directement ; le téléphone passe par ici.
// Une seule définition, deux supports : ajouter un type de demande ou une
// commune se fait à un seul endroit et apparaît des deux côtés.
export async function GET() {
  return NextResponse.json(
    { etapes: ETAPES, types: TYPES, besoins: BESOINS, communes: COMMUNES, fenetres: FENETRES, paiements: PAIEMENTS },
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}
