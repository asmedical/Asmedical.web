import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/rappels — passe les rappels de rendez-vous dus (veille + 2 h).
// Appelée par le cron Vercel quotidien (Authorization: Bearer CRON_SECRET)
// et utilisable à la main. Sans CRON_SECRET posé, la route reste inoffensive :
// le verrou en base limite à une exécution toutes les 10 minutes et
// l'anti-doublon RappelRdv empêche tout rappel en double.
export async function GET(req) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const fourni =
        (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
        new URL(req.url).searchParams.get("cle") ||
        "";
      if (fourni !== secret) return NextResponse.json({ erreur: "refusé" }, { status: 403 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const admin = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

    const { tickRappels } = await import("@/lib/rappels");
    const res = await tickRappels({ admin });
    return NextResponse.json(res);
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
