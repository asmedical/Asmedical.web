import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Abonnements ASM — page publique.
// GET  → plans actifs (+ ma souscription si connecté)
// POST { planId } → souscrire : souscription EN_ATTENTE_PAIEMENT + facture
// de première période, payée via le circuit existant (espèces/CIB/EDAHABIA/
// virement). L'abonnement ne s'ACTIVE qu'à la réception du paiement.

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
  return { user, profil: profil || {} };
}

export async function GET(req) {
  try {
    const plans = await prisma.planAbonnement.findMany({
      where: { actif: true },
      orderBy: [{ ordre: "asc" }, { prix: "asc" }],
      select: {
        id: true, nom: true, nomAr: true, description: true, descriptionAr: true,
        prix: true, frequence: true, service: true, quantiteIncluse: true,
        reductionPct: true, populaire: true,
      },
    });

    // Ma situation (facultatif — la page reste consultable déconnecté).
    let mienne = null;
    const id = await identifier(req);
    if (id) {
      const compte = await prisma.compteFinancier.findUnique({ where: { userId: id.user.id } });
      if (compte) {
        const s = await prisma.souscription.findFirst({
          where: { compteId: compte.id, statut: { in: ["ACTIF", "EN_ATTENTE_PAIEMENT"] } },
          include: { plan: { select: { nom: true } } },
          orderBy: { creeLe: "desc" },
        });
        if (s) mienne = { planId: s.planId, plan: s.plan.nom, statut: s.statut, fin: s.fin };
      }
    }
    return NextResponse.json({ plans, mienne });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const id = await identifier(req);
    if (!id) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`plans:${id.user.id}:${ip}`, 5, 60000)) {
      return NextResponse.json({ erreur: "Trop de tentatives." }, { status: 429 });
    }
    const { planId } = await req.json();
    const { souscrirePlan } = await import("@/lib/paiementReservation");
    const nom = id.profil.etablissement || [id.profil.prenom, id.profil.nom].filter(Boolean).join(" ") || null;
    const res = await souscrirePlan(planId, {
      userId: id.user.id, nom, telephone: id.user.phone || id.profil.telephone,
    });
    if (res.erreur) return NextResponse.json({ erreur: res.erreur }, { status: 400 });
    return NextResponse.json(res, { status: res.deja ? 200 : 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
