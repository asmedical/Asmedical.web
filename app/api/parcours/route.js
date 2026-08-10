import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ETAPES, TYPES, BESOINS, COMMUNES, FENETRES, PAIEMENTS } from "@/lib/parcours";

export const dynamic = "force-dynamic";

// Structure du parcours de réservation, servie au site ET à l'application.
// Une seule définition, deux supports : ajouter un type de demande ou une
// commune se fait à un seul endroit et apparaît des deux côtés.
//
// Les actes à domicile ne sont PAS figés dans le code : ils sont configurés
// en back-office (table TypeActe), avec leur durée — c'est elle qui fixe la
// longueur du créneau réservé. La liste de lib/parcours.js ne sert que si
// aucun acte n'est encore configuré, ou si la base est injoignable : mieux
// vaut une liste de secours qu'un écran de réservation vide.
export async function GET() {
  let domicile = TYPES.domicile;
  try {
    const actes = await prisma.typeActe.findMany({
      where: { actif: true },
      orderBy: { id: "asc" },
      select: { id: true, libelle: true, libelleAr: true, dureeMin: true },
    });
    if (actes.length) {
      // « texte » plutôt que « libelle » : ces intitulés viennent de la base,
      // ce ne sont pas des clés de traduction. Les écrans distinguent les
      // deux — sinon un acte configuré s'afficherait sous forme de clé brute.
      domicile = actes.map((a) => ({
        cle: `acte:${a.id}`,
        texte: a.libelle,
        texteAr: a.libelleAr || null,
        duree: a.dureeMin || 60,
      }));
    }
  } catch {}

  return NextResponse.json(
    {
      etapes: ETAPES,
      types: { ...TYPES, domicile },
      besoins: BESOINS,
      communes: COMMUNES,
      fenetres: FENETRES,
      paiements: PAIEMENTS,
    },
    // Court : un acte ajouté en back-office doit apparaître vite, sans
    // pour autant refaire la requête à chaque écran ouvert.
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}
