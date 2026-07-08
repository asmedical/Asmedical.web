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
    const VIDE = new Set(["communes", "conges", "joursOff", "specialites"]);
    const data = {};
    const champs = [
      ["prenom", 60], ["nom", 60], ["telephone", 20], ["email", 120], ["communes", 400],
      ["conges", 800], ["joursOff", 20], ["photoUrl", 400], ["adresse", 160], ["commune", 80],
      ["wilaya", 80], ["dateNaissance", 10], ["contactUrgence", 120], ["specialites", 400],
      ["notesPaie", 1000],
    ];
    for (const [k, m] of champs) {
      if (c[k] !== undefined) data[k] = c[k] ? String(c[k]).slice(0, m) : VIDE.has(k) ? "" : null;
    }
    if (c.qualification) data.qualification = c.qualification === "infirmier" ? "infirmier" : "aide_soignant";
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
    const s = await prisma.soignant.update({ where: { id }, data });
    await journaliser(acces.nomAffiche, "soignant.maj", "soignant", id, c.statut ? `statut → ${c.statut}` : "profil modifié");
    return NextResponse.json({ ok: true, soignant: s });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// Suppression définitive — réservée au super admin. Les demandes liées
// sont d'abord détachées pour ne pas casser l'historique des clients.
export async function DELETE(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_EQUIPE);
  if (!acces) return refus();
  try {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });
    const s = await prisma.soignant.findUnique({ where: { id } });
    if (!s) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
    await prisma.demande.updateMany({ where: { soignantId: id }, data: { soignantId: null } });
    await prisma.soignant.delete({ where: { id } });
    await journaliser(acces.nomAffiche, "soignant.supprime", "soignant", id, `${s.prenom} ${s.nom}`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
