import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// POST /api/demandes/retour-pret { demandeId } — le patient connecté
// déclenche le retour de SON transport : « Je suis prêt ». Le chauffeur
// (notification + push) et l'équipe (Telegram/webhook) sont prévenus.
export async function POST(req) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`retour:${ip}`, 10, 60000)) {
      return NextResponse.json({ erreur: "Trop d'appels, réessayez dans une minute." }, { status: 429 });
    }

    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ erreur: "config" }, { status: 500 });
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });

    const { data: profil } = await admin.from("profil").select("telephone").eq("id", user.id).maybeSingle();
    const telephone = user.phone || profil?.telephone || "";

    const corps = await req.json().catch(() => ({}));
    const { marquerRetourPret } = await import("@/lib/trajetLive");
    const res = await marquerRetourPret(corps.demandeId, telephone);
    if (res.erreur) {
      return NextResponse.json({ erreur: res.erreur }, { status: res.erreur === "introuvable" ? 404 : 409 });
    }
    if (res.deja) return NextResponse.json({ ok: true, deja: true });

    const d = res.demande;
    const quand = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    // Chauffeur affecté : notification interne + push sur son espace employé.
    try {
      if (d.transporteur?.userId) {
        await prisma.notification.create({
          data: {
            userId: d.transporteur.userId, type: "rdv",
            titre: "🟢 Patient prêt pour le retour",
            corps: `${d.nom || "Le patient"} (course n°${d.id}) est prêt à être récupéré.`,
            auteur: "Suivi patient", statut: "NON_LU",
            lienType: "intervention", lienId: String(d.id),
          },
        });
        const { envoyerPush } = await import("@/lib/pushEnvoi");
        await envoyerPush(d.transporteur.userId, {
          titre: "🟢 Patient prêt pour le retour",
          corps: `Course n°${d.id} — ${d.nom || "patient"} vous attend.`,
          url: `/employe/interventions/${d.id}`,
        });
      }
    } catch {}

    // Équipe ASM : mêmes canaux que les nouvelles demandes.
    try {
      const { alerterEquipe } = await import("@/lib/notifier");
      await alerterEquipe(
        `🟢 Retour demandé — course n°${d.id}\n${d.nom || "Patient"} est prêt (${quand}).` +
          (d.destination ? `\nLieu : ${d.destination}` : "") +
          (d.transporteur?.nom ? `\nChauffeur : ${d.transporteur.nom}` : "\n⚠ Aucun chauffeur affecté")
      );
    } catch {}

    await prisma.journal.create({
      data: {
        auteur: d.nom || "patient",
        action: "demande.retour_pret",
        entite: "demande",
        entiteId: String(d.id),
        detail: `« Je suis prêt » appuyé à ${quand}`,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
