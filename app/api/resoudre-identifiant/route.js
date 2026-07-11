import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Résout un « nom d'utilisateur » (nom de code) vers l'email du compte,
// pour permettre la connexion par identifiant. Utilise la clé service_role
// (côté serveur uniquement) car la lecture croisée contourne la RLS.
// Limité par IP pour empêcher l'énumération d'identifiants/emails.
export async function POST(req) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`resoudre:${ip}`, 8, 60000)) {
      return NextResponse.json({ erreur: "trop de tentatives" }, { status: 429 });
    }

    const { identifiant } = await req.json();
    const nom = String(identifiant || "").trim().slice(0, 80);
    if (!nom) return NextResponse.json({ erreur: "vide" }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ erreur: "config" }, { status: 500 });

    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await admin
      .from("profil")
      .select("email")
      .eq("nom_utilisateur", nom)
      .maybeSingle();

    if (!data?.email) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
    return NextResponse.json({ email: data.email });
  } catch {
    return NextResponse.json({ erreur: "erreur" }, { status: 500 });
  }
}
