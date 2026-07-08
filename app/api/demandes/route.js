import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifierEquipe } from "@/lib/notifier";
import { getReglage, capacitePour } from "@/lib/creneaux";
import { logErreur } from "@/lib/log";
import { autorise } from "@/lib/ratelimit";

// POST /api/demandes — un patient ou un établissement envoie une demande
export async function POST(req) {
  try {
    // Limitation anti-abus légère (par IP) — voir lib/ratelimit.js
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`demande:${ip}`, 10, 60000)) {
      return NextResponse.json({ erreur: "Trop de demandes, réessayez dans une minute." }, { status: 429 });
    }

    const corps = await req.json();
    const { service, telephone } = corps;

    if (!service || !telephone || telephone.trim().length < 9) {
      return NextResponse.json({ erreur: "Données invalides" }, { status: 400 });
    }

    const texte = (v, max) => (v ? String(v).slice(0, max) : null);
    const dateSlot = String(corps.date || "").slice(0, 16);

    // Sous-mode du moteur de réservation (Mode B transport / Mode C livraison).
    // « urgent » passe automatiquement en tête de liste côté équipe.
    const SOUS_MODES = ["ponctuel", "urgent", "abonnement", "fenetre"];
    const sousMode = SOUS_MODES.includes(corps.sousMode) ? corps.sousMode : null;

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
            details: texte(corps.details, 1500),
            espace: corps.espace === "pro" ? "pro" : "patient",
            sousMode,
            prioritaire: sousMode === "urgent",
            fenetre: texte(corps.fenetre, 60),
            pharmacie: texte(corps.pharmacie, 200),
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
    logErreur("demandes.POST", e);
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// GET /api/demandes — lecture réservée à l'équipe (données personnelles !).
// Les patients passent par /api/mes-demandes (leurs demandes uniquement) ;
// l'admin passe par /api/admin/demandes. Cette route reste pour
// compatibilité mais exige désormais un jeton interne.
export async function GET(req) {
  const { verifierAdmin } = await import("@/lib/adminAuth");
  const acces = await verifierAdmin(req);
  if (!acces) return NextResponse.json({ erreur: "Accès refusé" }, { status: 403 });
  try {
    const demandes = await prisma.demande.findMany({
      orderBy: { creeLe: "desc" },
      take: 100,
    });
    return NextResponse.json(demandes);
  } catch (e) {
    logErreur("demandes.GET", e);
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// (L'ancien PATCH public a été supprimé : les mises à jour de statut passent
// exclusivement par /api/admin/demandes, protégé par rôle.)
