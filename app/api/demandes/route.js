import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifierEquipe } from "@/lib/notifier";
import { getReglage } from "@/lib/creneaux";
import { capaciteCreneau, choisirIntervenant } from "@/lib/disponibilites";
import { logErreur } from "@/lib/log";
import { autorise } from "@/lib/ratelimit";

// POST /api/demandes — un patient ou un établissement envoie une demande
export async function POST(req) {
  try {
    // Limitation anti-abus légère (par IP) — voir lib/ratelimit.js
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`demande:${ip}`, 10, 60000)) {
      return NextResponse.json({ erreur: "Trop de demandes, réessayez dans une minute." }, { status: 429 });
    }

    const corps = await req.json();
    const { service } = corps;
    let { telephone } = corps;

    if (!service || !telephone || telephone.trim().length < 9) {
      return NextResponse.json({ erreur: "Données invalides" }, { status: 400 });
    }

    // ---- Réservation par un ÉTABLISSEMENT au nom d'un patient rattaché ----
    // Vérifiée côté serveur : procuration ACCEPTE, non expirée, couvrant le
    // service. Sans procuration valide → refus explicite.
    let parEtablissement = null;
    let parEtabUserId = null;
    if (corps.pourPatient) {
      const { identite, autorisationEtablissement, notifierPatientTel } = await import("@/lib/rattachements");
      const id = await identite(req);
      if (!id || id.profil?.role !== "pro") {
        return NextResponse.json({ erreur: "procuration_requise" }, { status: 403 });
      }
      const verdict = await autorisationEtablissement(id.user.id, corps.pourPatient, String(service));
      if (!verdict.ok) {
        return NextResponse.json({ erreur: verdict.raison }, { status: 403 });
      }
      telephone = verdict.lien.patientTel; // la demande appartient au PATIENT
      parEtablissement = verdict.lien.etabNom || id.profil?.etablissement || "Établissement";
      parEtabUserId = id.user.id;
      // Le patient est prévenu qu'une réservation a été faite pour lui.
      notifierPatientTel(id.admin, telephone, {
        titre: "Réservation faite pour vous",
        corps: `${parEtablissement} a réservé une prestation ASM pour vous. Retrouvez-la dans votre suivi.`,
        type: "rdv",
      }).catch(() => {});
    }

    const texte = (v, max) => (v ? String(v).slice(0, max) : null);
    const dateSlot = String(corps.date || "").slice(0, 16);

    // Sous-mode du moteur de réservation (Mode B transport / Mode C livraison).
    // « urgent » passe automatiquement en tête de liste côté équipe.
    const SOUS_MODES = ["ponctuel", "urgent", "abonnement", "fenetre"];
    const sousMode = SOUS_MODES.includes(corps.sousMode) ? corps.sousMode : null;

    const serviceNorm = String(service).slice(0, 30);
    const duree = Math.min(Math.max(parseInt(corps.duree, 10) || 60, 15), 480);
    const commune = texte(corps.commune, 80);
    const reglage = await getReglage();

    // Capacité RÉELLE du créneau (ressources éligibles et libres — ou
    // capacité globale de repli si aucune ressource n'est configurée).
    let capacite = null;
    if (dateSlot.includes("T") && serviceNorm !== "medicaments") {
      const res = await capaciteCreneau(serviceNorm, dateSlot, {
        duree, commune, typeTrajet: corps.typeTrajet || undefined,
      });
      capacite = res.capacite;
      if (capacite <= 0) return NextResponse.json({ erreur: "creneau_pris" }, { status: 409 });
    }

    // Contrôle anti-double-réservation dans une transaction : le nombre de
    // demandes déjà posées sur ce créneau (ou cette fenêtre de livraison)
    // ne doit pas dépasser la capacité calculée.
    let demande;
    try {
      demande = await prisma.$transaction(async (tx) => {
        if (capacite !== null) {
          const pris = await tx.demande.count({
            where: { service: serviceNorm, date: dateSlot, statut: { not: "ANNULEE" } },
          });
          if (pris >= capacite) {
            const err = new Error("creneau_pris");
            err.code = "CRENEAU_PRIS";
            throw err;
          }
        }
        // Livraison : la fenêtre choisie a une capacité maximale.
        if (serviceNorm === "medicaments" && corps.fenetre && dateSlot) {
          const prisFenetre = await tx.demande.count({
            where: {
              service: "medicaments",
              date: { startsWith: dateSlot.slice(0, 10) },
              fenetre: String(corps.fenetre).slice(0, 60),
              statut: { not: "ANNULEE" },
            },
          });
          if (prisFenetre >= reglage.capaciteFenetre) {
            const err = new Error("fenetre_pleine");
            err.code = "FENETRE_PLEINE";
            throw err;
          }
        }
        return tx.demande.create({
          data: {
            service: serviceNorm,
            typeTrajet: texte(corps.typeTrajet, 30),
            nom: texte(corps.nom, 80),
            telephone: String(telephone).slice(0, 20),
            depart: texte(corps.depart, 160),
            destination: texte(corps.destination, 160),
            date: dateSlot,
            recurrence: String(corps.recurrence || "Une seule fois").slice(0, 80),
            notes: texte(corps.notes, 500),
            details: texte(corps.details, 1500),
            espace: corps.espace === "pro" ? "pro" : "patient",
            sousMode,
            prioritaire: sousMode === "urgent",
            fenetre: texte(corps.fenetre, 60),
            pharmacie: texte(corps.pharmacie, 200),
            dureeMin: duree,
            commune,
            parEtablissement,
            parEtabUserId,
          },
        });
      });
    } catch (e) {
      if (e.code === "CRENEAU_PRIS") {
        return NextResponse.json({ erreur: "creneau_pris" }, { status: 409 });
      }
      if (e.code === "FENETRE_PLEINE") {
        return NextResponse.json({ erreur: "fenetre_pleine" }, { status: 409 });
      }
      throw e;
    }

    // Affectation automatique (option réglable) : l'intervenant éligible le
    // moins chargé du jour est assigné immédiatement, sinon « à rappeler ».
    if (reglage.affectationAuto && dateSlot.includes("T") && serviceNorm !== "medicaments") {
      try {
        const choisi = await choisirIntervenant(serviceNorm, dateSlot, {
          duree, commune, typeTrajet: corps.typeTrajet || undefined,
        });
        if (choisi) {
          const champ = serviceNorm === "domicile" ? "soignantId" : "transporteurId";
          demande = await prisma.demande.update({
            where: { id: demande.id },
            data: { [champ]: choisi.id, statut: "AFFECTEE" },
          });
          if (choisi.userId) {
            await prisma.notification.create({
              data: {
                userId: choisi.userId, type: "rdv",
                titre: serviceNorm === "domicile" ? "Nouvelle intervention" : "Nouvelle course / tournée",
                corps: `${dateSlot.replace("T", " à ")}${demande.destination ? ` · ${demande.destination}` : ""}`,
                auteur: "Affectation automatique", statut: "NON_LU",
                lienType: "intervention", lienId: String(demande.id),
              },
            });
            const { envoyerPush } = await import("@/lib/pushEnvoi");
            await envoyerPush(choisi.userId, {
              titre: "Nouvelle intervention",
              corps: dateSlot.replace("T", " à "),
              url: `/employe/interventions/${demande.id}`,
            });
          }
        }
      } catch {}
    }

    await notifierEquipe(demande);
    return NextResponse.json({ ok: true, id: demande.id }, { status: 201 });
  } catch (e) {
    logErreur("demandes.POST", e);
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// GET /api/demandes — lecture réservée à l'équipe (données personnelles !).
// Les patients passent par /api/mes-demandes (leurs demandes uniquement) ;
// l'admin passe par /api/admin/demandes. Cette route reste pour
// compatibilité mais exige désormais un jeton interne.
export async function GET(req) {
  const { verifierAdmin } = await import("@/lib/adminAuth");
  const acces = await verifierAdmin(req);
  if (!acces) return NextResponse.json({ erreur: "Accès refusé" }, { status: 403 });
  try {
    const demandes = await prisma.demande.findMany({
      orderBy: { creeLe: "desc" },
      take: 100,
    });
    return NextResponse.json(demandes);
  } catch (e) {
    logErreur("demandes.GET", e);
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// (L'ancien PATCH public a été supprimé : les mises à jour de statut passent
// exclusivement par /api/admin/demandes, protégé par rôle.)
