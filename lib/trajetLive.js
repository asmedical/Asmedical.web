// Trajet en temps réel — logique centrale (testable sans Supabase).
//  - Le CHAUFFEUR partage sa position pendant qu'il est en route : elle est
//    stockée sur la demande (posLat/posLng/posLe) et lue par le suivi patient.
//  - Le PATIENT peut déclencher le retour d'un transport : « Je suis prêt »
//    (retourPretLe) — chauffeur et équipe sont prévenus par l'appelant.
import { prisma } from "@/lib/prisma";
import { cleTel } from "@/lib/telephones";
import { positionValide } from "@/lib/geoloc";

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
  await prisma.demande.update({
    where: { id: demande.id },
    data: { posLat: Number(lat), posLng: Number(lng), posLe: new Date() },
  });
  return { ok: true };
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
