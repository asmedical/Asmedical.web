import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { logErreur } from "@/lib/log";

export const dynamic = "force-dynamic";
const NOCACHE = { "Cache-Control": "no-store" };

// GET /api/status — état détaillé, NON public.
// Protégé par l'en-tête « x-status-token » qui doit valoir STATUS_TOKEN.
// N'expose aucune clé ni donnée patient (seulement des compteurs et des noms).
export async function GET(req) {
  const attendu = process.env.STATUS_TOKEN;
  const fourni = req.headers.get("x-status-token");
  if (!attendu || fourni !== attendu) {
    return NextResponse.json({ erreur: "non autorisé" }, { status: 401, headers: NOCACHE });
  }

  const detail = { horodatage: new Date().toISOString(), env: {}, base: {}, supabase: {} };

  const requis = [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  detail.env.presentes = requis.filter((k) => process.env[k]);
  detail.env.manquantes = requis.filter((k) => !process.env[k]);
  detail.env.notifications = Boolean(process.env.TELEGRAM_BOT_TOKEN || process.env.NOTIFY_WEBHOOK_URL);

  try {
    detail.base = { ok: true, nbDemandes: await prisma.demande.count() };
  } catch (e) {
    logErreur("status.base", e);
    detail.base = { ok: false };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    try {
      const admin = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await admin.storage.listBuckets();
      // Utile pour vérifier que le bucket « documents » est bien PRIVÉ (public:false)
      detail.supabase = {
        ok: !error,
        buckets: (data || []).map((b) => ({ nom: b.name, public: b.public })),
      };
    } catch (e) {
      logErreur("status.supabase", e);
      detail.supabase = { ok: false };
    }
  } else {
    detail.supabase = { ok: false, raison: "clés Supabase absentes" };
  }

  return NextResponse.json(detail, { headers: NOCACHE });
}
