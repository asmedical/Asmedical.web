import { NextResponse } from "next/server";
import { identite } from "@/lib/rattachements";
import { validerCode, codeParrainageDe, RECOMPENSE_PARRAIN } from "@/lib/offres";
import { prisma } from "@/lib/prisma";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// GET  → mon code de parrainage (créé au premier appel) + compteur.
// POST → vérifier un code AVANT réservation (sans le consommer).
export async function GET(req) {
  const id = await identite(req);
  if (!id) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
  try {
    const nom = [id.profil?.prenom, id.profil?.nom].filter(Boolean).join(" ");
    const code = await codeParrainageDe(id.user.id, nom);
    const usages = await prisma.codePromoUsage.count({ where: { codeId: code.id } });
    return NextResponse.json({
      code: code.code, remiseFilleul: `${code.valeur} %`, plafond: code.plafond,
      recompenseParrain: RECOMPENSE_PARRAIN, filleuls: usages,
    });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`promo:${ip}`, 12, 60000)) {
      return NextResponse.json({ erreur: "Trop de tentatives." }, { status: 429 });
    }
    const { code, service, telephone } = await req.json();
    const id = await identite(req); // facultatif : bloque l'auto-parrainage
    const v = await validerCode(code, { service, telephone, userId: id?.user?.id });
    if (v.erreur) return NextResponse.json({ erreur: v.erreur }, { status: 400 });
    return NextResponse.json({ ok: true, type: v.code.type, valeur: v.code.valeur, plafond: v.code.plafond });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
