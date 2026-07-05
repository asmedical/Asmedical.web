import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { agregerStatut, avecDelai } from "@/lib/health";

export const dynamic = "force-dynamic";
const NOCACHE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

// GET /api/health — contrôle de santé public (aucune donnée sensible exposée).
// Réponse : { statut: OK | WARNING | ERROR, checks: {...} }
// Code HTTP : 200 si OK/WARNING, 503 si ERROR (pour les moniteurs externes).
export async function GET() {
  const checks = {};

  // 1. Variables d'environnement indispensables (on ne montre que les NOMS manquants)
  const requis = ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const manquantes = requis.filter((k) => !process.env[k]);
  checks.env = { ok: manquantes.length === 0, critique: true, ...(manquantes.length ? { manquantes } : {}) };

  // 2. Base de données Railway / PostgreSQL (via Prisma)
  try {
    await avecDelai(prisma.$queryRaw`SELECT 1`, 4000);
    checks.base = { ok: true, critique: true };
  } catch {
    checks.base = { ok: false, critique: true };
  }

  // 3. Supabase (comptes + documents) — réellement utilisé par le site.
  //    L'appel exige l'en-tête « apikey » (clé publique anon) ; sans lui,
  //    Supabase répond 401 et le contrôle donnerait un faux négatif.
  //    Non critique : si Supabase est indisponible, la prise de rendez-vous
  //    fonctionne encore → WARNING (pas ERROR).
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: anon },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      checks.supabase = { ok: r.ok, critique: false };
    } catch {
      checks.supabase = { ok: false, critique: false };
    }
  } else {
    // Clés Supabase absentes : c'est une vraie anomalie de config.
    checks.supabase = { ok: false, critique: false, raison: "clés Supabase absentes" };
  }

  const statut = agregerStatut(checks);
  return NextResponse.json(
    { statut, horodatage: new Date().toISOString(), checks },
    { status: statut === "ERROR" ? 503 : 200, headers: NOCACHE }
  );
}
