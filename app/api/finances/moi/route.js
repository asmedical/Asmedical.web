import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { compteFinancierPour, marquerRetards } from "@/lib/finances";
import { moyensDisponibles } from "@/lib/paiements";

export const dynamic = "force-dynamic";

// Identité stricte par jeton : chacun ne voit QUE ses données financières.
async function identifier(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;
  const { data: profil } = await admin.from("profil").select("*").eq("id", user.id).maybeSingle();
  return { user, profil };
}

// GET /api/finances/moi — espace « Paiements & factures » du client :
// compte financier (créé au premier accès), factures, paiements, tickets,
// abonnements, remises actives, moyens disponibles, points de paiement.
export async function GET(req) {
  try {
    const id = await identifier(req);
    if (!id) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });

    const compte = await compteFinancierPour(id.user.id, id.profil);
    await marquerRetards();

    const [factures, paiements, tickets, souscriptions, remises, points] = await Promise.all([
      prisma.facture.findMany({
        where: { compteId: compte.id, statut: { not: "BROUILLON" } },
        orderBy: { creeLe: "desc" },
        take: 100,
        include: { lignes: true },
      }),
      prisma.paiement.findMany({ where: { compteId: compte.id }, orderBy: { creeLe: "desc" }, take: 100, include: { remboursements: true } }),
      prisma.ticketEspeces.findMany({ where: { compteId: compte.id }, orderBy: { creeLe: "desc" }, take: 20 }),
      prisma.souscription.findMany({ where: { compteId: compte.id }, include: { plan: true }, orderBy: { creeLe: "desc" } }),
      prisma.remiseClient.findMany({ where: { compteId: compte.id }, orderBy: { creeLe: "desc" } }),
      prisma.pointPaiement.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
    ]);

    const duTotal = factures
      .filter((f) => ["EMISE", "PARTIELLEMENT_PAYEE", "EN_RETARD"].includes(f.statut))
      .reduce((s, f) => s + (f.total - f.paye), 0);
    const enRetard = factures
      .filter((f) => f.statut === "EN_RETARD")
      .reduce((s, f) => s + (f.total - f.paye), 0);

    return NextResponse.json({
      compte, factures, paiements, tickets, souscriptions, remises, points,
      resume: { duTotal, enRetard },
      moyens: moyensDisponibles(),
    });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
