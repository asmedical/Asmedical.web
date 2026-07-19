import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus, ROLES_GESTION_INTERVENANTS } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Résout la liste des comptes destinataires (userId) selon la cible.
async function destinataires({ cible, userId, groupe }) {
  if (cible === "employe") return userId ? [String(userId)] : [];

  const soignantAvecCompte = (where) =>
    prisma.soignant.findMany({ where: { ...where, userId: { not: null } }, select: { userId: true } });
  const transporteurAvecCompte = () =>
    prisma.transporteur.findMany({ where: { userId: { not: null } }, select: { userId: true } });

  let lignes = [];
  if (groupe === "aides_soignants") lignes = await soignantAvecCompte({ qualification: "aide_soignant" });
  else if (groupe === "infirmiers") lignes = await soignantAvecCompte({ qualification: "infirmier" });
  else if (groupe === "soignants") lignes = await soignantAvecCompte({});
  else if (groupe === "chauffeurs") lignes = await transporteurAvecCompte();
  else if (groupe === "employes") {
    const [s, t] = await Promise.all([soignantAvecCompte({}), transporteurAvecCompte()]);
    lignes = [...s, ...t];
  }
  return [...new Set(lignes.map((l) => l.userId).filter(Boolean))];
}

// POST /api/admin/diffusion — envoie un message et/ou une notification à un
// employé précis ou à un groupe (auxiliaires de santé, chauffeurs, tous…).
// { cible: "employe"|"groupe", userId?, groupe?, canal: "message"|"notification"|"les_deux", titre?, texte }
export async function POST(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_INTERVENANTS);
  if (!acces) return refus();
  try {
    const c = await req.json();
    const texte = String(c.texte || "").trim().slice(0, 1000);
    const titre = String(c.titre || "").trim().slice(0, 120) || "Message ASM";
    const canal = ["message", "notification", "les_deux"].includes(c.canal) ? c.canal : "les_deux";
    if (!texte) return NextResponse.json({ erreur: "Message vide." }, { status: 400 });

    const ids = await destinataires(c);
    if (ids.length === 0) return NextResponse.json({ erreur: "Aucun destinataire (aucun compte lié)." }, { status: 400 });

    const now = new Date();
    if (canal === "message" || canal === "les_deux") {
      await prisma.message.createMany({
        data: ids.map((userId) => ({ userId, deEquipe: true, auteur: acces.nomAffiche, texte, creeLe: now })),
      });
    }
    if (canal === "notification" || canal === "les_deux") {
      await prisma.notification.createMany({
        data: ids.map((userId) => ({ userId, type: "message", titre, corps: texte, auteur: acces.nomAffiche, statut: "NON_LU", creeLe: now })),
      });
    }

    // Push sur les appareils des destinataires (best-effort).
    try {
      const { envoyerPush } = await import("@/lib/pushEnvoi");
      await Promise.allSettled(ids.map((userId) => envoyerPush(userId, { titre, corps: texte, url: "/employe/messagerie" })));
    } catch {}

    const cibleLib = c.cible === "employe" ? "1 employé" : `groupe « ${c.groupe} » (${ids.length})`;
    await journaliser(acces.nomAffiche, "diffusion", "message", c.userId || c.groupe || "", `${cibleLib} · ${canal}`);
    return NextResponse.json({ ok: true, envoyes: ids.length });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
