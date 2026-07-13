import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierWebhookChargily } from "@/lib/paiements";
import { confirmerPaiement } from "@/lib/finances";

export const dynamic = "force-dynamic";

// Webhook fournisseur (Chargily — CIB / EDAHABIA).
// LA SEULE preuve de paiement en ligne acceptée : signature vérifiée,
// événement enregistré, traitement idempotent (les doublons sont ignorés).
export async function POST(req) {
  const brut = await req.text();
  const signature = req.headers.get("signature") || "";

  if (!verifierWebhookChargily(brut, signature)) {
    return NextResponse.json({ erreur: "signature invalide" }, { status: 401 });
  }

  let evt;
  try {
    evt = JSON.parse(brut);
  } catch {
    return NextResponse.json({ erreur: "payload invalide" }, { status: 400 });
  }

  const evenementId = String(evt?.id || "");
  const type = String(evt?.type || "");
  const checkout = evt?.data || {};
  if (!evenementId) return NextResponse.json({ erreur: "événement sans id" }, { status: 400 });

  // Idempotence : un événement déjà reçu n'est jamais retraité.
  try {
    await prisma.evenementPaiement.create({
      data: { fournisseur: "chargily", evenementId, type },
    });
  } catch {
    return NextResponse.json({ ok: true, doublon: true });
  }

  try {
    const refInterne = checkout?.metadata?.referenceInterne || null;
    const paiement = refInterne
      ? await prisma.paiement.findUnique({ where: { reference: refInterne } })
      : await prisma.paiement.findFirst({ where: { refFournisseur: String(checkout?.id || "") } });

    if (!paiement) {
      await prisma.evenementPaiement.update({
        where: { evenementId },
        data: { statut: "ERREUR", erreur: "paiement interne introuvable" },
      });
      return NextResponse.json({ ok: true });
    }

    if (type === "checkout.paid") {
      const r = await confirmerPaiement(paiement.id); // idempotent (anti double imputation)
      if (!r.deja) {
        // Notification au client (interne + push).
        try {
          await prisma.notification.create({
            data: {
              userId: (await prisma.compteFinancier.findUnique({ where: { id: paiement.compteId } }))?.userId || "",
              type: "info", titre: "Paiement confirmé ✓",
              corps: `Votre paiement ${paiement.reference} de ${paiement.montant} DZD a été confirmé. Votre reçu est disponible.`,
              auteur: "ASM Finances", statut: "NON_LU",
            },
          });
        } catch {}
      }
    } else if (type === "checkout.failed" || type === "checkout.expired") {
      await prisma.paiement.updateMany({
        where: { id: paiement.id, statut: "EN_ATTENTE" },
        data: { statut: type === "checkout.expired" ? "EXPIRE" : "ECHOUE" },
      });
    }

    await prisma.evenementPaiement.update({ where: { evenementId }, data: { statut: "TRAITE" } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    await prisma.evenementPaiement.update({
      where: { evenementId },
      data: { statut: "ERREUR", erreur: String(e?.message || "").slice(0, 300) },
    }).catch(() => {});
    return NextResponse.json({ erreur: "traitement" }, { status: 500 });
  }
}
