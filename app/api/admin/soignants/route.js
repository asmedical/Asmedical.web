import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus, ROLES_GESTION_INTERVENANTS } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const STATUTS = ["EN_ATTENTE", "VALIDE", "SUSPENDU", "INACTIF", "REFUSE"];

export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const p = new URL(req.url).searchParams;
    const where = {};
    if (p.get("statut")) where.statut = p.get("statut");
    const q = (p.get("q") || "").trim();
    if (q) {
      where.OR = [
        { nom: { contains: q, mode: "insensitive" } },
        { prenom: { contains: q, mode: "insensitive" } },
        { telephone: { contains: q } },
        { communes: { contains: q, mode: "insensitive" } },
      ];
    }
    const soignants = await prisma.soignant.findMany({ where, orderBy: { creeLe: "desc" }, take: 200 });
    return NextResponse.json({ soignants });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_INTERVENANTS);
  if (!acces) return refus();
  try {
    const c = await req.json();
    if (!c.prenom?.trim() || !c.nom?.trim()) {
      return NextResponse.json({ erreur: "prénom et nom obligatoires" }, { status: 400 });
    }
    const s = await prisma.soignant.create({
      data: {
        prenom: String(c.prenom).trim().slice(0, 60),
        nom: String(c.nom).trim().slice(0, 60),
        telephone: c.telephone ? String(c.telephone).slice(0, 20) : null,
        email: c.email ? String(c.email).slice(0, 120) : null,
        qualification: c.qualification === "infirmier" ? "infirmier" : "aide_soignant",
        communes: c.communes ? String(c.communes).slice(0, 400) : "",
        statut: STATUTS.includes(c.statut) ? c.statut : "EN_ATTENTE",
      },
    });
    await journaliser(acces.nomAffiche, "soignant.cree", "soignant", s.id, `${s.prenom} ${s.nom}`);
    return NextResponse.json({ ok: true, soignant: s }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_INTERVENANTS);
  if (!acces) return refus();
  try {
    const c = await req.json();
    const id = Number(c.id);
    if (!id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });
    const data = {};
    for (const [k, m] of [["prenom", 60], ["nom", 60], ["telephone", 20], ["email", 120], ["communes", 400], ["conges", 800], ["joursOff", 20], ["photoUrl", 400]]) {
      if (c[k] !== undefined) data[k] = c[k] ? String(c[k]).slice(0, m) : k === "communes" || k === "conges" || k === "joursOff" ? "" : null;
    }
    if (c.qualification) data.qualification = c.qualification === "infirmier" ? "infirmier" : "aide_soignant";
    for (const k of ["heureDebut", "heureFin"]) {
      const v = parseInt(c[k], 10);
      if (Number.isFinite(v) && v >= 0 && v <= 24) data[k] = v;
    }
    if (c.statut && STATUTS.includes(c.statut)) data.statut = c.statut;
    const s = await prisma.soignant.update({ where: { id }, data });
    await journaliser(acces.nomAffiche, "soignant.maj", "soignant", id, c.statut ? `statut → ${c.statut}` : "profil modifié");
    return NextResponse.json({ ok: true, soignant: s });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
