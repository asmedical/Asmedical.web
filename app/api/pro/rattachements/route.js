import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { identite, normTel, notifierPatientTel } from "@/lib/rattachements";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Réservé aux comptes établissement (role pro).
async function etab(req) {
  const id = await identite(req);
  if (!id || id.profil?.role !== "pro") return null;
  return id;
}
function nomEtab(id) {
  return id.profil?.etablissement || [id.profil?.prenom, id.profil?.nom].filter(Boolean).join(" ") || "Établissement";
}

// GET → mes patients rattachés (+ demandes en attente).
export async function GET(req) {
  const id = await etab(req);
  if (!id) return NextResponse.json({ erreur: "réservé aux établissements" }, { status: 403 });
  try {
    const liens = await prisma.rattachement.findMany({
      where: { etabUserId: id.user.id, statut: { in: ["EN_ATTENTE", "ACCEPTE", "REFUSE", "REVOQUE"] } },
      orderBy: { creeLe: "desc" },
      take: 200,
    });
    return NextResponse.json({
      rattachements: liens.map((r) => ({
        id: r.id, patientNom: r.patientNom, patientTel: r.patientTel,
        statut: r.statut, scopes: r.scopes, expiration: r.expiration, creeLe: r.creeLe,
      })),
    });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// POST { mode: "invitation", nom, telephone, scopes?, expiration? }
//      { mode: "code", code }
export async function POST(req) {
  const id = await etab(req);
  if (!id) return NextResponse.json({ erreur: "réservé aux établissements" }, { status: 403 });
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`rattache:${ip}`, 10, 60000)) return NextResponse.json({ erreur: "Trop de tentatives." }, { status: 429 });

    const c = await req.json();

    if (c.mode === "code") {
      const code = String(c.code || "").trim().toUpperCase();
      const r = await prisma.rattachement.findUnique({ where: { code } });
      if (!r || r.statut !== "CODE_ATTENTE") return NextResponse.json({ erreur: "code_invalide" }, { status: 404 });
      if (r.codeExpire && r.codeExpire < new Date()) return NextResponse.json({ erreur: "code_expire" }, { status: 410 });
      const maj = await prisma.rattachement.update({
        where: { id: r.id },
        data: {
          etabUserId: id.user.id, etabNom: nomEtab(id),
          statut: "ACCEPTE", decideLe: new Date(), code: null, codeExpire: null,
        },
      });
      await prisma.journal.create({ data: { auteur: nomEtab(id), action: "rattachement.code", entite: "rattachement", entiteId: String(maj.id), detail: maj.patientNom || maj.patientTel } });
      await notifierPatientTel(id.admin, maj.patientTel, {
        titre: "Rattachement confirmé",
        corps: `${nomEtab(id)} peut désormais réserver pour vous. Gérez cette autorisation dans « Établissements autorisés ».`,
      });
      return NextResponse.json({ ok: true, rattachement: { id: maj.id, statut: maj.statut } });
    }

    // Invitation : le patient devra accepter depuis son espace.
    const telephone = String(c.telephone || "").trim().slice(0, 20);
    if (normTel(telephone).length < 8) return NextResponse.json({ erreur: "téléphone invalide" }, { status: 400 });
    const scopes = String(c.scopes || "transport,domicile,medicaments")
      .split(",").map((s) => s.trim()).filter((s) => ["transport", "domicile", "medicaments"].includes(s)).join(",");
    const r = await prisma.rattachement.create({
      data: {
        patientTel: telephone,
        patientNom: String(c.nom || "").slice(0, 120) || null,
        etabUserId: id.user.id,
        etabNom: nomEtab(id),
        statut: "EN_ATTENTE",
        source: "invitation",
        scopes: scopes || "transport,domicile,medicaments",
        expiration: c.expiration ? String(c.expiration).slice(0, 10) : null,
      },
    });
    await prisma.journal.create({ data: { auteur: nomEtab(id), action: "rattachement.invitation", entite: "rattachement", entiteId: String(r.id), detail: r.patientNom || r.patientTel } });
    await notifierPatientTel(id.admin, telephone, {
      titre: "Demande de rattachement",
      corps: `${nomEtab(id)} demande l'autorisation de réserver des prestations ASM pour vous. Acceptez ou refusez dans « Établissements autorisés ».`,
    });
    return NextResponse.json({ ok: true, rattachement: { id: r.id, statut: r.statut } }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
