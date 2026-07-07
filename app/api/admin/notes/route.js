import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const ENTITES = ["demande", "client", "soignant", "transporteur"];

// GET /api/admin/notes?entite=demande&entiteId=12
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const p = new URL(req.url).searchParams;
    const entite = p.get("entite");
    const entiteId = p.get("entiteId");
    if (!ENTITES.includes(entite) || !entiteId) {
      return NextResponse.json({ erreur: "paramètres invalides" }, { status: 400 });
    }
    const notes = await prisma.noteInterne.findMany({
      where: { entite, entiteId: String(entiteId) },
      orderBy: { creeLe: "desc" },
      take: 100,
    });
    return NextResponse.json({ notes });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const c = await req.json();
    if (!ENTITES.includes(c.entite) || !c.entiteId || !c.texte?.trim()) {
      return NextResponse.json({ erreur: "paramètres invalides" }, { status: 400 });
    }
    const note = await prisma.noteInterne.create({
      data: {
        entite: c.entite,
        entiteId: String(c.entiteId),
        auteur: acces.nomAffiche,
        texte: String(c.texte).trim().slice(0, 2000),
      },
    });
    await journaliser(acces.nomAffiche, "note.ajoutee", c.entite, c.entiteId);
    return NextResponse.json({ ok: true, note }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
