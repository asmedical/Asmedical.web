// Liste d'attente intelligente — logique centrale (testable sans Supabase).
// Créneau complet → le patient s'inscrit ; dès qu'une annulation ou une
// reprogrammation libère de la place, les premiers inscrits (dans l'ordre
// d'arrivée, autant que de places libérées) sont prévenus automatiquement
// par notification interne + push. Aucune réservation automatique : le
// patient garde la main et réserve normalement.
import { prisma } from "@/lib/prisma";
import { cleTel } from "@/lib/telephones";
import { capaciteCreneau } from "@/lib/disponibilites";

const SERVICES_ATTENTE = ["transport", "domicile"];
const MAX_ATTENTES_ACTIVES = 3; // par client — anti-abus

const maintenantIso = () => new Date().toISOString().slice(0, 16);

// Fait expirer les entrées dont le créneau est passé (nettoyage paresseux).
async function expirerPassees() {
  await prisma.listeAttente.updateMany({
    where: { statut: "EN_ATTENTE", date: { lt: maintenantIso() } },
    data: { statut: "EXPIREE" },
  });
}

// Inscription sur un créneau complet. Une entrée par (créneau, client),
// robuste aux formats de téléphone. Retourne { ok } | { deja } | { erreur }.
export async function rejoindreAttente({ service, date, telephone, nom, commune, typeTrajet, duree } = {}) {
  if (!SERVICES_ATTENTE.includes(service)) return { erreur: "service_invalide" };
  const slot = String(date || "").slice(0, 16);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slot)) return { erreur: "creneau_invalide" };
  if (slot < maintenantIso()) return { erreur: "creneau_passe" };
  const telCle = cleTel(telephone);
  if (telCle.length < 8) return { erreur: "telephone_invalide" };

  await expirerPassees();
  const actives = await prisma.listeAttente.count({ where: { telCle, statut: "EN_ATTENTE" } });
  if (actives >= MAX_ATTENTES_ACTIVES) return { erreur: "trop_attentes" };

  try {
    const entree = await prisma.listeAttente.create({
      data: {
        service,
        date: slot,
        telephone: String(telephone).trim().slice(0, 20),
        telCle,
        nom: nom ? String(nom).trim().slice(0, 80) : null,
        commune: commune ? String(commune).trim().slice(0, 80) : null,
        typeTrajet: typeTrajet ? String(typeTrajet).slice(0, 30) : null,
        duree: Math.min(Math.max(parseInt(duree, 10) || 60, 15), 480),
      },
    });
    return { ok: true, entree };
  } catch (e) {
    if (String(e.code) === "P2002") return { deja: true }; // déjà inscrit sur ce créneau
    throw e;
  }
}

// Appelée quand une place a PU se libérer sur un créneau (annulation ou
// reprogrammation d'une demande). Recalcule la capacité réelle et prévient
// autant d'inscrits que de places libres — dans l'ordre d'arrivée. Un
// inscrit sans compte (pas de notification possible) est laissé en attente.
// `admin` : client Supabase service-role (recherche du compte par téléphone).
export async function traiterLiberation(service, date, { admin } = {}) {
  const slot = String(date || "").slice(0, 16);
  if (!SERVICES_ATTENTE.includes(service) || !slot.includes("T")) return { notifies: 0 };
  await expirerPassees();
  if (slot < maintenantIso()) return { notifies: 0 };

  const attentes = await prisma.listeAttente.findMany({
    where: { service, date: slot, statut: "EN_ATTENTE" },
    orderBy: { creeLe: "asc" },
  });
  if (!attentes.length) return { notifies: 0 };

  // Places réellement libres = capacité du créneau − demandes déjà posées.
  const pris = await prisma.demande.count({
    where: { service, date: slot, statut: { not: "ANNULEE" } },
  });

  let notifies = 0;
  for (const a of attentes) {
    // Capacité recalculée avec le contexte de CET inscrit (commune, type
    // de véhicule) : on ne promet jamais une place qui ne lui irait pas.
    const res = await capaciteCreneau(service, slot, {
      duree: a.duree, commune: a.commune || undefined, typeTrajet: a.typeTrajet || undefined,
    });
    if (res.capacite - pris - notifies <= 0) break;

    const userId = await utilisateurParTel(admin, a.telCle);
    if (!userId) continue; // pas de compte → impossible de le prévenir, on garde sa place

    const quand = slot.replace("T", " à ");
    await prisma.notification.create({
      data: {
        userId, type: "rdv",
        titre: "Une place s'est libérée 🎉",
        corps: `Le créneau du ${quand} que vous attendiez est de nouveau disponible. Réservez vite !`,
        auteur: "ASM", statut: "NON_LU", lienType: "rdv", lienId: slot,
      },
    });
    try {
      const { envoyerPush } = await import("@/lib/pushEnvoi");
      await envoyerPush(userId, {
        titre: "Une place s'est libérée 🎉",
        corps: `Créneau du ${quand} disponible — réservez vite.`,
        url: "/rdv",
      });
    } catch {}
    await prisma.listeAttente.update({ where: { id: a.id }, data: { statut: "NOTIFIE", notifieLe: new Date() } });
    notifies++;
  }
  return { notifies };
}

// Retrouve le compte (profil Supabase) correspondant à une clé téléphone.
async function utilisateurParTel(admin, telCle) {
  if (!admin || !telCle) return null;
  try {
    const { data } = await admin.from("profil").select("id").ilike("telephone", `%${telCle}%`).limit(1);
    return data?.[0]?.id || null;
  } catch {
    return null;
  }
}

// Vue admin : inscriptions à venir (en attente ou déjà prévenues).
export async function attentesAdmin() {
  await expirerPassees();
  return prisma.listeAttente.findMany({
    where: { statut: { in: ["EN_ATTENTE", "NOTIFIE"] }, date: { gte: maintenantIso() } },
    orderBy: [{ date: "asc" }, { creeLe: "asc" }],
    take: 100,
  });
}
