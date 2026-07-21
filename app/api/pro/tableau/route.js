import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// GET /api/pro/tableau — tableau de bord de l'ÉTABLISSEMENT connecté :
// statistiques réelles du mois, historique 6 mois, restant dû, et vue
// consolidée du groupe si le compte appartient à un groupe multi-sites.
// Le périmètre est recalculé côté serveur (jamais fourni par le client).
export async function GET(req) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ erreur: "config" }, { status: 500 });
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    const { data: profil } = await admin.from("profil").select("role, etablissement").eq("id", user.id).maybeSingle();
    if (profil?.role !== "pro") return NextResponse.json({ erreur: "réservé aux établissements" }, { status: 403 });

    const { perimetreDe } = await import("@/lib/groupes");
    const { statsEtablissement } = await import("@/lib/pilotage");

    // Mon site seul, puis le groupe entier si j'en fais partie.
    const { userIds, groupe } = await perimetreDe(user.id);
    const [moi, ensemble] = await Promise.all([
      statsEtablissement([user.id]),
      groupe ? statsEtablissement(userIds) : null,
    ]);

    let vueGroupe = null;
    if (groupe && ensemble) {
      // Nom d'affichage de chaque site : nom posé par l'admin, sinon le
      // nom d'établissement du profil.
      const { data: profils } = await admin
        .from("profil").select("id, etablissement").in("id", groupe.membres.map((m) => m.userId));
      const nomDe = Object.fromEntries((profils || []).map((p) => [p.id, p.etablissement]));
      vueGroupe = {
        nom: groupe.nom,
        stats: { mois: ensemble.mois, moisCourant: ensemble.moisCourant, resteDu: ensemble.resteDu },
        sites: groupe.membres.map((m) => ({
          moi: m.userId === user.id,
          nom: m.nom || nomDe[m.userId] || "Site",
          demandesMois: ensemble.parSite[m.userId] || 0,
        })),
      };
    }

    return NextResponse.json({
      etablissement: profil?.etablissement || null,
      stats: moi && { mois: moi.mois, moisCourant: moi.moisCourant, resteDu: moi.resteDu },
      groupe: vueGroupe,
    });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
