import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus, ROLES_GESTION_EQUIPE, ROLES_GESTION_INTERVENANTS } from "@/lib/adminAuth";
import {
  compteFinancierPour, creerFacture, encaisserTicket, confirmerPaiement,
  rembourser, versionnerTarif, tarifsEnVigueur, installerTarifsDefaut,
  marquerRetards, prochainNumero, creerTicketEspeces,
  demandesAFacturer, facturerMensuel, moisLisible,
} from "@/lib/finances";
import { envoyerEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Limites des rôles NON super admin (contrôlées ici, côté serveur).
const REMISE_MAX_ADMIN_PCT = 20;      // % max qu'un admin peut accorder
const REMISE_MAX_ADMIN_FIXE = 2000;   // DZD max en remise fixe
const REMBOURSEMENT_MAX_ADMIN = 5000; // DZD max remboursable par un admin

// ═══════════ GET — tableaux de bord et listes ═══════════
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const p = new URL(req.url).searchParams;
    const vue = p.get("vue") || "bord";
    const q = (p.get("q") || "").trim();
    await marquerRetards();

    if (vue === "bord") {
      const jour = new Date().toISOString().slice(0, 10);
      const [factures, paiementsConfirmes, enAttente, tickets, souscriptions, remboursements] = await Promise.all([
        prisma.facture.findMany({ where: { statut: { notIn: ["BROUILLON", "ANNULEE"] } }, select: { total: true, paye: true, statut: true, emissionLe: true } }),
        prisma.paiement.aggregate({ where: { statut: { in: ["CONFIRME", "PARTIELLEMENT_REMBOURSE"] } }, _sum: { montant: true }, _count: true }),
        prisma.paiement.count({ where: { statut: "EN_ATTENTE" } }),
        prisma.ticketEspeces.count({ where: { statut: "EN_ATTENTE", expireLe: { gt: new Date() } } }),
        prisma.souscription.count({ where: { statut: "ACTIF" } }),
        prisma.remboursement.aggregate({ _sum: { montant: true }, _count: true }),
      ]);
      const emis = factures.reduce((s, f) => s + f.total, 0);
      const encaisse = factures.reduce((s, f) => s + f.paye, 0);
      const impayes = factures.filter((f) => f.statut === "EN_RETARD").reduce((s, f) => s + (f.total - f.paye), 0);
      const duJour = await prisma.paiement.aggregate({
        where: { statut: "CONFIRME", confirmeLe: { gte: new Date(jour + "T00:00:00Z") } },
        _sum: { montant: true }, _count: true,
      });
      const especesJour = await prisma.paiement.aggregate({
        where: { statut: "CONFIRME", moyen: "especes", confirmeLe: { gte: new Date(jour + "T00:00:00Z") } },
        _sum: { montant: true },
      });
      const reglage = await prisma.reglage.findUnique({ where: { id: 1 } });
      return NextResponse.json({
        role: acces.profil.role,
        facturationAuto: reglage ? reglage.facturationAuto !== false : true,
        bord: {
          facture: emis, encaisse, aEncaisser: emis - encaisse, impayes,
          paiementsJour: duJour._count, montantJour: duJour._sum.montant || 0,
          especesJour: especesJour._sum.montant || 0,
          paiementsEnAttente: enAttente, ticketsActifs: tickets,
          souscriptionsActives: souscriptions,
          rembourses: remboursements._sum.montant || 0, nbRemboursements: remboursements._count,
          nbFacturesRetard: factures.filter((f) => f.statut === "EN_RETARD").length,
          avertissement: enAttente > 0 ? "Des paiements attendent confirmation : les totaux peuvent évoluer." : null,
        },
      });
    }

    if (vue === "factures") {
      const where = {};
      if (p.get("statut")) where.statut = p.get("statut");
      if (q) {
        const comptes = await prisma.compteFinancier.findMany({
          where: { OR: [{ numero: { contains: q, mode: "insensitive" } }, { nom: { contains: q, mode: "insensitive" } }, { telFacturation: { contains: q.replace(/\D/g, "").slice(-8) || q } }] },
          select: { id: true },
        });
        where.OR = [
          { numero: { contains: q, mode: "insensitive" } },
          { compteId: { in: comptes.map((c) => c.id) } },
          ...(Number(q) ? [{ demandeId: Number(q) }] : []),
        ];
      }
      const factures = await prisma.facture.findMany({
        where, orderBy: { creeLe: "desc" }, take: 100,
        include: { compte: { select: { numero: true, nom: true } }, lignes: true },
      });
      return NextResponse.json({ factures });
    }

    if (vue === "paiements") {
      const where = {};
      if (p.get("statut")) where.statut = p.get("statut");
      if (p.get("moyen")) where.moyen = p.get("moyen");
      if (q) where.OR = [{ reference: { contains: q, mode: "insensitive" } }, { refFournisseur: { contains: q, mode: "insensitive" } }];
      const [paiements, ticketsAttente] = await Promise.all([
        prisma.paiement.findMany({ where, orderBy: { creeLe: "desc" }, take: 100, include: { facture: { select: { numero: true } }, remboursements: true } }),
        prisma.ticketEspeces.findMany({ where: { statut: "EN_ATTENTE" }, orderBy: { creeLe: "desc" }, take: 50, include: { facture: { select: { numero: true } } } }),
      ]);
      return NextResponse.json({ paiements, ticketsAttente });
    }

    if (vue === "ticket") {
      // Vérification staff d'un ticket (référence saisie ou jeton du QR).
      const ref = p.get("ref") || "";
      const t = await prisma.ticketEspeces.findFirst({
        where: ref.length > 30 ? { jeton: ref } : { reference: ref.toUpperCase() },
        include: { facture: { include: { compte: true } } },
      });
      if (!t) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
      return NextResponse.json({ ticket: t });
    }

    if (vue === "tarifs") {
      const tous = p.get("tous") === "1";
      const tarifs = tous
        ? await prisma.tarif.findMany({ orderBy: [{ code: "asc" }, { debut: "desc" }], take: 300 })
        : await tarifsEnVigueur({});
      return NextResponse.json({ tarifs });
    }

    if (vue === "remises") {
      const remises = await prisma.remiseClient.findMany({
        orderBy: { creeLe: "desc" }, take: 100, include: { compte: { select: { numero: true, nom: true } } },
      });
      return NextResponse.json({ remises });
    }

    if (vue === "points") {
      return NextResponse.json({ points: await prisma.pointPaiement.findMany({ orderBy: { nom: "asc" } }) });
    }

    if (vue === "plans") {
      const [plans, souscriptions] = await Promise.all([
        prisma.planAbonnement.findMany({ orderBy: { creeLe: "desc" }, include: { _count: { select: { souscriptions: true } } } }),
        prisma.souscription.findMany({ orderBy: { creeLe: "desc" }, take: 100, include: { plan: true, compte: { select: { numero: true, nom: true } } } }),
      ]);
      return NextResponse.json({ plans, souscriptions });
    }

    if (vue === "evenements") {
      if (!ROLES_GESTION_EQUIPE.includes(acces.profil.role)) return refus();
      return NextResponse.json({ evenements: await prisma.evenementPaiement.findMany({ orderBy: { creeLe: "desc" }, take: 100 }) });
    }

    if (vue === "comptes") {
      const comptes = await prisma.compteFinancier.findMany({
        where: q ? { OR: [{ numero: { contains: q, mode: "insensitive" } }, { nom: { contains: q, mode: "insensitive" } }] } : {},
        orderBy: { creeLe: "desc" }, take: 50,
      });
      return NextResponse.json({ comptes });
    }

    if (vue === "offres") {
      const [packs, devis, promos] = await Promise.all([
        prisma.pack.findMany({ orderBy: [{ actif: "desc" }, { ordre: "asc" }] }),
        prisma.devis.findMany({ orderBy: { creeLe: "desc" }, take: 100 }),
        prisma.codePromo.findMany({ where: { parrainUserId: null }, orderBy: { creeLe: "desc" }, take: 100 }),
      ]);
      return NextResponse.json({ packs, devis, promos });
    }

    if (vue === "mensuel") {
      // Facturation mensuelle des établissements : pour un mois donné,
      // chaque compte pro avec le nombre de prestations restant à facturer
      // et la facture groupée déjà émise le cas échéant.
      const mois = /^\d{4}-\d{2}$/.test(p.get("mois") || "") ? p.get("mois") : new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 7);
      const pros = await prisma.compteFinancier.findMany({ where: { type: "pro" }, orderBy: { nom: "asc" }, take: 200 });
      const lignes = [];
      for (const compte of pros) {
        const [aFacturer, groupee] = await Promise.all([
          demandesAFacturer(compte, mois),
          prisma.facture.findFirst({ where: { compteId: compte.id, statut: { not: "ANNULEE" }, notes: { contains: `[MENSUEL ${mois}]` } } }),
        ]);
        lignes.push({
          compte, aFacturer: aFacturer.length,
          patients: [...new Set(aFacturer.map((d) => d.nom).filter(Boolean))].length,
          facture: groupee ? { id: groupee.id, numero: groupee.numero, total: groupee.total, statut: groupee.statut } : null,
        });
      }
      return NextResponse.json({ mois, moisLisible: moisLisible(mois), etablissements: lignes });
    }

    return NextResponse.json({ erreur: "vue inconnue" }, { status: 400 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// ═══════════ POST — actions (permissions par rôle, tout journalisé) ═══════════
export async function POST(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  const role = acces.profil.role;
  const superadmin = role === "superadmin";
  const gestion = ROLES_GESTION_INTERVENANTS.includes(role); // superadmin/admin/modérateur

  try {
    const c = await req.json();
    const action = c.action;

    // ---- Facturation ----
    if (action === "facture.creer") {
      if (!gestion) return refus();
      // Compte financier du client (créé si besoin depuis son profil).
      let compte = null;
      if (c.compteId) compte = await prisma.compteFinancier.findUnique({ where: { id: Number(c.compteId) } });
      else if (c.userId) {
        const { data: profil } = await acces.admin.from("profil").select("*").eq("id", c.userId).maybeSingle();
        if (!profil) return NextResponse.json({ erreur: "client introuvable" }, { status: 404 });
        compte = await compteFinancierPour(c.userId, profil);
      }
      if (!compte) return NextResponse.json({ erreur: "compte financier requis" }, { status: 400 });

      let lignes = Array.isArray(c.lignes) ? c.lignes : [];
      let service = c.service || null;
      // Facturation directe d'une réservation : lignes proposées depuis les tarifs.
      if (c.demandeId && lignes.length === 0) {
        const demande = await prisma.demande.findUnique({ where: { id: Number(c.demandeId) } });
        if (!demande) return NextResponse.json({ erreur: "réservation introuvable" }, { status: 404 });
        service = demande.service;
        const tarifs = await tarifsEnVigueur({ service: demande.service });
        const base = tarifs.find((t) => t.categorie !== "supplement" && t.categorie !== "penalite");
        if (!base) return NextResponse.json({ erreur: "aucun tarif en vigueur pour ce service" }, { status: 400 });
        const quantite = base.unite === "heure" ? Math.max(1, Math.round((demande.dureeMin || 60) / 60)) : 1;
        lignes = [{ libelle: `${base.libelle} — réservation n°${demande.id}`, quantite, prixUnitaire: base.montant, tarifId: base.id }];
      }
      const facture = await creerFacture({
        compteId: compte.id, demandeId: c.demandeId ? Number(c.demandeId) : null,
        lignes, echeanceJours: Number(c.echeanceJours) || 7, creePar: acces.nomAffiche,
        service, notes: c.notes,
      });
      await journaliser(acces.nomAffiche, "finance.facture.creee", "facture", facture.id, `${facture.numero} · ${facture.total} DZD`);
      // Notification client.
      try {
        await prisma.notification.create({
          data: { userId: compte.userId, type: "info", titre: "Nouvelle facture ASM", corps: `Facture ${facture.numero} de ${facture.total} DZD — échéance le ${facture.echeance}.`, auteur: "ASM Finances", statut: "NON_LU" },
        });
      } catch {}
      return NextResponse.json({ ok: true, facture }, { status: 201 });
    }

    if (action === "facture.annuler") {
      // Une facture émise n'est JAMAIS supprimée : elle est annulée, tracée.
      if (!gestion) return refus();
      const f = await prisma.facture.findUnique({ where: { id: Number(c.id) } });
      if (!f) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
      if (f.paye > 0 && !superadmin) return NextResponse.json({ erreur: "facture partiellement payée : annulation réservée au super admin" }, { status: 403 });
      await prisma.facture.update({
        where: { id: f.id },
        data: { statut: "ANNULEE", annuleePar: acces.nomAffiche, annuleeLe: new Date(), notes: [f.notes, `Annulée : ${c.motif || "sans motif"}`].filter(Boolean).join(" | ") },
      });
      await journaliser(acces.nomAffiche, "finance.facture.annulee", "facture", f.id, `${f.numero} · ${c.motif || ""}`);
      return NextResponse.json({ ok: true });
    }

    if (action === "ticket.creer") {
      if (!gestion) return refus();
      const f = await prisma.facture.findUnique({ where: { id: Number(c.factureId) } });
      if (!f) return NextResponse.json({ erreur: "facture introuvable" }, { status: 404 });
      const ticket = await creerTicketEspeces({ facture: f, compteId: f.compteId });
      await journaliser(acces.nomAffiche, "finance.ticket.cree", "ticket", ticket.id, ticket.reference);
      return NextResponse.json({ ok: true, ticket }, { status: 201 });
    }

    if (action === "ticket.encaisser") {
      if (!gestion) return refus();
      const r = await encaisserTicket({
        reference: c.reference ? String(c.reference).toUpperCase() : undefined,
        jeton: c.jeton || undefined,
        caissier: acces.nomAffiche, pointId: c.pointId ? Number(c.pointId) : null,
      });
      if (r.erreur) return NextResponse.json({ erreur: r.erreur, ticket: r.ticket || null }, { status: 409 });
      await journaliser(acces.nomAffiche, "finance.especes.encaisse", "paiement", r.paiement.id, `${r.paiement.reference} · ${r.paiement.montant} DZD · ticket ${r.ticket.reference}`);
      // Reçu + notification au client.
      try {
        const compte = await prisma.compteFinancier.findUnique({ where: { id: r.paiement.compteId } });
        await prisma.notification.create({
          data: { userId: compte.userId, type: "info", titre: "Paiement en espèces confirmé ✓", corps: `Nous avons bien reçu ${r.paiement.montant} DZD (reçu ${r.paiement.reference}).`, auteur: "ASM Finances", statut: "NON_LU" },
        });
      } catch {}
      return NextResponse.json({ ok: true, paiement: r.paiement });
    }

    if (action === "virement.valider" || action === "virement.refuser") {
      if (!["superadmin", "admin"].includes(role)) return refus();
      const pa = await prisma.paiement.findUnique({ where: { id: Number(c.paiementId) } });
      if (!pa || pa.moyen !== "virement") return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
      if (action === "virement.refuser") {
        await prisma.paiement.updateMany({ where: { id: pa.id, statut: "EN_ATTENTE" }, data: { statut: "ANNULE" } });
        await journaliser(acces.nomAffiche, "finance.virement.refuse", "paiement", pa.id, pa.reference);
        return NextResponse.json({ ok: true });
      }
      const r = await confirmerPaiement(pa.id);
      await prisma.paiement.update({ where: { id: pa.id }, data: { encaissePar: acces.nomAffiche } });
      await journaliser(acces.nomAffiche, "finance.virement.valide", "paiement", pa.id, pa.reference);
      return NextResponse.json({ ok: true, deja: r.deja });
    }

    if (action === "rembourser") {
      const montant = parseInt(c.montant, 10) || 0;
      if (!superadmin) {
        if (role !== "admin") return refus();
        if (montant > REMBOURSEMENT_MAX_ADMIN) {
          return NextResponse.json({ erreur: `Un administrateur peut rembourser au maximum ${REMBOURSEMENT_MAX_ADMIN} DZD — au-delà : super admin.` }, { status: 403 });
        }
      }
      if (!c.motif) return NextResponse.json({ erreur: "motif obligatoire" }, { status: 400 });
      try {
        const remb = await rembourser({ paiementId: c.paiementId, montant, motif: c.motif, auteur: acces.nomAffiche });
        await journaliser(acces.nomAffiche, "finance.remboursement", "paiement", Number(c.paiementId), `${montant} DZD · ${c.motif}`);
        return NextResponse.json({ ok: true, remboursement: remb }, { status: 201 });
      } catch (e) {
        return NextResponse.json({ erreur: String(e.message) }, { status: 400 });
      }
    }

    // ---- Tarifs (super admin uniquement) ----
    if (["tarif.creer", "tarif.version", "tarif.desactiver", "tarifs.installer"].includes(action)) {
      if (!superadmin) return refus();
      if (action === "tarifs.installer") {
        const n = await installerTarifsDefaut(acces.nomAffiche);
        await journaliser(acces.nomAffiche, "finance.tarifs.installes", "tarif", 0, `${n} tarifs`);
        return NextResponse.json({ ok: true, installes: n });
      }
      if (action === "tarif.creer") {
        const t = await prisma.tarif.create({
          data: {
            categorie: String(c.categorie || "supplement").slice(0, 40),
            code: String(c.code || "").slice(0, 60) || `perso_${Date.now()}`,
            libelle: String(c.libelle || "").slice(0, 160),
            montant: Math.max(0, parseInt(c.montant, 10) || 0),
            unite: c.unite || "prestation", service: c.service || null,
            debut: c.debut || new Date().toISOString().slice(0, 10),
            creePar: acces.nomAffiche,
          },
        });
        await journaliser(acces.nomAffiche, "finance.tarif.cree", "tarif", t.id, `${t.libelle} · ${t.montant} DZD`);
        return NextResponse.json({ ok: true, tarif: t }, { status: 201 });
      }
      if (action === "tarif.version") {
        const t = await versionnerTarif(c.id, { montant: parseInt(c.montant, 10), debut: c.debut }, acces.nomAffiche);
        await journaliser(acces.nomAffiche, "finance.tarif.version", "tarif", t.id, `${t.code} → ${t.montant} DZD dès ${t.debut}`);
        return NextResponse.json({ ok: true, tarif: t });
      }
      await prisma.tarif.update({ where: { id: Number(c.id) }, data: { actif: false, fin: new Date().toISOString().slice(0, 10) } });
      await journaliser(acces.nomAffiche, "finance.tarif.desactive", "tarif", Number(c.id), "");
      return NextResponse.json({ ok: true });
    }

    // ---- Remises personnalisées (plafond pour les admins) ----
    if (action === "remise.creer") {
      if (!["superadmin", "admin"].includes(role)) return refus();
      const valeur = Math.max(1, parseInt(c.valeur, 10) || 0);
      if (!superadmin) {
        if (c.type === "pourcentage" && valeur > REMISE_MAX_ADMIN_PCT)
          return NextResponse.json({ erreur: `Remise limitée à ${REMISE_MAX_ADMIN_PCT} % pour un administrateur.` }, { status: 403 });
        if (c.type === "fixe" && valeur > REMISE_MAX_ADMIN_FIXE)
          return NextResponse.json({ erreur: `Remise fixe limitée à ${REMISE_MAX_ADMIN_FIXE} DZD pour un administrateur.` }, { status: 403 });
      }
      if (!c.motif) return NextResponse.json({ erreur: "motif obligatoire" }, { status: 400 });
      const r = await prisma.remiseClient.create({
        data: {
          compteId: Number(c.compteId), type: c.type === "fixe" ? "fixe" : "pourcentage",
          valeur, service: c.service || null, motif: String(c.motif).slice(0, 160),
          debut: c.debut || new Date().toISOString().slice(0, 10), fin: c.fin || null,
          plafond: c.plafond ? parseInt(c.plafond, 10) : null, auteur: acces.nomAffiche,
        },
      });
      await journaliser(acces.nomAffiche, "finance.remise.creee", "remise", r.id, `compte ${r.compteId} · ${r.valeur}${r.type === "pourcentage" ? " %" : " DZD"} · ${r.motif}`);
      return NextResponse.json({ ok: true, remise: r }, { status: 201 });
    }
    if (action === "remise.supprimer") {
      if (!["superadmin", "admin"].includes(role)) return refus();
      await prisma.remiseClient.delete({ where: { id: Number(c.id) } });
      await journaliser(acces.nomAffiche, "finance.remise.supprimee", "remise", Number(c.id), "");
      return NextResponse.json({ ok: true });
    }

    // ---- Points de paiement ----
    if (action === "point.creer" || action === "point.maj") {
      if (!["superadmin", "admin"].includes(role)) return refus();
      const data = {
        nom: String(c.nom || "").slice(0, 120), typePoint: c.typePoint || "agence",
        adresse: c.adresse || null, commune: c.commune || null, horaires: c.horaires || null,
        telephone: c.telephone || null, responsable: c.responsable || null,
        plafond: c.plafond ? parseInt(c.plafond, 10) : null, consignes: c.consignes || null,
        actif: c.actif !== false,
      };
      const pt = action === "point.creer"
        ? await prisma.pointPaiement.create({ data })
        : await prisma.pointPaiement.update({ where: { id: Number(c.id) }, data });
      await journaliser(acces.nomAffiche, `finance.point.${action === "point.creer" ? "cree" : "maj"}`, "point", pt.id, pt.nom);
      return NextResponse.json({ ok: true, point: pt });
    }

    // ---- Plans & souscriptions ----
    if (action === "plan.creer" || action === "plan.maj") {
      if (!superadmin) return refus();
      const data = {
        nom: String(c.nom || "").slice(0, 120), description: c.description || null,
        prix: Math.max(0, parseInt(c.prix, 10) || 0), frequence: c.frequence || "mensuel",
        service: c.service || null, quantiteIncluse: c.quantiteIncluse ? parseInt(c.quantiteIncluse, 10) : null,
        actif: c.actif !== false,
      };
      const plan = action === "plan.creer"
        ? await prisma.planAbonnement.create({ data })
        : await prisma.planAbonnement.update({ where: { id: Number(c.id) }, data });
      await journaliser(acces.nomAffiche, "finance.plan", "plan", plan.id, `${plan.nom} · ${plan.prix} DZD`);
      return NextResponse.json({ ok: true, plan });
    }
    if (action === "souscription.creer") {
      if (!gestion) return refus();
      const plan = await prisma.planAbonnement.findUnique({ where: { id: Number(c.planId) } });
      if (!plan?.actif) return NextResponse.json({ erreur: "plan indisponible" }, { status: 400 });
      const s = await prisma.souscription.create({
        data: { compteId: Number(c.compteId), planId: plan.id, prix: plan.prix, debut: c.debut || new Date().toISOString().slice(0, 10), creePar: acces.nomAffiche },
      });
      await journaliser(acces.nomAffiche, "finance.souscription.creee", "souscription", s.id, plan.nom);
      return NextResponse.json({ ok: true, souscription: s }, { status: 201 });
    }
    if (action === "souscription.statut") {
      if (!gestion) return refus();
      const statut = ["ACTIF", "SUSPENDU", "ANNULE"].includes(c.statut) ? c.statut : null;
      if (!statut) return NextResponse.json({ erreur: "statut invalide" }, { status: 400 });
      const s = await prisma.souscription.update({ where: { id: Number(c.id) }, data: { statut, fin: statut === "ANNULE" ? new Date().toISOString().slice(0, 10) : null } });
      await journaliser(acces.nomAffiche, "finance.souscription.statut", "souscription", s.id, statut);
      return NextResponse.json({ ok: true });
    }
    if (action === "souscriptions.facturer") {
      // Génère les factures du MOIS COURANT (une seule fois par souscription
      // et par mois — anti-doublon). Aucun débit automatique : le client est
      // notifié et règle par les moyens disponibles (mandats non supportés
      // par les fournisseurs actuels).
      if (!["superadmin", "admin"].includes(role)) return refus();
      const mois = new Date().toISOString().slice(0, 7);
      const actives = await prisma.souscription.findMany({
        where: { statut: "ACTIF", OR: [{ derniereFacture: null }, { derniereFacture: { lt: mois } }] },
        include: { plan: true, compte: true },
      });
      let crees = 0;
      for (const s of actives) {
        const f = await creerFacture({
          compteId: s.compteId, souscriptionId: s.id,
          lignes: [{ libelle: `${s.plan.nom} — ${mois}`, quantite: 1, prixUnitaire: s.prix }],
          echeanceJours: 7, creePar: acces.nomAffiche, service: s.plan.service,
          notes: `Abonnement ${s.plan.frequence}`,
        });
        await prisma.souscription.update({ where: { id: s.id }, data: { derniereFacture: mois } });
        try {
          await prisma.notification.create({
            data: { userId: s.compte.userId, type: "info", titre: "Votre facture d'abonnement", corps: `Facture ${f.numero} de ${f.total} DZD (${s.plan.nom}) — échéance le ${f.echeance}.`, auteur: "ASM Finances", statut: "NON_LU" },
          });
        } catch {}
        crees++;
      }
      await journaliser(acces.nomAffiche, "finance.abonnements.factures", "souscription", 0, `${mois} · ${crees} factures`);
      return NextResponse.json({ ok: true, crees, mois });
    }

    // ---- Relances d'impayés (moteur sans doublon, journalisé) ----
    if (action === "relances.envoyer") {
      if (!gestion) return refus();
      await marquerRetards();
      const jour = new Date();
      const dans3j = new Date(jour.getTime() + 3 * 86400000).toISOString().slice(0, 10);
      const auj = jour.toISOString().slice(0, 10);
      const j3 = new Date(jour.getTime() - 3 * 86400000).toISOString().slice(0, 10);
      const j7 = new Date(jour.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      const NIVEAUX = [
        { niveau: "rappel", cond: (f) => f.echeance <= dans3j && f.echeance > auj, titre: "Échéance proche", corps: (f, du) => `Votre facture ${f.numero} (${du} DZD) arrive à échéance le ${f.echeance}.` },
        { niveau: "echeance", cond: (f) => f.echeance === auj, titre: "Facture à régler aujourd'hui", corps: (f, du) => `Votre facture ${f.numero} (${du} DZD) est à régler aujourd'hui.` },
        { niveau: "relance1", cond: (f) => f.echeance <= j3 && f.echeance > j7, titre: "Rappel de paiement", corps: (f, du) => `Votre facture ${f.numero} (${du} DZD) est arrivée à échéance. Vous pouvez payer en ligne ou en espèces.` },
        { niveau: "relance2", cond: (f) => f.echeance <= j7, titre: "Second rappel de paiement", corps: (f, du) => `Malgré notre premier rappel, la facture ${f.numero} (${du} DZD) reste impayée. Contactez-nous en cas de difficulté.` },
      ];
      const ouvertes = await prisma.facture.findMany({
        where: { statut: { in: ["EMISE", "PARTIELLEMENT_PAYEE", "EN_RETARD"] } },
        include: { compte: true, relances: true },
      });
      let envoyees = 0;
      for (const f of ouvertes) {
        const du = f.total - f.paye;
        if (du <= 0) continue;
        for (const n of NIVEAUX) {
          if (!n.cond(f) || f.relances.some((r) => r.niveau === n.niveau)) continue;
          await prisma.relancePaiement.create({ data: { factureId: f.id, niveau: n.niveau, canal: "interne", par: acces.nomAffiche } }).catch(() => null);
          try {
            await prisma.notification.create({
              data: { userId: f.compte.userId, type: "info", titre: n.titre, corps: n.corps(f, du), auteur: "ASM Finances", statut: "NON_LU" },
            });
            const { envoyerPush } = await import("@/lib/pushEnvoi");
            await envoyerPush(f.compte.userId, { titre: n.titre, corps: n.corps(f, du), url: "/compte/paiements" });
          } catch {}
          if (f.compte.emailFacturation) {
            try {
              await envoyerEmail({
                to: f.compte.emailFacturation,
                subject: `ASM — ${n.titre}`,
                html: `<p>${n.corps(f, du)}</p><p><a href="https://asm-sante.com/compte/paiements">Voir mes factures et payer</a></p>`,
              });
            } catch {}
          }
          envoyees++;
        }
      }
      await journaliser(acces.nomAffiche, "finance.relances", "facture", 0, `${envoyees} relances envoyées`);
      return NextResponse.json({ ok: true, envoyees });
    }

    // ---- Finances établissement (facturation mensuelle groupée) ----
    if (action === "compte.modeFacturation") {
      if (!["superadmin", "admin"].includes(role)) return refus();
      const mode = ["prestation", "mensuel"].includes(c.mode) ? c.mode : null;
      if (!mode) return NextResponse.json({ erreur: "mode invalide" }, { status: 400 });
      const compte = await prisma.compteFinancier.update({ where: { id: Number(c.compteId) }, data: { modeFacturation: mode } });
      await journaliser(acces.nomAffiche, "finance.compte.mode", "compte", compte.id, `${compte.numero} → ${mode}`);
      return NextResponse.json({ ok: true, compte });
    }

    if (action === "etablissement.facturer") {
      // Génère LA facture mensuelle groupée d'un établissement (anti-doublon
      // par mois : relancer ne crée jamais de seconde facture).
      if (!["superadmin", "admin"].includes(role)) return refus();
      if (!/^\d{4}-\d{2}$/.test(c.mois || "")) return NextResponse.json({ erreur: "mois attendu (AAAA-MM)" }, { status: 400 });
      const compte = await prisma.compteFinancier.findUnique({ where: { id: Number(c.compteId) } });
      if (!compte) return NextResponse.json({ erreur: "compte introuvable" }, { status: 404 });
      const r = await facturerMensuel(compte, c.mois, { auteur: acces.nomAffiche });
      if (r.erreur) return NextResponse.json({ erreur: r.erreur }, { status: 400 });
      if (r.deja) return NextResponse.json({ deja: true, facture: r.facture });
      if (r.vide) return NextResponse.json({ vide: true, sansTarif: r.sansTarif || 0 });
      return NextResponse.json({ ok: true, facture: r.facture, prestations: r.prestations }, { status: 201 });
    }

    if (action === "etablissements.facturer.tous") {
      // Toutes les factures mensuelles du mois en un clic (comptes pro en
      // mode mensuel) — chaque établissement reste protégé par l'anti-doublon.
      if (!["superadmin", "admin"].includes(role)) return refus();
      if (!/^\d{4}-\d{2}$/.test(c.mois || "")) return NextResponse.json({ erreur: "mois attendu (AAAA-MM)" }, { status: 400 });
      const pros = await prisma.compteFinancier.findMany({ where: { type: "pro", modeFacturation: "mensuel" } });
      let creees = 0, montant = 0;
      for (const compte of pros) {
        const r = await facturerMensuel(compte, c.mois, { auteur: acces.nomAffiche });
        if (r.ok) { creees++; montant += r.facture.total; }
      }
      await journaliser(acces.nomAffiche, "finance.mensuel.tous", "facture", 0, `${c.mois} · ${creees} facture(s) · ${montant} DZD`);
      return NextResponse.json({ ok: true, creees, montant });
    }

    // ---- Packs forfaitaires (création réservée au super admin) ----
    if (action === "pack.creer" || action === "pack.maj") {
      if (!superadmin) return refus();
      const data = {
        nom: String(c.nom || "").slice(0, 120),
        nomAr: c.nomAr ? String(c.nomAr).slice(0, 120) : null,
        description: c.description ? String(c.description).slice(0, 400) : null,
        descriptionAr: c.descriptionAr ? String(c.descriptionAr).slice(0, 400) : null,
        service: ["transport", "domicile", "medicaments"].includes(c.service) ? c.service : "transport",
        prix: Math.max(0, parseInt(c.prix, 10) || 0),
        dureeMin: Math.min(Math.max(parseInt(c.dureeMin, 10) || 60, 15), 480),
        ordre: parseInt(c.ordre, 10) || 0,
        actif: c.actif !== false,
        creePar: acces.nomAffiche,
      };
      if (!data.nom || !data.prix) return NextResponse.json({ erreur: "nom et prix obligatoires" }, { status: 400 });
      const pack = action === "pack.creer"
        ? await prisma.pack.create({ data })
        : await prisma.pack.update({ where: { id: Number(c.id) }, data });
      await journaliser(acces.nomAffiche, "finance.pack", "pack", pack.id, `${pack.nom} · ${pack.prix} DZD`);
      return NextResponse.json({ ok: true, pack });
    }

    // ---- Devis : chiffrage puis suivi de statut ----
    if (action === "devis.chiffrer") {
      if (!gestion) return refus();
      const montant = Math.max(0, parseInt(c.montant, 10) || 0);
      if (!montant) return NextResponse.json({ erreur: "montant requis" }, { status: 400 });
      const devis = await prisma.devis.update({
        where: { id: Number(c.id) },
        data: {
          montant, reponse: c.reponse ? String(c.reponse).slice(0, 1200) : null,
          statut: "CHIFFRE", chiffrePar: acces.nomAffiche, chiffreLe: new Date(),
        },
      });
      await journaliser(acces.nomAffiche, "finance.devis.chiffre", "devis", devis.id, `${devis.numero} · ${montant} DZD`);
      return NextResponse.json({ ok: true, devis });
    }
    if (action === "devis.statut") {
      if (!gestion) return refus();
      const statut = ["ACCEPTE", "REFUSE", "NOUVEAU", "CHIFFRE"].includes(c.statut) ? c.statut : null;
      if (!statut) return NextResponse.json({ erreur: "statut invalide" }, { status: 400 });
      const devis = await prisma.devis.update({ where: { id: Number(c.id) }, data: { statut } });
      await journaliser(acces.nomAffiche, "finance.devis.statut", "devis", devis.id, `${devis.numero} → ${statut}`);
      return NextResponse.json({ ok: true });
    }

    // ---- Codes promo (création réservée au super admin) ----
    if (action === "promo.creer") {
      if (!superadmin) return refus();
      const code = String(c.code || "").trim().toUpperCase().slice(0, 30);
      if (!code) return NextResponse.json({ erreur: "code requis" }, { status: 400 });
      const promo = await prisma.codePromo.create({
        data: {
          code, type: c.type === "fixe" ? "fixe" : "pourcentage",
          valeur: Math.max(1, parseInt(c.valeur, 10) || 0),
          plafond: c.plafond ? parseInt(c.plafond, 10) : null,
          service: ["transport", "domicile", "medicaments"].includes(c.service) ? c.service : null,
          debut: c.debut || new Date().toISOString().slice(0, 10),
          fin: c.fin || null,
          maxUsages: c.maxUsages ? parseInt(c.maxUsages, 10) : null,
          creePar: acces.nomAffiche,
        },
      });
      await journaliser(acces.nomAffiche, "finance.promo.cree", "promo", promo.id, promo.code);
      return NextResponse.json({ ok: true, promo }, { status: 201 });
    }
    if (action === "promo.desactiver") {
      if (!superadmin) return refus();
      await prisma.codePromo.update({ where: { id: Number(c.id) }, data: { actif: false } });
      await journaliser(acces.nomAffiche, "finance.promo.off", "promo", Number(c.id), "");
      return NextResponse.json({ ok: true });
    }

    if (action === "reglage.facturationAuto") {
      if (!superadmin) return refus();
      await prisma.reglage.upsert({
        where: { id: 1 },
        update: { facturationAuto: !!c.actif },
        create: { id: 1, facturationAuto: !!c.actif },
      });
      await journaliser(acces.nomAffiche, "finance.facturation_auto", "reglage", 1, c.actif ? "activée" : "désactivée");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ erreur: "action inconnue" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
