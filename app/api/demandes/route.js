import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifierEquipe } from "@/lib/notifier";
import { getReglage, capacitePour } from "@/lib/creneaux";

// POST /api/demandes — un patient ou un établissement envoie une demande
export async function POST(req) {
  try {
    const corps = await req.json();
    const { service, telephone } = corps;

    if (!service || !telephone || telephone.trim().length < 9) {
      return NextResponse.json({ erreur: "Données invalides" }, { status: 400 });
    }

    const texte = (v, max) => (v ? String(v).slice(0, max) : null);
    const dateSlot = String(corps.date || "").slice(0, 16);

    // Contrôle anti-double-réservation : si un créneau précis est choisi,
    // on vérifie que la capacité n'est pas atteinte, dans une transaction.
    const serviceNorm = String(service).slice(0, 30);
    let demande;
    try {
      demande = await prisma.$transaction(async (tx) => {
        if (dateSlot.includes("T")) {
          const reglage = await getReglage();
          const capacite = capacitePour(reglage, serviceNorm);
          const pris = await tx.demande.count({
            where: { service: serviceNorm, date: dateSlot, statut: { not: "ANNULEE" } },
          });
          if (pris >= capacite) {
            const err = new Error("creneau_pris");
            err.code = "CRENEAU_PRIS";
            throw err;
          }
        }
        return tx.demande.create({
          data: {
            service: serviceNorm,
            typeTrajet: texte(corps.typeTrajet, 30),
            nom: texte(corps.nom, 80),
            telephone: String(telephone).slice(0, 20),
            depart: texte(corps.depart, 160),
            destination: texte(corps.destination, 160),
            date: dateSlot,
            recurrence: String(corps.recurrence || "Une seule fois").slice(0, 80),
            notes: texte(corps.notes, 500),
            espace: corps.espace === "pro" ? "pro" : "patient",
          },
        });
      });
    } catch (e) {
      if (e.code === "CRENEAU_PRIS") {
        return NextResponse.json({ erreur: "creneau_pris" }, { status: 409 });
      }
      throw e;
    }
    await notifierEquipe(demande);
    return NextResponse.json({ ok: true, id: demande.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// GET /api/demandes — l'équipe consulte les demandes (back-office)
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
