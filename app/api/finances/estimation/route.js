import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { estimerPrestation } from "@/lib/finances";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// GET /api/finances/estimation?service=&date=AAAA-MM-JJTHH:MM&duree=&typeTrajet=&prioritaire=
// Prix ESTIMÉ avant réservation, aux tarifs en vigueur (+ remise du client
// connecté). Purement indicatif — le prix définitif est calculé à la clôture.
// Aucun tarif configuré → { disponible: false } (l'écran n'affiche rien).
export async function GET(req) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`estimation:${ip}`, 30, 60000)) {
      return NextResponse.json({ erreur: "Trop de demandes." }, { status: 429 });
    }
    const p = new URL(req.url).searchParams;
    const service = p.get("service");
    if (!["transport", "domicile", "medicaments"].includes(service)) {
      return NextResponse.json({ erreur: "service invalide" }, { status: 400 });
    }

    // Remise personnelle si le client est connecté (jeton facultatif).
    let compteId = null;
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (token) {
      try {
        const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
        const { data: { user } } = await admin.auth.getUser(token);
        if (user) {
          const compte = await prisma.compteFinancier.findUnique({ where: { userId: user.id } });
          compteId = compte?.id || null;
        }
      } catch {}
    }

    const estimation = await estimerPrestation({
      service,
      date: p.get("date") || undefined,
      dureeMin: Math.min(Math.max(parseInt(p.get("duree"), 10) || 60, 15), 480),
      typeTrajet: p.get("typeTrajet") || undefined,
      prioritaire: p.get("prioritaire") === "1",
      compteId,
      packId: p.get("pack") ? Number(p.get("pack")) : undefined,
    });
    if (!estimation) return NextResponse.json({ disponible: false });
    return NextResponse.json({ disponible: true, ...estimation });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
