import { NextResponse } from "next/server";
import { verifierAdmin, journaliser, refus } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Fil de discussion d'une demande — côté ÉQUIPE : lecture et réponse.
// GET  /api/admin/fil?demande=ID
// POST /api/admin/fil { demandeId, texte }

export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const demandeId = new URL(req.url).searchParams.get("demande");
    if (!demandeId) return NextResponse.json({ erreur: "paramètre manquant" }, { status: 400 });
    const { messagesFil } = await import("@/lib/filDemande");
    return NextResponse.json({ messages: await messagesFil(demandeId) });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const c = await req.json();
    const { prisma } = await import("@/lib/prisma");
    const demande = await prisma.demande.findUnique({ where: { id: Number(c.demandeId) } });
    if (!demande) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
    const { ecrireFil, notifierFil } = await import("@/lib/filDemande");
    const res = await ecrireFil(demande.id, {
      userId: "equipe", nom: `${acces.nomAffiche} (ASM)`, texte: c.texte, deEquipe: true,
    });
    if (res.erreur) return NextResponse.json({ erreur: res.erreur }, { status: 400 });
    notifierFil(acces.admin, demande, {
      auteurUserId: "equipe", nomAuteur: "Équipe ASM", apercu: c.texte,
    }).catch(() => {});
    await journaliser(acces.nomAffiche, "fil.reponse", "demande", demande.id, String(c.texte || "").slice(0, 80));
    return NextResponse.json({ ok: true, message: res.message }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
