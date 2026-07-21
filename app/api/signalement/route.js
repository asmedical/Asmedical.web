import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { identite, normTel } from "@/lib/rattachements";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Signalement d'un problème sur une prestation, par le PATIENT concerné ou
// par un PROCHE/ÉTABLISSEMENT autorisé. Crée une note interne visible par
// l'équipe sur la fiche de la demande + alerte les canaux d'équipe.
export async function POST(req) {
  const id = await identite(req);
  if (!id) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`signal:${ip}`, 5, 3600000)) {
      return NextResponse.json({ erreur: "Trop de signalements — appelez-nous directement." }, { status: 429 });
    }

    const { demandeId, texte } = await req.json();
    const propre = String(texte || "").trim().slice(0, 800);
    if (!demandeId || propre.length < 5) {
      return NextResponse.json({ erreur: "Décrivez le problème en quelques mots." }, { status: 400 });
    }

    const demande = await prisma.demande.findUnique({ where: { id: Number(demandeId) } });
    if (!demande) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });

    // Appartenance : mon téléphone OU une procuration ACCEPTE sur ce patient.
    const mienne =
      normTel(demande.telephone) &&
      (normTel(demande.telephone) === normTel(id.user.phone) ||
        normTel(demande.telephone) === normTel(id.profil?.telephone));
    let auteur = [id.profil?.prenom, id.profil?.nom].filter(Boolean).join(" ") || "Client";
    if (!mienne) {
      const { prochesAutorises } = await import("@/lib/proches");
      const lien = (await prochesAutorises(demande.telephone, demande.service)).find(
        (l) => l.etabUserId === id.user.id
      );
      if (!lien) return NextResponse.json({ erreur: "non autorisé" }, { status: 403 });
      auteur = `${lien.etabNom || auteur} (proche autorisé)`;
    }

    await prisma.noteInterne.create({
      data: {
        entite: "demande",
        entiteId: String(demande.id),
        auteur: `Signalement client — ${auteur}`,
        texte: propre,
      },
    });
    await prisma.journal.create({
      data: { auteur, action: "signalement.client", entite: "demande", entiteId: String(demande.id), detail: propre.slice(0, 120) },
    });
    // Alerte l'équipe sur ses canaux (Telegram / webhook si configurés).
    try {
      const { notifierEquipe } = await import("@/lib/notifier");
      await notifierEquipe({
        ...demande,
        nom: `⚠ SIGNALEMENT — ${demande.nom || demande.telephone}`,
        notes: propre,
      });
    } catch {}

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
