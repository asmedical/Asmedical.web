import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus, ROLES_GESTION_INTERVENANTS } from "@/lib/adminAuth";
import { notifierPatientTel } from "@/lib/rattachements";

export const dynamic = "force-dynamic";

const norm = (t) => String(t || "").replace(/\D/g, "").slice(-8);

// GET ?tel= → procurations liées à ce patient (téléphone, 8 derniers chiffres).
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const tel = norm(new URL(req.url).searchParams.get("tel"));
    if (!tel) return NextResponse.json({ rattachements: [] });
    const tous = await prisma.rattachement.findMany({
      where: { statut: { not: "CODE_ATTENTE" } },
      orderBy: { creeLe: "desc" },
      take: 300,
    });
    const liens = tous.filter((r) => norm(r.patientTel) === tel);
    return NextResponse.json({ rattachements: liens });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH { id, action: "valider" | "revoquer" } — validation par le staff
// (méthode 3 : demande vérifiée avec le patient/justificatif) ou révocation.
export async function PATCH(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_INTERVENANTS);
  if (!acces) return refus();
  try {
    const { id, action } = await req.json();
    const r = await prisma.rattachement.findUnique({ where: { id: Number(id) } });
    if (!r) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });

    if (action === "valider" && r.statut === "EN_ATTENTE") {
      await prisma.rattachement.update({
        where: { id: r.id },
        data: { statut: "ACCEPTE", decideLe: new Date(), source: "staff" },
      });
      await notifierPatientTel(acces.admin, r.patientTel, {
        titre: "Rattachement validé par ASM",
        corps: `${r.etabNom || "Un établissement"} peut désormais réserver pour vous. Vous pouvez révoquer cette autorisation à tout moment.`,
      });
    } else if (action === "revoquer" && r.statut === "ACCEPTE") {
      await prisma.rattachement.update({
        where: { id: r.id },
        data: { statut: "REVOQUE", revoqueLe: new Date() },
      });
      await notifierPatientTel(acces.admin, r.patientTel, {
        titre: "Autorisation révoquée",
        corps: `L'autorisation de ${r.etabNom || "l'établissement"} a été révoquée par l'équipe ASM.`,
      });
    } else {
      return NextResponse.json({ erreur: "action impossible" }, { status: 400 });
    }
    await journaliser(acces.nomAffiche, `rattachement.${action}`, "rattachement", r.id, r.etabNom || r.patientTel);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
