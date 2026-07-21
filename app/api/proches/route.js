import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { identite, notifierPatientTel } from "@/lib/rattachements";
import { mesProches, reclamerCodeProche, inviterProche } from "@/lib/proches";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Cercle familial : liens que JE détiens vers des patients (mes proches).
// La symétrie (qui a accès à MON compte) reste sur /api/rattachements,
// gérée par le patient dans « Autorisations ».

function nomDe(id) {
  return [id.profil?.prenom, id.profil?.nom].filter(Boolean).join(" ") || "Proche";
}

// GET → mes proches + leurs dernières demandes (tableau de bord Famille).
export async function GET(req) {
  const id = await identite(req);
  if (!id) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
  try {
    const proches = await mesProches(id.user.id);
    return NextResponse.json({ proches });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// POST { mode:"code", code } — réclamer le code généré par le patient
//      { mode:"invitation", nom, telephone, scopes? } — demande à accepter
//      { action:"retirer", id } — je retire mon propre accès
export async function POST(req) {
  const id = await identite(req);
  if (!id) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`proches:${ip}`, 10, 60000)) {
      return NextResponse.json({ erreur: "Trop de tentatives." }, { status: 429 });
    }
    const c = await req.json();

    if (c.mode === "code") {
      const r = await reclamerCodeProche(c.code, { userId: id.user.id, nom: nomDe(id) });
      if (r.erreur) return NextResponse.json({ erreur: r.erreur }, { status: 400 });
      await prisma.journal.create({
        data: { auteur: nomDe(id), action: "proche.code", entite: "rattachement", entiteId: String(r.rattachement.id), detail: r.rattachement.patientNom || r.rattachement.patientTel },
      });
      await notifierPatientTel(id.admin, r.rattachement.patientTel, {
        titre: "Nouveau proche autorisé",
        corps: `${nomDe(id)} peut désormais réserver pour vous et suivre vos prestations. Gérez cette autorisation dans « Autorisations ».`,
      });
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (c.mode === "invitation") {
      const r = await inviterProche({
        userId: id.user.id, nom: nomDe(id),
        patientNom: c.nom, patientTel: c.telephone, scopes: c.scopes,
      });
      if (r.erreur) return NextResponse.json({ erreur: r.erreur }, { status: 400 });
      await prisma.journal.create({
        data: { auteur: nomDe(id), action: "proche.invitation", entite: "rattachement", entiteId: String(r.rattachement.id), detail: r.rattachement.patientTel },
      });
      await notifierPatientTel(id.admin, r.rattachement.patientTel, {
        titre: "Demande d'accès d'un proche",
        corps: `${nomDe(id)} demande à pouvoir réserver pour vous. Acceptez ou refusez dans « Autorisations ».`,
      });
      return NextResponse.json({ ok: true, enAttente: true }, { status: 201 });
    }

    if (c.action === "retirer") {
      const r = await prisma.rattachement.findUnique({ where: { id: Number(c.id) } });
      if (!r || r.etabUserId !== id.user.id) return NextResponse.json({ erreur: "non autorisé" }, { status: 403 });
      if (!["ACCEPTE", "EN_ATTENTE"].includes(r.statut)) return NextResponse.json({ erreur: "action impossible" }, { status: 400 });
      await prisma.rattachement.update({ where: { id: r.id }, data: { statut: "REVOQUE", revoqueLe: new Date() } });
      await prisma.journal.create({
        data: { auteur: nomDe(id), action: "proche.retrait", entite: "rattachement", entiteId: String(r.id), detail: r.patientNom || r.patientTel },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ erreur: "action inconnue" }, { status: 400 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
