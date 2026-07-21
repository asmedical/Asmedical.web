import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { autorise } from "@/lib/ratelimit";
import { cleTel } from "@/lib/telephones";

export const dynamic = "force-dynamic";

// Géographie (Google Maps Platform) — TOUT passe par le serveur : la clé
// n'atteint jamais le navigateur, chaque type d'appel est rate-limité et
// mis en cache (lib/googleMaps). Sans clé configurée, réponses vides :
// le site fonctionne comme avant (adresses libres, estimation horaire).
//
// GET ?type=suggestions&q=…&jeton=…      → suggestions d'adresses (Places New)
// GET ?type=lieu&id=…&jeton=…            → coordonnées du lieu choisi
// GET ?type=itineraire&deLat=…&aLat=…    → distance, durée, polyline (Routes API)
// GET ?type=suivi&demande=ID             → position chauffeur + ETA réelle (auth)

export async function GET(req) {
  try {
    const p = new URL(req.url).searchParams;
    const type = p.get("type");
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    const maps = await import("@/lib/googleMaps");

    if (type === "suggestions") {
      if (!autorise(`geo-sug:${ip}`, 30, 60000)) return NextResponse.json({ erreur: "trop d'appels" }, { status: 429 });
      const suggestions = await maps.suggererAdresses(p.get("q"), {
        jeton: (p.get("jeton") || "").slice(0, 64),
        langue: p.get("langue") === "ar" ? "ar" : "fr",
      });
      return NextResponse.json({ actif: maps.mapsConfigure(), suggestions: suggestions || [] });
    }

    if (type === "lieu") {
      if (!autorise(`geo-lieu:${ip}`, 15, 60000)) return NextResponse.json({ erreur: "trop d'appels" }, { status: 429 });
      const lieu = await maps.detaillerLieu(p.get("id"), {
        jeton: (p.get("jeton") || "").slice(0, 64),
        langue: p.get("langue") === "ar" ? "ar" : "fr",
      });
      return NextResponse.json({ lieu });
    }

    if (type === "itineraire") {
      if (!autorise(`geo-route:${ip}`, 12, 60000)) return NextResponse.json({ erreur: "trop d'appels" }, { status: 429 });
      const itineraire = await maps.calculerItineraire({
        deLat: p.get("deLat"), deLng: p.get("deLng"),
        aLat: p.get("aLat"), aLng: p.get("aLng"),
      });
      return NextResponse.json({ itineraire });
    }

    // ---- Suivi : position du chauffeur + ETA réelle (patient authentifié) ----
    if (type === "suivi") {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      if (!token) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) return NextResponse.json({ erreur: "config" }, { status: 500 });
      const admin = createClient(url, key, { auth: { persistSession: false } });
      const { data: { user } } = await admin.auth.getUser(token);
      if (!user) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
      const { data: profil } = await admin.from("profil").select("telephone").eq("id", user.id).maybeSingle();

      const d = await prisma.demande.findUnique({ where: { id: Number(p.get("demande")) } });
      const cle = cleTel(user.phone || profil?.telephone);
      const proprietaire = d && ((cle && cleTel(d.telephone) === cle) || d.parEtabUserId === user.id);
      if (!proprietaire) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });

      const reponse = {
        pos: d.posLat != null && d.posLe ? { lat: d.posLat, lng: d.posLng, le: d.posLe } : null,
        depart: d.departLat != null ? { lat: d.departLat, lng: d.departLng } : null,
        destination: d.destLat != null ? { lat: d.destLat, lng: d.destLng } : null,
        polyline: d.itineraire || null,
        eta: null,
      };
      // ETA réelle : itinéraire chauffeur → point de prise en charge,
      // avec trafic (cache 2 min côté lib — coût maîtrisé).
      const posRecente = reponse.pos && Date.now() - new Date(d.posLe).getTime() < 5 * 60000;
      if (posRecente && reponse.depart && d.enRouteLe && !d.arriveeLe) {
        const r = await maps.calculerItineraire({
          deLat: d.posLat, deLng: d.posLng, aLat: d.departLat, aLng: d.departLng, trafic: true,
        });
        if (r) reponse.eta = { minutes: r.minutes, km: r.km };
      }
      return NextResponse.json(reponse);
    }

    return NextResponse.json({ erreur: "type inconnu" }, { status: 400 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
