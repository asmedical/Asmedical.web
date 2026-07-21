import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { creerDevis } from "@/lib/offres";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Demande de devis publique : entre dans la file admin, l'équipe chiffre
// puis recontacte — aucun montant inventé automatiquement.
export async function POST(req) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`devis:${ip}`, 3, 3600000)) {
      return NextResponse.json({ erreur: "Trop de demandes — appelez-nous directement." }, { status: 429 });
    }
    const c = await req.json();
    const r = await creerDevis(c);
    if (r.erreur) return NextResponse.json({ erreur: r.erreur }, { status: 400 });
    await prisma.journal.create({
      data: { auteur: r.devis.nom, action: "devis.demande", entite: "devis", entiteId: String(r.devis.id), detail: r.devis.numero },
    }).catch(() => {});
    try {
      const { notifierEquipe } = await import("@/lib/notifier");
      await notifierEquipe({ id: r.devis.id, service: r.devis.service || "devis", nom: `📄 DEVIS ${r.devis.numero} — ${r.devis.nom}`, telephone: r.devis.telephone, date: "", notes: r.devis.besoin.slice(0, 200) });
    } catch {}
    return NextResponse.json({ ok: true, numero: r.devis.numero }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
