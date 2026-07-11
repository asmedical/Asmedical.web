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

// POST { patientTel, patientNom?, etabUserId, scopes?, expiration? }
// Rattachement créé DIRECTEMENT par le staff (vérifié avec le patient) :
// ACCEPTE immédiatement, source « staff », patient notifié.
export async function POST(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_INTERVENANTS);
  if (!acces) return refus();
  try {
    const c = await req.json();
    const patientTel = String(c.patientTel || "").trim().slice(0, 20);
    if (norm(patientTel).length < 8) return NextResponse.json({ erreur: "téléphone patient invalide" }, { status: 400 });
    if (!c.etabUserId) return NextResponse.json({ erreur: "établissement manquant" }, { status: 400 });

    const { data: etab } = await acces.admin
      .from("profil")
      .select("id, role, etablissement, prenom, nom")
      .eq("id", c.etabUserId)
      .maybeSingle();
    if (!etab || etab.role !== "pro") return NextResponse.json({ erreur: "établissement introuvable" }, { status: 404 });
    const etabNom = etab.etablissement || [etab.prenom, etab.nom].filter(Boolean).join(" ") || "Établissement";

    const scopes = String(c.scopes || "transport,domicile,medicaments")
      .split(",").map((s) => s.trim()).filter((s) => ["transport", "domicile", "medicaments"].includes(s)).join(",")
      || "transport,domicile,medicaments";

    const r = await prisma.rattachement.create({
      data: {
        patientTel,
        patientNom: c.patientNom ? String(c.patientNom).slice(0, 120) : null,
        etabUserId: etab.id,
        etabNom,
        statut: "ACCEPTE",
        source: "staff",
        scopes,
        expiration: c.expiration ? String(c.expiration).slice(0, 10) : null,
        decideLe: new Date(),
      },
    });
    await journaliser(acces.nomAffiche, "rattachement.staff", "rattachement", r.id, `${etabNom} ↔ ${r.patientNom || patientTel}`);
    await notifierPatientTel(acces.admin, patientTel, {
      titre: "Établissement autorisé",
      corps: `L'équipe ASM a autorisé ${etabNom} à réserver pour vous. Vous pouvez révoquer cette autorisation à tout moment dans « Établissements autorisés ».`,
    });
    return NextResponse.json({ ok: true, rattachement: r }, { status: 201 });
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
