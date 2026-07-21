import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus, ROLES_GESTION_INTERVENANTS, ROLES_GESTION_EQUIPE } from "@/lib/adminAuth";

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
    const notes = await prisma.avis.groupBy({
      by: ["transporteurId"],
      where: { transporteurId: { in: transporteurs.map((t) => t.id) } },
      _avg: { note: true },
      _count: true,
    });
    const parId = Object.fromEntries(notes.map((n) => [n.transporteurId, n]));
    for (const t of transporteurs) {
      const n = parId[t.id];
      t.noteMoyenne = n ? Math.round(n._avg.note * 10) / 10 : null;
      t.nbAvis = n ? n._count : 0;
    }
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
        vehiculeCouleur: c.vehiculeCouleur ? String(c.vehiculeCouleur).slice(0, 40) : null,
        vehiculeImmat: c.vehiculeImmat ? String(c.vehiculeImmat).slice(0, 20) : null,
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
    const VIDE = new Set(["zone", "conges", "joursOff", "specialites"]);
    const data = {};
    const champs = [
      ["nom", 100], ["responsable", 80], ["telephone", 20], ["email", 120], ["vehicule", 120],
      ["vehiculeCouleur", 40], ["vehiculeImmat", 20],
      ["zone", 400], ["photoUrl", 400], ["conges", 800], ["joursOff", 20], ["adresse", 160],
      ["commune", 80], ["wilaya", 80], ["dateNaissance", 10], ["contactUrgence", 120],
      ["specialites", 400], ["notesPaie", 1000],
    ];
    for (const [k, m] of champs) {
      if (c[k] !== undefined) data[k] = c[k] ? String(c[k]).slice(0, m) : VIDE.has(k) ? "" : null;
    }
    if (c.typeTransport && ["simple", "accompagne", "medicalise"].includes(c.typeTransport)) data.typeTransport = c.typeTransport;
    for (const k of ["heureDebut", "heureFin"]) {
      const v = parseInt(c[k], 10);
      if (Number.isFinite(v) && v >= 0 && v <= 24) data[k] = v;
    }
    if (["DISPONIBLE", "OCCUPE", "ABSENT"].includes(c.dispo)) data.dispo = c.dispo;
    if (c.accepteUrgences !== undefined) data.accepteUrgences = Boolean(c.accepteUrgences);
    if (c.typeRemuneration !== undefined)
      data.typeRemuneration = ["fixe", "horaire", "mission", "forfait"].includes(c.typeRemuneration) ? c.typeRemuneration : null;
    for (const k of ["tauxHoraire", "tarifMission", "primes", "retenues"]) {
      if (c[k] !== undefined) {
        const v = parseFloat(c[k]);
        data[k] = Number.isFinite(v) && v >= 0 ? v : null;
      }
    }
    if (c.statut && STATUTS.includes(c.statut)) data.statut = c.statut;
    const t = await prisma.transporteur.update({ where: { id }, data });
    await journaliser(acces.nomAffiche, "transporteur.maj", "transporteur", id, c.statut ? `statut → ${c.statut}` : "profil modifié");
    return NextResponse.json({ ok: true, transporteur: t });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// Suppression définitive — réservée au super admin. Les demandes liées
// sont d'abord détachées pour préserver l'historique des clients.
export async function DELETE(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_EQUIPE);
  if (!acces) return refus();
  try {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });
    const t = await prisma.transporteur.findUnique({ where: { id } });
    if (!t) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
    await prisma.demande.updateMany({ where: { transporteurId: id }, data: { transporteurId: null } });
    await prisma.transporteur.delete({ where: { id } });
    await journaliser(acces.nomAffiche, "transporteur.supprime", "transporteur", id, t.nom);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
