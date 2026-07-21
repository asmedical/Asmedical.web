import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus } from "@/lib/adminAuth";
import { notifierPatient } from "@/lib/notifier";
import { conflitAffectation } from "@/lib/disponibilites";

export const dynamic = "force-dynamic";

const STATUTS = ["A_RAPPELER", "CONFIRMEE", "AFFECTEE", "EN_COURS", "TERMINEE", "ABSENT", "ANNULEE"];
const LIB_SERVICE = { transport: "Transport", domicile: "Aide à domicile", medicaments: "Livraison de médicaments" };

// Résumé lisible d'une intervention, pour le corps de la notification.
function detailIntervention(d) {
  const quand = d.date ? d.date.replace("T", " à ") : "à planifier";
  const lieu = d.destination || d.depart || "";
  const patient = d.nom ? ` · patient : ${d.nom}` : "";
  const fen = d.fenetre ? ` · ${d.fenetre}` : "";
  return `${quand} · ${LIB_SERVICE[d.service] || d.service}${lieu ? ` · ${lieu}` : ""}${fen}${patient}`;
}

// Crée une notification dans l'espace de l'intervenant, s'il possède un
// compte de connexion (userId rattaché à sa fiche). La notification pointe
// vers la fiche mission (lienType/lienId) pour un clic actionnable.
async function notifierIntervenant(entite, intervenantId, titre, corps, auteur, demandeId) {
  const modele = entite === "soignant" ? prisma.soignant : prisma.transporteur;
  const iv = await modele.findUnique({ where: { id: Number(intervenantId) }, select: { userId: true } });
  if (!iv?.userId) return;
  await prisma.notification.create({
    data: {
      userId: iv.userId, type: "rdv", titre, corps,
      auteur: auteur || "Coordination ASM", statut: "NON_LU",
      lienType: "intervention", lienId: String(demandeId),
    },
  });
  const { envoyerPush } = await import("@/lib/pushEnvoi");
  await envoyerPush(iv.userId, { titre, corps, url: `/employe/interventions/${demandeId}` });
}

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
    if (p.get("soignantId")) where.soignantId = Number(p.get("soignantId"));
    if (p.get("transporteurId")) where.transporteurId = Number(p.get("transporteurId"));

    // Filtres de supervision terrain.
    const sup = p.get("supervision");
    if (sup === "probleme") {
      where.problemeLe = { not: null };
    } else if (sup === "non_confirmee") {
      // Affectée à un intervenant mais pas encore confirmée par lui.
      where.AND = [
        { OR: [{ soignantId: { not: null } }, { transporteurId: { not: null } }] },
        { accepteeLe: null },
        { statut: { in: ["AFFECTEE", "CONFIRMEE"] } },
      ];
    } else if (sup === "en_retard") {
      // Heure prévue passée mais intervention pas clôturée.
      const maintenant = new Date().toISOString().slice(0, 16);
      where.date = { lt: maintenant };
      where.statut = { notIn: ["TERMINEE", "ANNULEE", "ABSENT"] };
    }

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
    // Liens signés (1 h) des documents et de la signature d'une demande.
    const docsPour = Number(p.get("documents"));
    if (docsPour) {
      const d = await prisma.demande.findUnique({
        where: { id: docsPour },
        include: { documents: { orderBy: { creeLe: "asc" } } },
      });
      if (!d) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
      const chemins = [...d.documents.map((x) => x.chemin), ...(d.signaturePath ? [d.signaturePath] : [])];
      let urls = [];
      if (chemins.length) {
        const { data } = await acces.admin.storage.from("documents").createSignedUrls(chemins, 3600);
        urls = data || [];
      }
      return NextResponse.json({
        documents: d.documents.map((x, i) => ({ id: x.id, nom: x.nom, categorie: x.categorie, url: urls[i]?.signedUrl || null })),
        signatureUrl: d.signaturePath ? urls[urls.length - 1]?.signedUrl || null : null,
      });
    }

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
          avis: { select: { note: true, commentaire: true } },
          documents: { select: { id: true, nom: true, categorie: true } },
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

    // État précédent (notifications + contrôle de conflit d'affectation).
    const avant = await prisma.demande.findUnique({ where: { id } });
    if (!avant) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });

    // Anti double-réservation d'un intervenant : on refuse une affectation
    // qui chevauche son planning (congé, repos, horaires, autre mission).
    const cible = { ...avant, date: data.date || avant.date, id };
    if (data.soignantId && data.soignantId !== avant.soignantId) {
      const raison = await conflitAffectation("soignant", data.soignantId, cible);
      if (raison) return NextResponse.json({ erreur: "conflit", raison }, { status: 409 });
    }
    if (data.transporteurId && data.transporteurId !== avant.transporteurId) {
      const raison = await conflitAffectation("transporteur", data.transporteurId, cible);
      if (raison) return NextResponse.json({ erreur: "conflit", raison }, { status: 409 });
    }

    const maj = await prisma.demande.update({ where: { id }, data });
    await journaliser(acces.nomAffiche, "demande.maj", "demande", id, actions.join(", "));

    // Facturation automatique quand la prestation vient d'être clôturée.
    if (data.statut === "TERMINEE" && avant.statut !== "TERMINEE") {
      try {
        const { facturerDemande } = await import("@/lib/finances");
        await facturerDemande(maj, { auteur: acces.nomAffiche });
      } catch {}
      // Compte-rendu partagé aux proches et établissements autorisés.
      try {
        const { notifierProchesFin } = await import("@/lib/proches");
        await notifierProchesFin(maj);
      } catch {}
    }

    // Notifications automatiques dans l'espace de l'intervenant.
    try {
      if (data.soignantId && data.soignantId !== avant?.soignantId) {
        await notifierIntervenant("soignant", data.soignantId, "Nouvelle intervention", detailIntervention(maj), acces.nomAffiche, maj.id);
      }
      if (data.transporteurId && data.transporteurId !== avant?.transporteurId) {
        await notifierIntervenant("transporteur", data.transporteurId, "Nouvelle course / tournée", detailIntervention(maj), acces.nomAffiche, maj.id);
      }
      if (data.statut === "ANNULEE") {
        if (maj.soignantId) await notifierIntervenant("soignant", maj.soignantId, "Intervention annulée", detailIntervention(maj), acces.nomAffiche, maj.id);
        if (maj.transporteurId) await notifierIntervenant("transporteur", maj.transporteurId, "Course annulée", detailIntervention(maj), acces.nomAffiche, maj.id);
      }

      // ---- Notifications côté patient ----
      const nouvelleAffectation = (data.soignantId && data.soignantId !== avant?.soignantId) || (data.transporteurId && data.transporteurId !== avant?.transporteurId);
      if (nouvelleAffectation) {
        await notifierPatient(acces.admin, maj, { titre: "Un intervenant vous a été assigné", corps: `Votre demande n°${maj.id} est prise en charge. Suivez son avancement en direct.` });
      }
      if (data.statut === "ANNULEE") {
        await notifierPatient(acces.admin, maj, { titre: "Votre rendez-vous a été annulé", corps: `Votre demande n°${maj.id} a été annulée. Contactez-nous pour toute question.` });
      }
    } catch {}

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
