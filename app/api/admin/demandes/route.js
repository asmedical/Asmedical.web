import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const STATUTS = ["A_RAPPELER", "CONFIRMEE", "AFFECTEE", "EN_COURS", "TERMINEE", "ABSENT", "ANNULEE"];

// GET /api/admin/demandes?statut=&service=&jour=&q=&page=
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const p = new URL(req.url).searchParams;
    const where = {};
    if (p.get("statut")) where.statut = p.get("statut");
    if (p.get("service")) where.service = p.get("service");
    if (p.get("jour")) where.date = { startsWith: p.get("jour") };
    const q = (p.get("q") || "").trim();
    if (q) {
      where.OR = [
        { nom: { contains: q, mode: "insensitive" } },
        { telephone: { contains: q } },
        { destination: { contains: q, mode: "insensitive" } },
      ];
    }
    const page = Math.max(1, parseInt(p.get("page") || "1", 10));
    const parPage = 30;
    const [total, demandes] = await Promise.all([
      prisma.demande.count({ where }),
      prisma.demande.findMany({
        where,
        orderBy: [{ prioritaire: "desc" }, { creeLe: "desc" }],
        skip: (page - 1) * parPage,
        take: parPage,
        include: {
          soignant: { select: { prenom: true, nom: true } },
          transporteur: { select: { nom: true } },
          abonnement: true,
        },
      }),
    ]);
    return NextResponse.json({ demandes, total, page, pages: Math.ceil(total / parPage) });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH : statut / affectation / priorité / reprogrammation
export async function PATCH(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const c = await req.json();
    const id = Number(c.id);
    if (!id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });

    const data = {};
    const actions = [];
    if (c.statut && STATUTS.includes(c.statut)) {
      data.statut = c.statut;
      actions.push(`statut → ${c.statut}`);
    }
    if (c.soignantId !== undefined) {
      data.soignantId = c.soignantId ? Number(c.soignantId) : null;
      actions.push(`soignant → ${c.soignantId || "aucun"}`);
      if (data.soignantId && !data.statut) data.statut = "AFFECTEE";
    }
    if (c.transporteurId !== undefined) {
      data.transporteurId = c.transporteurId ? Number(c.transporteurId) : null;
      actions.push(`transporteur → ${c.transporteurId || "aucun"}`);
      if (data.transporteurId && !data.statut) data.statut = "AFFECTEE";
    }
    if (c.chauffeur !== undefined) data.chauffeur = c.chauffeur ? String(c.chauffeur).slice(0, 60) : null;
    if (c.prioritaire !== undefined) {
      data.prioritaire = Boolean(c.prioritaire);
      actions.push(c.prioritaire ? "priorité ↑" : "priorité ↓");
    }
    if (c.date) {
      data.date = String(c.date).slice(0, 16);
      actions.push(`reprogrammée ${data.date}`);
    }

    const maj = await prisma.demande.update({ where: { id }, data });
    await journaliser(acces.nomAffiche, "demande.maj", "demande", id, actions.join(", "));
    return NextResponse.json({ ok: true, demande: maj });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// POST : créer une demande / un rendez-vous pour un client (depuis l'admin)
export async function POST(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const c = await req.json();
    if (!c.service || !c.telephone || !c.date) {
      return NextResponse.json({ erreur: "champs manquants" }, { status: 400 });
    }
    const t = (v, m) => (v ? String(v).slice(0, m) : null);
    const demande = await prisma.demande.create({
      data: {
        service: String(c.service).slice(0, 30),
        typeTrajet: t(c.typeTrajet, 30),
        nom: t(c.nom, 80),
        telephone: String(c.telephone).slice(0, 20),
        depart: t(c.depart, 160),
        destination: t(c.destination, 160),
        date: String(c.date).slice(0, 16),
        notes: t(c.notes, 500),
        statut: c.statut && STATUTS.includes(c.statut) ? c.statut : "CONFIRMEE",
        espace: "admin",
      },
    });
    await journaliser(acces.nomAffiche, "demande.creee", "demande", demande.id, `${demande.service} ${demande.date}`);
    return NextResponse.json({ ok: true, demande }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
