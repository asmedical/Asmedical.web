import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Messagerie côté patient/établissement. L'identité vient TOUJOURS du jeton
// de session (jamais d'un paramètre client) : chacun n'accède qu'à son fil.
async function identifier(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const {
    data: { user },
  } = await admin.auth.getUser(token);
  return user || null;
}

// GET : mon fil (et marque les messages de l'équipe comme lus).
export async function GET(req) {
  try {
    const user = await identifier(req);
    if (!user) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });

    const messages = await prisma.message.findMany({
      where: { userId: user.id },
      orderBy: { creeLe: "asc" },
      take: 200,
    });
    await prisma.message.updateMany({
      where: { userId: user.id, deEquipe: true, luParPatient: false },
      data: { luParPatient: true },
    });
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// POST : j'écris à l'équipe.
export async function POST(req) {
  try {
    const user = await identifier(req);
    if (!user) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    if (!autorise(`msg:${user.id}`, 20, 60000)) {
      return NextResponse.json({ erreur: "Trop de messages, patientez un instant." }, { status: 429 });
    }

    const { texte } = await req.json();
    const propre = String(texte || "").trim().slice(0, 1000);
    if (!propre) return NextResponse.json({ erreur: "message vide" }, { status: 400 });

    const message = await prisma.message.create({
      data: { userId: user.id, deEquipe: false, texte: propre },
    });
    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
