import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, refus } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// GET /api/admin/planning?debut=AAAA-MM-JJ&fin=AAAA-MM-JJ
// Toutes les données du calendrier : demandes datées de la période
// + intervenants actifs (horaires, repos, congés) pour tracer les colonnes.
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const p = new URL(req.url).searchParams;
    const debut = (p.get("debut") || "").slice(0, 10);
    const fin = (p.get("fin") || debut).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(debut) || !/^\d{4}-\d{2}-\d{2}$/.test(fin)) {
      return NextResponse.json({ erreur: "période invalide" }, { status: 400 });
    }

    const [demandes, soignants, transporteurs] = await Promise.all([
      // Les dates sont stockées "AAAA-MM-JJTHH:MM" : la comparaison de
      // chaînes suit l'ordre chronologique.
      prisma.demande.findMany({
        where: { date: { gte: debut, lte: fin + "T23:59" } },
        orderBy: { date: "asc" },
        take: 500,
        select: {
          id: true, service: true, typeTrajet: true, nom: true, telephone: true,
          date: true, dureeMin: true, fenetre: true, statut: true, prioritaire: true,
          commune: true, destination: true, problemeLe: true,
          soignantId: true, transporteurId: true,
          soignant: { select: { prenom: true, nom: true } },
          transporteur: { select: { nom: true } },
        },
      }),
      prisma.soignant.findMany({
        where: { statut: "VALIDE" },
        orderBy: [{ prenom: "asc" }, { nom: "asc" }],
        select: {
          id: true, prenom: true, nom: true, qualification: true, photoUrl: true,
          heureDebut: true, heureFin: true, joursOff: true, conges: true, dispo: true,
        },
      }),
      prisma.transporteur.findMany({
        where: { statut: "VALIDE" },
        orderBy: { nom: "asc" },
        select: {
          id: true, nom: true, typeTransport: true, vehicule: true, photoUrl: true,
          heureDebut: true, heureFin: true, joursOff: true, conges: true, dispo: true,
        },
      }),
    ]);

    return NextResponse.json({ demandes, soignants, transporteurs });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
