import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus, ROLES_GESTION_INTERVENANTS, ROLES_GESTION_EQUIPE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const CIBLES = ["client", "soignant", "transporteur"];

// GET → demandes de suppression (en attente d'abord).
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const demandes = await prisma.demandeSuppression.findMany({
      orderBy: [{ statut: "asc" }, { creeLe: "desc" }],
      take: 100,
    });
    return NextResponse.json({ demandes });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// POST { cibleType, cibleId, cibleNom?, motif? } → un admin/modérateur
// DEMANDE la suppression ; rien n'est supprimé tant que le super admin
// n'a pas validé.
export async function POST(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_INTERVENANTS);
  if (!acces) return refus();
  try {
    const c = await req.json();
    if (!CIBLES.includes(c.cibleType) || !c.cibleId) {
      return NextResponse.json({ erreur: "cible invalide" }, { status: 400 });
    }
    // Pas de doublon : une seule demande en attente par cible.
    const existante = await prisma.demandeSuppression.findFirst({
      where: { cibleType: c.cibleType, cibleId: String(c.cibleId), statut: "EN_ATTENTE" },
    });
    if (existante) return NextResponse.json({ erreur: "deja_demande" }, { status: 409 });

    const d = await prisma.demandeSuppression.create({
      data: {
        cibleType: c.cibleType,
        cibleId: String(c.cibleId),
        cibleNom: c.cibleNom ? String(c.cibleNom).slice(0, 160) : null,
        motif: c.motif ? String(c.motif).slice(0, 500) : null,
        demandePar: acces.nomAffiche,
      },
    });
    await journaliser(acces.nomAffiche, "suppression.demandee", c.cibleType, c.cibleId, d.cibleNom || "");
    return NextResponse.json({ ok: true, id: d.id }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH { id, action: "valider" | "refuser" } — SUPER ADMIN uniquement.
// « valider » EXÉCUTE la suppression (compte + fiche, historique conservé).
export async function PATCH(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_EQUIPE);
  if (!acces) return refus();
  try {
    const { id, action } = await req.json();
    const d = await prisma.demandeSuppression.findUnique({ where: { id: Number(id) } });
    if (!d || d.statut !== "EN_ATTENTE") return NextResponse.json({ erreur: "introuvable" }, { status: 404 });

    if (action === "refuser") {
      await prisma.demandeSuppression.update({
        where: { id: d.id },
        data: { statut: "REFUSEE", decidePar: acces.nomAffiche, decideLe: new Date() },
      });
      await journaliser(acces.nomAffiche, "suppression.refusee", d.cibleType, d.cibleId, d.cibleNom || "");
      return NextResponse.json({ ok: true });
    }
    if (action !== "valider") return NextResponse.json({ erreur: "action inconnue" }, { status: 400 });

    // Exécution réelle selon la cible (mêmes règles que les suppressions directes).
    if (d.cibleType === "client") {
      await acces.admin.from("profil").delete().eq("id", d.cibleId);
      try { await acces.admin.auth.admin.deleteUser(d.cibleId); } catch {}
    } else if (d.cibleType === "soignant") {
      const sid = Number(d.cibleId);
      await prisma.demande.updateMany({ where: { soignantId: sid }, data: { soignantId: null } });
      await prisma.soignant.delete({ where: { id: sid } }).catch(() => {});
    } else if (d.cibleType === "transporteur") {
      const tid = Number(d.cibleId);
      await prisma.demande.updateMany({ where: { transporteurId: tid }, data: { transporteurId: null } });
      await prisma.transporteur.delete({ where: { id: tid } }).catch(() => {});
    }

    await prisma.demandeSuppression.update({
      where: { id: d.id },
      data: { statut: "VALIDEE", decidePar: acces.nomAffiche, decideLe: new Date() },
    });
    await journaliser(acces.nomAffiche, "suppression.validee", d.cibleType, d.cibleId, `${d.cibleNom || ""} (demandé par ${d.demandePar})`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
