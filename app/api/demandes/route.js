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

    // Compte du patient connecté (facultatif) : on RATTACHE la demande à son
    // compte pour qu'elle soit toujours visible et payable par lui, même si
    // le téléphone saisi diffère (ex. connexion Google sans téléphone, ou
    // numéro tapé différemment). Uniquement pour une réservation POUR SOI —
    // les réservations « pour un patient » gardent leur propre logique.
    let creeParUserId = null;
    if (!corps.pourPatient) {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      if (token) {
        try {
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (url && key) {
            const { createClient } = await import("@supabase/supabase-js");
            const admin = createClient(url, key, { auth: { persistSession: false } });
            const { data: { user } } = await admin.auth.getUser(token);
            if (user) creeParUserId = user.id;
          }
        } catch {}
      }
    }

    // ---- Réservation AU NOM d'un patient rattaché (établissement OU proche) ----
    // Vérifiée côté serveur : procuration ACCEPTE, non expirée, couvrant le
    // service. Sans procuration valide → refus explicite.
    // Payeur : l'ÉTABLISSEMENT s'il réserve (parEtabUserId) ; quand c'est un
    // PROCHE, la demande reste au nom et à la charge du patient.
    let parEtablissement = null;
    let parEtabUserId = null;
    if (corps.pourPatient) {
      const { identite, autorisationEtablissement, notifierPatientTel } = await import("@/lib/rattachements");
      const id = await identite(req);
      if (!id) {
        return NextResponse.json({ erreur: "procuration_requise" }, { status: 403 });
      }
      const verdict = await autorisationEtablissement(id.user.id, corps.pourPatient, String(service));
      if (!verdict.ok) {
        return NextResponse.json({ erreur: verdict.raison }, { status: 403 });
      }
      telephone = verdict.lien.patientTel; // la demande appartient au PATIENT
      const estPro = id.profil?.role === "pro";
      parEtablissement = verdict.lien.etabNom || (estPro ? id.profil?.etablissement || "Établissement" : "Proche");
      parEtabUserId = estPro ? id.user.id : null; // proche → le patient reste payeur
      // Le patient est prévenu qu'une réservation a été faite pour lui.
      notifierPatientTel(id.admin, telephone, {
        titre: "Réservation faite pour vous",
        corps: `${parEtablissement} a réservé une prestation ASM pour vous. Retrouvez-la dans votre suivi.`,
        type: "rdv",
      }).catch(() => {});
    }

    const texte = (v, max) => (v ? String(v).slice(0, max) : null);
    const dateSlot = String(corps.date || "").slice(0, 16);

    // Pack forfaitaire : vérifié serveur (actif + bon service) ; sa durée
    // remplace la durée par défaut. Code promo : mémorisé en MAJUSCULES,
    // validé et consommé à la facturation (jamais sur parole du client).
    let packId = null;
    let packDuree = null;
    if (corps.packId) {
      const pack = await prisma.pack.findUnique({ where: { id: Number(corps.packId) } });
      if (pack?.actif && pack.service === String(service)) {
        packId = pack.id;
        packDuree = pack.dureeMin;
      }
    }
    const codePromo = corps.codePromo ? String(corps.codePromo).trim().toUpperCase().slice(0, 30) : null;

    // Préférences de soin du patient : genre demandé pour CETTE réservation
    // (sinon préférence enregistrée) + intervenant favori — domicile.
    let prefGenre = ["homme", "femme"].includes(corps.prefGenre) ? corps.prefGenre : null;
    let favoriId = null;
    if (String(service) === "domicile") {
      try {
        const { preferencesPourTel } = await import("@/lib/preferences");
        const prefs = await preferencesPourTel(telephone);
        if (!prefGenre && prefs?.prefGenre) prefGenre = prefs.prefGenre;
        if (prefs?.soignantFavoriId) favoriId = prefs.soignantFavoriId;
      } catch {}
    }

    // Sous-mode du moteur de réservation (Mode B transport / Mode C livraison).
    // « urgent » passe automatiquement en tête de liste côté équipe.
    const SOUS_MODES = ["ponctuel", "urgent", "abonnement", "fenetre"];
    const sousMode = SOUS_MODES.includes(corps.sousMode) ? corps.sousMode : null;

    const serviceNorm = String(service).slice(0, 30);
    const duree = Math.min(Math.max(parseInt(corps.duree, 10) || 60, 15), 480);
    const dureeEffective = packDuree || duree;
    const commune = texte(corps.commune, 80);
    const reglage = await getReglage();

    // ---- Itinéraire Google Maps (transport) : le client envoie les
    // COORDONNÉES choisies, mais distance/durée/prix sont recalculés PAR LE
    // SERVEUR (jamais sur parole du navigateur). Sans clé ou sans coordonnées,
    // tout continue comme avant. Jamais bloquant.
    const geo = {};
    if (serviceNorm === "transport") {
      const fini = (x) => Number.isFinite(Number(x));
      if ([corps.departLat, corps.departLng, corps.destLat, corps.destLng].every(fini)) {
        geo.departLat = Number(corps.departLat);
        geo.departLng = Number(corps.departLng);
        geo.destLat = Number(corps.destLat);
        geo.destLng = Number(corps.destLng);
        try {
          const { calculerItineraire } = await import("@/lib/googleMaps");
          const route = await calculerItineraire({
            deLat: geo.departLat, deLng: geo.departLng, aLat: geo.destLat, aLng: geo.destLng,
          });
          if (route) {
            geo.distanceKm = route.km;
            geo.dureeRouteMin = route.minutes;
            geo.itineraire = route.polyline;
            const { estimerPrestation } = await import("@/lib/finances");
            const est = await estimerPrestation({
              service: serviceNorm, date: dateSlot, dureeMin: dureeEffective,
              typeTrajet: corps.typeTrajet || undefined, prioritaire: sousMode === "urgent",
              packId, distanceKm: route.km, details: texte(corps.details, 1500),
            });
            if (est) geo.prixEstime = est.total;
          }
        } catch {}
      }
    }

    // Capacité RÉELLE du créneau (ressources éligibles et libres — ou
    // capacité globale de repli si aucune ressource n'est configurée).
    let capacite = null;
    if (dateSlot.includes("T") && serviceNorm !== "medicaments") {
      const res = await capaciteCreneau(serviceNorm, dateSlot, {
        duree: dureeEffective, commune, typeTrajet: corps.typeTrajet || undefined,
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
            prefGenre,
            packId,
            codePromo,
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
            dureeMin: dureeEffective,
            commune,
            parEtablissement,
            parEtabUserId,
            creeParUserId,
            ...geo,
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
          duree: dureeEffective, commune, typeTrajet: corps.typeTrajet || undefined,
          prefGenre: prefGenre || undefined, favoriId: favoriId || undefined,
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
