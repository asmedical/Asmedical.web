import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { identite, normTel } from "@/lib/rattachements";
import { renouvelerCommande } from "@/lib/documentsDemande";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Renouvellement en UN bouton d'une commande de médicaments terminée —
// par le patient lui-même ou un proche/établissement autorisé.
export async function POST(req) {
  const id = await identite(req);
  if (!id) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`renouveler:${ip}`, 5, 60000)) {
      return NextResponse.json({ erreur: "Trop de demandes." }, { status: 429 });
    }

    const { demandeId } = await req.json();
    const source = await prisma.demande.findUnique({ where: { id: Number(demandeId) } });
    if (!source) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });

    // Propriété : mon téléphone OU une procuration ACCEPTE couvrant les médicaments.
    const mienne =
      normTel(source.telephone) &&
      (normTel(source.telephone) === normTel(id.user.phone) ||
        normTel(source.telephone) === normTel(id.profil?.telephone));
    let par = [id.profil?.prenom, id.profil?.nom].filter(Boolean).join(" ") || "patient";
    if (!mienne) {
      const { prochesAutorises } = await import("@/lib/proches");
      const lien = (await prochesAutorises(source.telephone, "medicaments")).find(
        (l) => l.etabUserId === id.user.id
      );
      if (!lien) return NextResponse.json({ erreur: "non autorisé" }, { status: 403 });
      par = lien.etabNom || par;
    }

    const r = await renouvelerCommande(source, { par });
    if (r.erreur) return NextResponse.json({ erreur: r.erreur }, { status: 400 });

    // L'équipe est prévenue comme pour toute nouvelle demande.
    try {
      const { notifierEquipe } = await import("@/lib/notifier");
      await notifierEquipe(r.demande);
    } catch {}

    return NextResponse.json({ ok: true, id: r.demande.id, ordonnances: r.ordonnances }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
