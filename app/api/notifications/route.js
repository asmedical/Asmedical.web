import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Notifications / messages officiels côté patient. Identité issue
// exclusivement du jeton : chacun ne voit que ses notifications.
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

// GET             → liste complète (récentes d'abord)
// GET ?compteur=1 → uniquement les compteurs non lus (cloche/badges)
export async function GET(req) {
  try {
    const user = await identifier(req);
    if (!user) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });

    if (new URL(req.url).searchParams.get("compteur")) {
      const [notifs, chat] = await Promise.all([
        prisma.notification.count({ where: { userId: user.id, statut: "NON_LU" } }),
        prisma.message.count({ where: { userId: user.id, demandeId: null, deEquipe: true, luParPatient: false } }),
      ]);
      return NextResponse.json({ notifs, chat });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { creeLe: "desc" },
      take: 100,
    });
    return NextResponse.json({ notifications });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// POST { id } → marque une notification comme lue (la sienne uniquement).
export async function POST(req) {
  try {
    const user = await identifier(req);
    if (!user) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });
    await prisma.notification.updateMany({
      where: { id: Number(id), userId: user.id, statut: "NON_LU" },
      data: { statut: "LU", luLe: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
