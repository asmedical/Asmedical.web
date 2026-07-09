import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const STATUTS = ["ACTIF", "SUSPENDU", "TERMINE"];

// GET /api/admin/abonnements?statut= → liste (avec nb de RDV générés).
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const p = new URL(req.url).searchParams;
    const where = {};
    if (p.get("statut")) where.statut = p.get("statut");
    const q = (p.get("q") || "").trim();
    if (q) where.OR = [{ nom: { contains: q, mode: "insensitive" } }, { telephone: { contains: q } }, { centre: { contains: q, mode: "insensitive" } }];
    const abonnements = await prisma.abonnement.findMany({
      where,
      orderBy: { creeLe: "desc" },
      take: 200,
      include: { _count: { select: { demandes: true } } },
    });
    return NextResponse.json({ abonnements });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH → statut et/ou champs de l'abonnement.
export async function PATCH(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const c = await req.json();
    const id = Number(c.id);
    if (!id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });
    const data = {};
    for (const [k, m] of [["nom", 80], ["telephone", 20], ["centre", 160], ["domicile", 160], ["debut", 10], ["fin", 10]]) {
      if (c[k] !== undefined) data[k] = c[k] ? String(c[k]).slice(0, m) : (k === "nom" ? null : "");
    }
    if (c.heure !== undefined && /^([01]?\d|2[0-3]):[0-5]\d$/.test(c.heure)) data.heure = c.heure;
    if (c.jours !== undefined) {
      const j = String(c.jours).split(",").map(Number).filter((x) => x >= 0 && x <= 6);
      data.jours = [...new Set(j)].sort().join(",");
    }
    if (c.retour !== undefined) data.retour = Boolean(c.retour);
    if (STATUTS.includes(c.statut)) data.statut = c.statut;
    const abo = await prisma.abonnement.update({ where: { id }, data });
    await journaliser(acces.nomAffiche, "abonnement.maj", "abonnement", id, c.statut ? `statut → ${c.statut}` : "modifié");
    return NextResponse.json({ ok: true, abonnement: abo });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// POST → génère les rendez-vous récurrents sur un horizon (jours), sans
// jamais recréer une date déjà présente pour cet abonnement.
export async function POST(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const c = await req.json();
    const id = Number(c.id);
    if (!id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });
    const abo = await prisma.abonnement.findUnique({ where: { id } });
    if (!abo) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
    if (abo.statut !== "ACTIF") return NextResponse.json({ erreur: "L'abonnement n'est pas actif." }, { status: 400 });

    const joursSet = new Set(String(abo.jours).split(",").filter((x) => x !== "").map(Number));
    if (joursSet.size === 0) return NextResponse.json({ erreur: "Aucun jour défini." }, { status: 400 });
    const horizon = Math.min(Math.max(parseInt(c.horizon, 10) || 14, 1), 60);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const debut = abo.debut ? new Date(abo.debut + "T00:00:00Z") : today;
    const fin = abo.fin ? new Date(abo.fin + "T23:59:59Z") : null;
    const start = today > debut ? today : debut;

    const existantes = await prisma.demande.findMany({ where: { abonnementId: id }, select: { date: true } });
    const dejaLa = new Set(existantes.map((d) => (d.date || "").slice(0, 10)));

    const aCreer = [];
    for (let i = 0; i < horizon; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      if (fin && d > fin) break;
      const ourDay = (d.getUTCDay() + 6) % 7; // 0 = lundi
      if (!joursSet.has(ourDay)) continue;
      const iso = d.toISOString().slice(0, 10);
      if (dejaLa.has(iso)) continue;
      aCreer.push({
        service: "transport",
        nom: abo.nom,
        telephone: abo.telephone,
        depart: abo.domicile || null,
        destination: abo.centre,
        date: `${iso}T${abo.heure}`,
        recurrence: "Abonnement",
        statut: "CONFIRMEE",
        sousMode: "abonnement",
        abonnementId: id,
        espace: "admin",
      });
    }
    if (aCreer.length) await prisma.demande.createMany({ data: aCreer });
    await journaliser(acces.nomAffiche, "abonnement.generation", "abonnement", id, `${aCreer.length} RDV générés (${horizon} j)`);
    return NextResponse.json({ ok: true, crees: aCreer.length });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
