import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Messagerie côté équipe : boîte de réception (toutes les conversations),
// fil d'un compte, réponse. Réservé aux rôles internes.

// GET                → liste des conversations (dernier message, non-lus, identité)
// GET ?userId=<uuid> → fil complet du compte (marque ses messages comme lus)
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const userId = new URL(req.url).searchParams.get("userId");

    if (userId) {
      const messages = await prisma.message.findMany({
        where: { userId },
        orderBy: { creeLe: "asc" },
        take: 300,
      });
      await prisma.message.updateMany({
        where: { userId, deEquipe: false, luParEquipe: false },
        data: { luParEquipe: true },
      });
      return NextResponse.json({ messages });
    }

    // Conversations : groupées par compte, plus récentes d'abord.
    const groupes = await prisma.message.groupBy({
      by: ["userId"],
      _max: { creeLe: true },
      orderBy: { _max: { creeLe: "desc" } },
      take: 100,
    });
    const nonLus = await prisma.message.groupBy({
      by: ["userId"],
      where: { deEquipe: false, luParEquipe: false },
      _count: { _all: true },
    });
    const carteNonLus = Object.fromEntries(nonLus.map((g) => [g.userId, g._count._all]));

    const derniers = await Promise.all(
      groupes.map((g) =>
        prisma.message.findFirst({
          where: { userId: g.userId },
          orderBy: { creeLe: "desc" },
          select: { texte: true, deEquipe: true, creeLe: true },
        })
      )
    );

    // Identités depuis les profils Supabase.
    const ids = groupes.map((g) => g.userId);
    let profils = {};
    if (ids.length) {
      const { data } = await acces.admin
        .from("profil")
        .select("id, prenom, nom, etablissement, telephone")
        .in("id", ids);
      profils = Object.fromEntries((data || []).map((p) => [p.id, p]));
    }

    const conversations = groupes.map((g, i) => {
      const p = profils[g.userId];
      const nom = p
        ? p.etablissement || [p.prenom, p.nom].filter(Boolean).join(" ") || p.telephone
        : "Compte " + g.userId.slice(0, 6);
      return {
        userId: g.userId,
        nom,
        telephone: p?.telephone || null,
        dernier: derniers[i],
        nonLus: carteNonLus[g.userId] || 0,
      };
    });
    return NextResponse.json({ conversations });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// POST : l'équipe répond dans le fil d'un compte.
export async function POST(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const { userId, texte } = await req.json();
    const propre = String(texte || "").trim().slice(0, 1000);
    if (!userId || !propre) return NextResponse.json({ erreur: "invalide" }, { status: 400 });

    const message = await prisma.message.create({
      data: { userId: String(userId), deEquipe: true, auteur: acces.nomAffiche, texte: propre },
    });
    await journaliser(acces.nomAffiche, "message.envoye", "client", userId);
    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
