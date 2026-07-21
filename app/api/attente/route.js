import { NextResponse } from "next/server";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// POST /api/attente — s'inscrire sur un créneau complet pour être prévenu
// automatiquement si une place se libère (annulation / reprogrammation).
export async function POST(req) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`attente:${ip}`, 6, 60000)) {
      return NextResponse.json({ erreur: "Trop d'inscriptions, réessayez dans une minute." }, { status: 429 });
    }
    const c = await req.json().catch(() => ({}));
    const { rejoindreAttente } = await import("@/lib/attente");
    const res = await rejoindreAttente({
      service: c.service,
      date: c.date,
      telephone: c.telephone,
      nom: c.nom,
      commune: c.commune,
      typeTrajet: c.typeTrajet,
      duree: c.duree,
    });
    if (res.erreur) return NextResponse.json({ erreur: res.erreur }, { status: 400 });
    if (res.deja) return NextResponse.json({ ok: true, deja: true });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// GET /api/attente — vue équipe : inscriptions à venir (rôles internes).
export async function GET(req) {
  const { verifierAdmin } = await import("@/lib/adminAuth");
  const acces = await verifierAdmin(req);
  if (!acces) return NextResponse.json({ erreur: "Accès refusé" }, { status: 403 });
  try {
    const { attentesAdmin } = await import("@/lib/attente");
    return NextResponse.json({ attentes: await attentesAdmin() });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
