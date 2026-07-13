import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { prochainNumero, creerTicketEspeces } from "@/lib/finances";
import { creerPaiementEnLigne, moyensDisponibles, infosVirement } from "@/lib/paiements";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

async function identifier(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user } } = await admin.auth.getUser(token);
  return user || null;
}

// POST /api/finances/payer { factureId, moyen }
//  - especes  → crée un TICKET sécurisé à présenter à un point de paiement
//  - cib / edahabia → crée un paiement chez le fournisseur, renvoie l'URL
//    (la confirmation ne viendra QUE du webhook signé — jamais du navigateur)
//  - virement → crée un paiement en attente avec référence obligatoire
// Anti double débit : un seul paiement EN_ATTENTE par facture et par moyen.
export async function POST(req) {
  try {
    const user = await identifier(req);
    if (!user) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`payer:${user.id}:${ip}`, 10, 60000)) {
      return NextResponse.json({ erreur: "Trop de tentatives." }, { status: 429 });
    }

    const { factureId, moyen } = await req.json();
    const autorises = moyensDisponibles().map((m) => m.id);
    if (!autorises.includes(moyen)) return NextResponse.json({ erreur: "moyen indisponible" }, { status: 400 });

    const compte = await prisma.compteFinancier.findUnique({ where: { userId: user.id } });
    const facture = await prisma.facture.findUnique({ where: { id: Number(factureId) } });
    if (!compte || !facture || facture.compteId !== compte.id) {
      return NextResponse.json({ erreur: "facture introuvable" }, { status: 404 });
    }
    if (!["EMISE", "PARTIELLEMENT_PAYEE", "EN_RETARD"].includes(facture.statut)) {
      return NextResponse.json({ erreur: "facture non payable" }, { status: 400 });
    }
    const du = facture.total - facture.paye;
    if (du <= 0) return NextResponse.json({ erreur: "rien à payer" }, { status: 400 });

    // ---- Espèces : ticket sécurisé ----
    if (moyen === "especes") {
      const existant = await prisma.ticketEspeces.findFirst({
        where: { factureId: facture.id, statut: "EN_ATTENTE", expireLe: { gt: new Date() } },
      });
      const ticket = existant || (await creerTicketEspeces({ facture, compteId: compte.id }));
      return NextResponse.json({ type: "ticket", ticket });
    }

    // Clé d'idempotence : jamais deux paiements en attente identiques.
    const idem = `${facture.id}:${moyen}:${du}`;
    const enCours = await prisma.paiement.findUnique({ where: { idem } });

    // ---- Virement : référence obligatoire, validation manuelle ----
    if (moyen === "virement") {
      const infos = infosVirement();
      if (!infos) return NextResponse.json({ erreur: "moyen indisponible" }, { status: 400 });
      let paiement = enCours && enCours.statut === "EN_ATTENTE" ? enCours : null;
      if (!paiement) {
        paiement = await prisma.$transaction(async (tx) => {
          const reference = await prochainNumero(tx, "paiement", "ASM-P-");
          return tx.paiement.create({
            data: { reference, compteId: compte.id, factureId: facture.id, moyen, fournisseur: "interne", montant: du, idem },
          });
        });
      }
      return NextResponse.json({ type: "virement", paiement, infos });
    }

    // ---- CIB / EDAHABIA via fournisseur configuré ----
    if (enCours && enCours.statut === "EN_ATTENTE" && enCours.refFournisseur?.startsWith("http")) {
      return NextResponse.json({ type: "en_ligne", url: enCours.refFournisseur.split("|")[1] || null, paiement: enCours });
    }
    const resultat = await prisma.$transaction(async (tx) => {
      const reference = await prochainNumero(tx, "paiement", "ASM-P-");
      return tx.paiement.create({
        data: { reference, compteId: compte.id, factureId: facture.id, moyen, fournisseur: "chargily", montant: du, idem: enCours ? null : idem },
      });
    });
    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://asm-sante.com";
    const enLigne = await creerPaiementEnLigne({
      moyen, montant: du, devise: facture.devise,
      description: `Facture ${facture.numero} — ASM`,
      referenceInterne: resultat.reference,
      urlRetour: `${base}/compte/paiements?retour=${resultat.reference}`,
    });
    await prisma.paiement.update({
      where: { id: resultat.id },
      data: { refFournisseur: enLigne.idFournisseur },
    });
    return NextResponse.json({ type: "en_ligne", url: enLigne.url, paiement: resultat });
  } catch (e) {
    return NextResponse.json({ erreur: String(e?.message || "Erreur serveur").slice(0, 200) }, { status: 500 });
  }
}
