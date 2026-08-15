import { NextResponse } from "next/server";
import { MAJ, RESUME_AR, SECTIONS, POLITIQUE, PRIMAUTE } from "@/lib/confidentialite";

// La politique de confidentialité, servie à l'application. Une seule source
// (lib/confidentialite.js) alimente le site et le téléphone : un document
// juridique ne peut pas exister en deux versions.
//
// SANS paramètre, la réponse est exactement celle qu'attendent les
// applications DÉJÀ installées : { maj, resumeAr, sections } en français.
// C'est ce contrat qui interdit de changer la forme — une version en
// circulation afficherait un écran vide, sans que rien ne le signale au
// déploiement. Le paramètre « langue » est purement additif.
export async function GET(req) {
  const demandee = new URL(req.url).searchParams.get("langue");
  const langue = POLITIQUE[demandee] ? demandee : "fr";
  const p = POLITIQUE[langue];

  return NextResponse.json(
    {
      langue,
      maj: langue === "fr" ? MAJ : p.maj,
      titre: p.titre,
      // Le résumé arabe accompagne la version française : sur la version
      // arabe il ferait doublon avec le document lui-même.
      resumeAr: langue === "fr" ? RESUME_AR : undefined,
      // Mention de primauté du français, absente de la version française.
      primaute: PRIMAUTE[langue],
      sections: langue === "fr" ? SECTIONS : p.sections,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
