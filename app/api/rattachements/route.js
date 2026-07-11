import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { identite, normTel } from "@/lib/rattachements";

export const dynamic = "force-dynamic";

// Téléphone du patient connecté (compte ou profil).
function telDe(id) {
  return normTel(id.user.phone) || normTel(id.profil?.telephone);
}

// GET → mes rattachements (demandes en attente + autorisations actives).
export async function GET(req) {
  const id = await identite(req);
  if (!id) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
  try {
    const cle = telDe(id);
    if (!cle) return NextResponse.json({ rattachements: [] });
    const tous = await prisma.rattachement.findMany({ orderBy: { creeLe: "desc" }, take: 200 });
    const miens = tous.filter((r) => normTel(r.patientTel) === cle && r.statut !== "CODE_ATTENTE");
    const codes = tous.filter(
      (r) => normTel(r.patientTel) === cle && r.statut === "CODE_ATTENTE" && r.codeExpire > new Date()
    );
    return NextResponse.json({
      rattachements: miens.map((r) => ({
        id: r.id, etabNom: r.etabNom, statut: r.statut, scopes: r.scopes,
        expiration: r.expiration, creeLe: r.creeLe, source: r.source,
      })),
      codeActif: codes[0] ? { code: codes[0].code, expire: codes[0].codeExpire } : null,
    });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// POST { action: "accepter"|"refuser"|"revoquer", id }
//      { action: "code" } → génère un code de rattachement (24 h, usage unique)
export async function POST(req) {
  const id = await identite(req);
  if (!id) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
  try {
    const cle = telDe(id);
    if (!cle) return NextResponse.json({ erreur: "profil sans téléphone" }, { status: 400 });
    const c = await req.json();

    if (c.action === "code") {
      // Invalide les codes précédents puis en génère un nouveau.
      await prisma.rattachement.deleteMany({ where: { statut: "CODE_ATTENTE", patientTel: { contains: cle } } });
      const code = "ASM-" + Math.random().toString(36).slice(2, 6).toUpperCase() + Math.floor(10 + Math.random() * 90);
      const r = await prisma.rattachement.create({
        data: {
          patientTel: id.profil?.telephone || id.user.phone || cle,
          patientNom: [id.profil?.prenom, id.profil?.nom].filter(Boolean).join(" ") || null,
          statut: "CODE_ATTENTE",
          source: "code",
          code,
          codeExpire: new Date(Date.now() + 24 * 3600 * 1000),
        },
      });
      return NextResponse.json({ ok: true, code: r.code, expire: r.codeExpire });
    }

    const r = await prisma.rattachement.findUnique({ where: { id: Number(c.id) } });
    if (!r || normTel(r.patientTel) !== cle) return NextResponse.json({ erreur: "non autorisé" }, { status: 403 });

    if (c.action === "accepter" && r.statut === "EN_ATTENTE") {
      await prisma.rattachement.update({ where: { id: r.id }, data: { statut: "ACCEPTE", decideLe: new Date() } });
    } else if (c.action === "refuser" && r.statut === "EN_ATTENTE") {
      await prisma.rattachement.update({ where: { id: r.id }, data: { statut: "REFUSE", decideLe: new Date() } });
    } else if (c.action === "revoquer" && r.statut === "ACCEPTE") {
      await prisma.rattachement.update({ where: { id: r.id }, data: { statut: "REVOQUE", revoqueLe: new Date() } });
    } else {
      return NextResponse.json({ erreur: "action impossible" }, { status: 400 });
    }
    await prisma.journal.create({
      data: { auteur: "patient", action: `rattachement.${c.action}`, entite: "rattachement", entiteId: String(r.id), detail: r.etabNom || "" },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
