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
        { responsable: { contains: q, mode: "insensitive" } },
        { telephone: { contains: q } },
        { zone: { contains: q, mode: "insensitive" } },
      ];
    }
    const transporteurs = await prisma.transporteur.findMany({ where, orderBy: { creeLe: "desc" }, take: 200 });
    return NextResponse.json({ transporteurs });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_INTERVENANTS);
  if (!acces) return refus();
  try {
    const c = await req.json();
    if (!c.nom?.trim()) return NextResponse.json({ erreur: "nom obligatoire" }, { status: 400 });
    const t = await prisma.transporteur.create({
      data: {
        nom: String(c.nom).trim().slice(0, 100),
        responsable: c.responsable ? String(c.responsable).slice(0, 80) : null,
        telephone: c.telephone ? String(c.telephone).slice(0, 20) : null,
        email: c.email ? String(c.email).slice(0, 120) : null,
        typeTransport: ["simple", "accompagne", "medicalise"].includes(c.typeTransport) ? c.typeTransport : "simple",
        vehicule: c.vehicule ? String(c.vehicule).slice(0, 120) : null,
        zone: c.zone ? String(c.zone).slice(0, 400) : "",
        statut: STATUTS.includes(c.statut) ? c.statut : "EN_ATTENTE",
      },
    });
    await journaliser(acces.nomAffiche, "transporteur.cree", "transporteur", t.id, t.nom);
    return NextResponse.json({ ok: true, transporteur: t }, { status: 201 });
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
    for (const [k, m] of [["nom", 100], ["responsable", 80], ["telephone", 20], ["email", 120], ["vehicule", 120], ["zone", 400], ["photoUrl", 400]]) {
      if (c[k] !== undefined) data[k] = c[k] ? String(c[k]).slice(0, m) : k === "zone" ? "" : null;
    }
    if (c.typeTransport && ["simple", "accompagne", "medicalise"].includes(c.typeTransport)) data.typeTransport = c.typeTransport;
    if (c.statut && STATUTS.includes(c.statut)) data.statut = c.statut;
    const t = await prisma.transporteur.update({ where: { id }, data });
    await journaliser(acces.nomAffiche, "transporteur.maj", "transporteur", id, c.statut ? `statut → ${c.statut}` : "profil modifié");
    return NextResponse.json({ ok: true, transporteur: t });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
