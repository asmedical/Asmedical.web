import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Renvoie les VRAIES demandes du patient connecté (aucune donnée d'exemple).
// On identifie le patient par son jeton de session, puis on retrouve ses
// demandes par correspondance de numéro de téléphone (8 derniers chiffres,
// robuste aux différences de format +213 / 0…).
export async function GET(req) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ demandes: [] });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ demandes: [] });

    const admin = createClient(url, key, { auth: { persistSession: false } });
    const {
      data: { user },
    } = await admin.auth.getUser(token);
    if (!user) return NextResponse.json({ demandes: [] });

    const { data: profil } = await admin
      .from("profil")
      .select("telephone, role")
      .eq("id", user.id)
      .maybeSingle();

    const digits = (s) => String(s || "").replace(/\D/g, "");
    const cle =
      digits(user.phone).slice(-8) || digits(profil?.telephone).slice(-8);
    if (!cle && profil?.role !== "pro") return NextResponse.json({ demandes: [] });

    // Correspondance sur les CHIFFRES uniquement : un numéro enregistré
    // « 0555 44 33 22 » doit matcher la clé « 55443322 » malgré les espaces.
    const { idsDemandesParTel } = await import("@/lib/telephones");
    const ids = cle ? await idsDemandesParTel(cle, 50) : [];
    // Un ÉTABLISSEMENT voit AUSSI les réservations qu'il a posées pour ses
    // patients (parEtabUserId = lui) — pas seulement celles à son numéro.
    const filtre =
      profil?.role === "pro"
        ? { OR: [{ id: { in: ids } }, { parEtabUserId: user.id }] }
        : { id: { in: ids } };
    const demandes = await prisma.demande.findMany({
      where: filtre,
      orderBy: { creeLe: "desc" },
      take: 50,
      include: {
        soignant: { select: { prenom: true, nom: true, telephone: true, photoUrl: true } },
        transporteur: { select: { nom: true, telephone: true, photoUrl: true, vehicule: true, vehiculeCouleur: true, vehiculeImmat: true } },
        avis: { select: { note: true, commentaire: true } },
      },
    });
    return NextResponse.json({ demandes });
  } catch {
    return NextResponse.json({ demandes: [] });
  }
}
