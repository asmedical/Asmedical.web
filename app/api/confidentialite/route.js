import { NextResponse } from "next/server";
import { MAJ, RESUME_AR, SECTIONS } from "@/lib/confidentialite";

// La politique de confidentialité, servie telle quelle à l'application.
// Une seule source (lib/confidentialite.js) alimente le site et le
// téléphone : un document juridique ne peut pas exister en deux versions.
export async function GET() {
  return NextResponse.json(
    { maj: MAJ, resumeAr: RESUME_AR, sections: SECTIONS },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
