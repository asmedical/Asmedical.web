import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Identité par jeton (patient, employé ou membre interne — tous peuvent
// activer les push : chacun ne reçoit que SES notifications).
async function identifier(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user } } = await admin.auth.getUser(token);
  return user || null;
}

// POST { subscription } → enregistre l'abonnement push de cet appareil.
export async function POST(req) {
  try {
    const user = await identifier(req);
    if (!user) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    const { subscription } = await req.json();
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (!endpoint || !p256dh || !auth || String(endpoint).length > 600) {
      return NextResponse.json({ erreur: "abonnement invalide" }, { status: 400 });
    }
    await prisma.pushAbonnement.upsert({
      where: { endpoint },
      update: { userId: user.id, p256dh, auth },
      create: { userId: user.id, endpoint, p256dh, auth },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE { endpoint } → désabonne cet appareil.
export async function DELETE(req) {
  try {
    const user = await identifier(req);
    if (!user) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ erreur: "endpoint manquant" }, { status: 400 });
    await prisma.pushAbonnement.deleteMany({ where: { endpoint, userId: user.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
