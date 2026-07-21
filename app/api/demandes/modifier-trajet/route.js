import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// POST /api/demandes/modifier-trajet
// { demandeId, destination, lat?, lng?, confirmer? }
//  - sans `confirmer` : APERÇU (nouvel itinéraire + nouveau prix, rien n'est écrit)
//  - avec `confirmer: true` : la destination est changée, chauffeur + équipe prévenus.
export async function POST(req) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ erreur: "config" }, { status: 500 });
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`modif-trajet:${user.id}:${ip}`, 10, 60000)) {
      return NextResponse.json({ erreur: "Trop de tentatives." }, { status: 429 });
    }
    const { data: profil } = await admin.from("profil").select("telephone").eq("id", user.id).maybeSingle();

    const c = await req.json();
    const { modifierDestination } = await import("@/lib/trajetLive");
    const res = await modifierDestination(c.demandeId, {
      userId: user.id,
      telephone: user.phone || profil?.telephone,
      destination: c.destination, lat: c.lat, lng: c.lng, confirmer: Boolean(c.confirmer),
    });
    if (res.erreur) return NextResponse.json({ erreur: res.erreur }, { status: res.erreur === "introuvable" ? 404 : 400 });

    // Confirmation : chauffeur (notification + push) et équipe prévenus.
    if (res.ok) {
      const d = res.demande;
      try {
        if (d.transporteur?.userId) {
          await prisma.notification.create({
            data: {
              userId: d.transporteur.userId, type: "rdv",
              titre: "🧭 Destination modifiée",
              corps: `Course n°${d.id} — nouvelle destination : ${d.destination}.`,
              auteur: "Suivi patient", statut: "NON_LU", lienType: "intervention", lienId: String(d.id),
            },
          });
          const { envoyerPush } = await import("@/lib/pushEnvoi");
          await envoyerPush(d.transporteur.userId, {
            titre: "🧭 Destination modifiée",
            corps: `Course n°${d.id} → ${d.destination}`,
            url: `/employe/interventions/${d.id}`,
          });
        }
        const { alerterEquipe } = await import("@/lib/notifier");
        await alerterEquipe(`🧭 Destination modifiée — course n°${d.id}\nNouvelle destination : ${d.destination}${d.distanceKm ? `\n${d.distanceKm} km · prix estimé ${d.prixEstime ?? "?"} DZD` : ""}`);
      } catch {}
    }
    return NextResponse.json(res);
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
