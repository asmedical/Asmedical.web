// Trajet en temps réel — logique centrale (testable sans Supabase).
//  - Le CHAUFFEUR partage sa position pendant qu'il est en route : elle est
//    stockée sur la demande (posLat/posLng/posLe) et lue par le suivi patient.
//  - Le PATIENT peut déclencher le retour d'un transport : « Je suis prêt »
//    (retourPretLe) — chauffeur et équipe sont prévenus par l'appelant.
import { prisma } from "@/lib/prisma";
import { cleTel } from "@/lib/telephones";
import { positionValide, distanceKm } from "@/lib/geoloc";

const STATUTS_FINAUX = ["TERMINEE", "ANNULEE", "ABSENT"];

// Enregistre la position du chauffeur sur SA mission (la propriété de la
// mission est déjà vérifiée par la route employé). Uniquement pendant le
// trajet d'un transport : après « je suis en route », avant la clôture.
export async function enregistrerPosition(demande, lat, lng) {
  if (!demande) return { erreur: "introuvable" };
  if (!positionValide(lat, lng)) return { erreur: "position_invalide" };
  if (demande.service !== "transport") return { erreur: "hors_transport" };
  if (!demande.enRouteLe) return { erreur: "pas_en_route" };
  if (demande.finLe || STATUTS_FINAUX.includes(demande.statut)) return { erreur: "mission_close" };

  // DISTANCE RÉELLE parcourue : somme des segments entre positions
  // successives. Un saut invraisemblable (> 5 km entre deux envois ≈ 20 s,
  // perte de GPS) n'est pas compté — jamais de kilomètres fantômes.
  const data = { posLat: Number(lat), posLng: Number(lng), posLe: new Date() };
  if (demande.posLat != null && demande.posLng != null) {
    const segment = distanceKm(demande.posLat, demande.posLng, Number(lat), Number(lng));
    if (segment > 0.01 && segment < 5) {
      data.distanceReelleKm = Math.round(((demande.distanceReelleKm || 0) + segment) * 100) / 100;
    }
  }
  await prisma.demande.update({ where: { id: demande.id }, data });
  return { ok: true };
}

// ---- Modification de la destination PAR LE PATIENT (recalcul + accord) ----
// La nouvelle destination est géocodée/routée CÔTÉ SERVEUR : nouveau
// kilométrage, nouvelle durée, nouveau prix estimé — le patient confirme
// en connaissance de cause (`confirmer: true`), tout est journalisé.
export async function modifierDestination(demandeId, { userId, telephone, destination, lat, lng, confirmer } = {}) {
  const id = Number(demandeId);
  const cle = cleTel(telephone);
  const d = await prisma.demande.findUnique({ where: { id } });
  const proprietaire = d && ((cle && cleTel(d.telephone) === cle) || (d.parEtabUserId && d.parEtabUserId === userId));
  if (!proprietaire) return { erreur: "introuvable" };
  if (d.service !== "transport") return { erreur: "hors_transport" };
  if (d.finLe || STATUTS_FINAUX.includes(d.statut)) return { erreur: "mission_close" };
  const texte = String(destination || "").trim().slice(0, 160);
  if (texte.length < 3) return { erreur: "destination_invalide" };

  // Recalcul serveur (itinéraire + prix) quand les coordonnées sont là.
  let geo = null;
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && d.departLat != null) {
    try {
      const { calculerItineraire } = await import("@/lib/googleMaps");
      const route = await calculerItineraire({ deLat: d.departLat, deLng: d.departLng, aLat: Number(lat), aLng: Number(lng) });
      if (route) {
        const { estimerPrestation } = await import("@/lib/finances");
        const est = await estimerPrestation({
          service: d.service, date: d.date, dureeMin: d.dureeMin, typeTrajet: d.typeTrajet,
          prioritaire: d.prioritaire, packId: d.packId, distanceKm: route.km, details: d.details,
        });
        geo = { route, prixEstime: est?.total ?? null };
      }
    } catch {}
  }

  // Aperçu SANS engagement : le patient voit le nouveau tarif avant d'accepter.
  if (!confirmer) {
    return { apercu: true, destination: texte, itineraire: geo?.route || null, prixEstime: geo?.prixEstime ?? null, ancienPrix: d.prixEstime ?? null };
  }

  const maj = await prisma.demande.update({
    where: { id },
    data: {
      destination: texte,
      ...(Number.isFinite(Number(lat)) ? { destLat: Number(lat), destLng: Number(lng) } : {}),
      ...(geo?.route
        ? { distanceKm: geo.route.km, dureeRouteMin: geo.route.minutes, itineraire: geo.route.polyline, prixEstime: geo.prixEstime }
        : {}),
    },
    include: { transporteur: { select: { nom: true, userId: true } } },
  });
  await prisma.journal.create({
    data: {
      auteur: d.nom || "patient", action: "demande.destination_modifiee", entite: "demande", entiteId: String(id),
      detail: `« ${d.destination || "?"} » → « ${texte} »${geo?.route ? ` · ${geo.route.km} km · nouveau prix estimé ${geo.prixEstime ?? "?"} DZD` : ""}`,
    },
  });
  return { ok: true, demande: maj };
}

// « Je suis prêt » : le patient (identifié par son téléphone) déclenche le
// retour de SON transport en cours. Idempotent — un second appui ne change
// rien et ne renvoie pas d'erreur.
export async function marquerRetourPret(demandeId, telephone) {
  const id = Number(demandeId);
  const cle = cleTel(telephone);
  if (!id || cle.length < 6) return { erreur: "introuvable" };
  const d = await prisma.demande.findUnique({
    where: { id },
    include: { transporteur: { select: { id: true, nom: true, userId: true } } },
  });
  if (!d || cleTel(d.telephone) !== cle) return { erreur: "introuvable" };
  if (d.service !== "transport") return { erreur: "hors_transport" };
  if (STATUTS_FINAUX.includes(d.statut)) return { erreur: "mission_close" };
  if (d.retourPretLe) return { deja: true, demande: d };
  const maj = await prisma.demande.update({
    where: { id },
    data: { retourPretLe: new Date() },
    include: { transporteur: { select: { id: true, nom: true, userId: true } } },
  });
  return { ok: true, demande: maj };
}
