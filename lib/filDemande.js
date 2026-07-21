// Fil de discussion PAR DEMANDE — logique centrale (testable sans Supabase).
// Participants autorisés, tous vérifiés côté serveur à chaque appel :
//  - le PATIENT de la demande (téléphone du compte = téléphone de la demande) ;
//  - un PROCHE ou un ÉTABLISSEMENT détenant un rattachement ACCEPTE et non
//    expiré vers ce patient ;
//  - le compte qui a POSÉ la réservation (parEtabUserId) ;
//  - l'équipe ASM (via l'admin, contrôlée par rôle dans la route).
import { prisma } from "@/lib/prisma";
import { cleTel } from "@/lib/telephones";

const MAX_MESSAGES = 200;

function rattachementValide(r) {
  if (r.statut !== "ACCEPTE") return false;
  return !(r.expiration && r.expiration < new Date().toISOString().slice(0, 10));
}

// Qui est cet utilisateur pour CE fil ? { ok, role, nom } ou { erreur }.
export async function accesFil(demandeId, { userId, telephone } = {}) {
  const id = Number(demandeId);
  if (!id || !userId) return { erreur: "introuvable" };
  const demande = await prisma.demande.findUnique({ where: { id } });
  if (!demande) return { erreur: "introuvable" };

  const clePatient = cleTel(demande.telephone);
  if (telephone && clePatient && cleTel(telephone) === clePatient) {
    return { ok: true, role: "patient", demande };
  }
  if (demande.parEtabUserId && demande.parEtabUserId === userId) {
    return { ok: true, role: "reservataire", demande };
  }
  const liens = await prisma.rattachement.findMany({ where: { etabUserId: userId } });
  const lien = liens.find((r) => rattachementValide(r) && cleTel(r.patientTel) === clePatient);
  if (lien) {
    return { ok: true, role: lien.type === "proche" ? "proche" : "etablissement", demande, lien };
  }
  return { erreur: "acces_refuse" };
}

// Messages du fil, du plus ancien au plus récent.
export function messagesFil(demandeId) {
  return prisma.message.findMany({
    where: { demandeId: Number(demandeId) },
    orderBy: { creeLe: "asc" },
    take: MAX_MESSAGES,
    select: { id: true, texte: true, nomAuteur: true, deEquipe: true, creeLe: true, userId: true },
  });
}

// Écrit dans le fil (l'accès doit avoir été vérifié par accesFil).
export async function ecrireFil(demandeId, { userId, nom, texte, deEquipe = false }) {
  const propre = String(texte || "").trim().slice(0, 1000);
  if (!propre) return { erreur: "message_vide" };
  const nb = await prisma.message.count({ where: { demandeId: Number(demandeId) } });
  if (nb >= MAX_MESSAGES) return { erreur: "fil_complet" };
  const message = await prisma.message.create({
    data: {
      demandeId: Number(demandeId),
      userId: String(userId || "equipe"),
      deEquipe,
      nomAuteur: String(nom || (deEquipe ? "Équipe ASM" : "Participant")).slice(0, 80),
      texte: propre,
      // Le fil partagé ne pollue pas les compteurs du chat personnel équipe.
      luParEquipe: !deEquipe ? true : undefined,
      luParPatient: deEquipe ? true : undefined,
    },
  });
  return { ok: true, message };
}

// Prévient les AUTRES participants du fil qu'un message est arrivé
// (notification interne + push) — jamais l'auteur lui-même.
export async function notifierFil(admin, demande, { auteurUserId, nomAuteur, apercu }) {
  try {
    const clePatient = cleTel(demande.telephone);
    const cibles = new Set();
    // Patient (compte retrouvé par téléphone)
    if (clePatient && admin) {
      const { data } = await admin.from("profil").select("id").ilike("telephone", `%${clePatient}%`).limit(1);
      if (data?.[0]?.id) cibles.add(data[0].id);
    }
    // Réservataire + rattachés actifs vers ce patient
    if (demande.parEtabUserId) cibles.add(demande.parEtabUserId);
    const liens = await prisma.rattachement.findMany({ where: { statut: "ACCEPTE" } });
    for (const r of liens) {
      if (rattachementValide(r) && cleTel(r.patientTel) === clePatient && r.etabUserId) cibles.add(r.etabUserId);
    }
    cibles.delete(auteurUserId);
    for (const userId of cibles) {
      await prisma.notification.create({
        data: {
          userId, type: "message",
          titre: `💬 ${nomAuteur} — demande n°${demande.id}`,
          corps: String(apercu || "").slice(0, 120),
          auteur: nomAuteur, statut: "NON_LU", lienType: "demande", lienId: String(demande.id),
        },
      });
      try {
        const { envoyerPush } = await import("@/lib/pushEnvoi");
        await envoyerPush(userId, {
          titre: `💬 ${nomAuteur}`,
          corps: String(apercu || "").slice(0, 120),
          url: `/suivi?id=${demande.id}`,
        });
      } catch {}
    }
  } catch {}
}
