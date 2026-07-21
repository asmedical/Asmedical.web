import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// ÉCRAN DE PAIEMENT à la réservation — tout est décidé CÔTÉ SERVEUR.
// GET  ?demande=ID → contexte : gratuit | deja_regle | abonne | a_payer
// POST { demandeId, action }
//   action = "abonnement"                → couvrir par l'abonnement actif
//   action = "ticket",  code             → ticket prépayé d'agence
//   action = "simulation", moyen, resultat → paiement simulé (réglage requis)
//   action = "surplace"                  → paiement à la prestation (historique)

async function identifier(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;
  const { data: profil } = await admin.from("profil").select("telephone, prenom, nom, etablissement").eq("id", user.id).maybeSingle();
  return { user, telephone: user.phone || profil?.telephone || "", profil: profil || {} };
}

export async function GET(req) {
  try {
    const id = await identifier(req);
    if (!id) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    const demandeId = new URL(req.url).searchParams.get("demande");
    if (!demandeId) return NextResponse.json({ erreur: "paramètre manquant" }, { status: 400 });
    const { contextePaiement } = await import("@/lib/paiementReservation");
    const ctx = await contextePaiement(demandeId, { userId: id.user.id, telephone: id.telephone });
    if (ctx.erreur) return NextResponse.json({ erreur: ctx.erreur }, { status: 404 });
    return NextResponse.json(ctx);
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const id = await identifier(req);
    if (!id) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`paiement:${id.user.id}:${ip}`, 12, 60000)) {
      return NextResponse.json({ erreur: "Trop de tentatives, patientez une minute." }, { status: 429 });
    }
    const c = await req.json();
    const lib = await import("@/lib/paiementReservation");
    const qui = { userId: id.user.id, telephone: id.telephone };

    if (c.action === "abonnement") {
      const res = await lib.couvrirParAbonnement(c.demandeId, qui);
      if (res.erreur) return NextResponse.json({ erreur: res.erreur }, { status: res.erreur === "introuvable" ? 404 : 409 });
      return NextResponse.json(res);
    }
    if (c.action === "ticket") {
      const res = await lib.utiliserTicket(c.code, c.demandeId, qui);
      if (res.erreur) return NextResponse.json({ erreur: res.erreur }, { status: res.erreur === "introuvable" ? 404 : 400 });
      return NextResponse.json(res);
    }
    if (c.action === "simulation") {
      const res = await lib.paiementSimule(c.demandeId, { ...qui, moyen: c.moyen, resultat: c.resultat });
      if (res.erreur) return NextResponse.json({ erreur: res.erreur }, { status: 400 });
      return NextResponse.json(res);
    }
    if (c.action === "surplace") {
      // Comportement historique conservé : le règlement se fait à la
      // prestation (espèces) — la facture arrivera à la clôture.
      return NextResponse.json({ ok: true, surplace: true });
    }
    return NextResponse.json({ erreur: "action inconnue" }, { status: 400 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
