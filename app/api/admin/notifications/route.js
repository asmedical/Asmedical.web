import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const TYPES = ["message", "document", "rdv", "rappel"];
const DOC_TYPES = ["piece_identite", "ordonnance", "justificatif", "medical", "autre"];

// GET ?userId=<uuid> → notifications envoyées à ce compte (avec statut lu).
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) return NextResponse.json({ erreur: "userId manquant" }, { status: 400 });
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { creeLe: "desc" },
      take: 100,
    });
    return NextResponse.json({ notifications });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// POST { userId, type, titre, corps?, docType? } → notifier un client.
export async function POST(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const c = await req.json();
    const titre = String(c.titre || "").trim().slice(0, 140);
    if (!c.userId || !titre) return NextResponse.json({ erreur: "invalide" }, { status: 400 });
    const type = TYPES.includes(c.type) ? c.type : "message";

    const notification = await prisma.notification.create({
      data: {
        userId: String(c.userId),
        type,
        titre,
        corps: c.corps ? String(c.corps).trim().slice(0, 2000) : null,
        docType: type === "document" && DOC_TYPES.includes(c.docType) ? c.docType : null,
        auteur: acces.nomAffiche,
      },
    });
    await journaliser(acces.nomAffiche, "notification.envoyee", "client", c.userId, `${type} : ${titre}`);
    return NextResponse.json({ ok: true, notification }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH { id, statut } → marquer traité (ex. document reçu).
export async function PATCH(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const { id, statut } = await req.json();
    if (!id || !["TRAITEE", "LU", "NON_LU"].includes(statut)) {
      return NextResponse.json({ erreur: "invalide" }, { status: 400 });
    }
    const maj = await prisma.notification.update({ where: { id: Number(id) }, data: { statut } });
    await journaliser(acces.nomAffiche, "notification.statut", "client", maj.userId, `${id} → ${statut}`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
