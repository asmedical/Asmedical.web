import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/demandes — un patient envoie une demande depuis le site
export async function POST(req) {
  try {
    const corps = await req.json();
    const { service, telephone, date, recurrence } = corps;

    if (!service || !telephone || telephone.trim().length < 9) {
      return NextResponse.json({ erreur: "Données invalides" }, { status: 400 });
    }

    const demande = await prisma.demande.create({
      data: {
        service: String(service).slice(0, 30),
        telephone: String(telephone).slice(0, 20),
        date: String(date || "").slice(0, 10),
        recurrence: String(recurrence || "Une seule fois").slice(0, 80),
      },
    });
    return NextResponse.json({ ok: true, id: demande.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// GET /api/demandes — l'équipe consulte les demandes (espace pro)
export async function GET() {
  try {
    const demandes = await prisma.demande.findMany({
      orderBy: { creeLe: "desc" },
      take: 100,
    });
    return NextResponse.json(demandes);
  } catch (e) {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/demandes — mise à jour statut/chauffeur par l'équipe
export async function PATCH(req) {
  try {
    const { id, statut, chauffeur } = await req.json();
    if (!id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });
    const data = {};
    if (statut) data.statut = String(statut).slice(0, 20);
    if (chauffeur !== undefined) data.chauffeur = chauffeur ? String(chauffeur).slice(0, 60) : null;
    const maj = await prisma.demande.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ ok: true, demande: maj });
  } catch (e) {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
