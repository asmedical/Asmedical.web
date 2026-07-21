import { NextResponse } from "next/server";
import { identite } from "@/lib/rattachements";
import { preferencesDe, enregistrerPreferences, soignantsConnus } from "@/lib/preferences";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Préférences de soin du patient connecté : consignes pratiques (allergies,
// étage, code porte), préférence homme/femme, intervenant favori.
// Les consignes ne sont montrées qu'à l'intervenant AFFECTÉ à une mission.

function telDe(id) {
  return id.user.phone || id.profil?.telephone || "";
}

export async function GET(req) {
  const id = await identite(req);
  if (!id) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
  try {
    const [preferences, connus] = await Promise.all([
      preferencesDe(id.user.id),
      soignantsConnus(telDe(id)),
    ]);
    return NextResponse.json({
      preferences: preferences || null,
      soignantsConnus: connus.map((s) => ({ id: s.id, nom: [s.prenom, s.nom].filter(Boolean).join(" "), genre: s.genre })),
    });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req) {
  const id = await identite(req);
  if (!id) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`prefs:${ip}`, 10, 60000)) {
      return NextResponse.json({ erreur: "Trop de tentatives." }, { status: 429 });
    }
    const c = await req.json();
    const r = await enregistrerPreferences(id.user.id, telDe(id), c);
    if (r.erreur) return NextResponse.json({ erreur: r.erreur }, { status: 400 });
    return NextResponse.json({ ok: true, preferences: r.preferences });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
