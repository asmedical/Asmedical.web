import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Renvoie les VRAIES demandes du patient connecté (aucune donnée d'exemple).
// On identifie le patient par son jeton de session, puis on retrouve ses
// demandes par correspondance de numéro de téléphone (8 derniers chiffres,
// robuste aux différences de format +213 / 0…).
export async function GET(req) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ demandes: [] });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ demandes: [] });

    const admin = createClient(url, key, { auth: { persistSession: false } });
    const {
      data: { user },
    } = await admin.auth.getUser(token);
    if (!user) return NextResponse.json({ demandes: [] });

    const { data: profil } = await admin
      .from("profil")
      .select("telephone")
      .eq("id", user.id)
      .maybeSingle();

    const digits = (s) => String(s || "").replace(/\D/g, "");
    const cle =
      digits(user.phone).slice(-8) || digits(profil?.telephone).slice(-8);
    if (!cle) return NextResponse.json({ demandes: [] });

    const demandes = await prisma.demande.findMany({
      where: { telephone: { contains: cle } },
      orderBy: { creeLe: "desc" },
      take: 50,
      include: {
        soignant: { select: { prenom: true, nom: true, telephone: true } },
        transporteur: { select: { nom: true, telephone: true } },
      },
    });
    return NextResponse.json({ demandes });
  } catch {
    return NextResponse.json({ demandes: [] });
  }
}
