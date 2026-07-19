// Moteur central de disponibilités par RESSOURCES (auxiliaires de santé,
// chauffeurs/véhicules). Un créneau n'est proposé que si au moins une
// ressource éligible peut réellement le prendre :
//  - statut VALIDE et non absente ;
//  - travaille ce jour-là (jours de repos, congés) et à cette heure ;
//  - couvre la commune du patient (si connue) ;
//  - n'a aucune intervention qui chevauche (durée + tampon + trajet) ;
// Les demandes non encore affectées consomment aussi la capacité.
//
// Repli honnête : si AUCUNE ressource n'est configurée pour un service
// (phase de lancement), on retombe sur la capacité globale des réglages
// pour ne pas bloquer les réservations — signalé par mode: "capacite".
import { prisma } from "@/lib/prisma";
import { getReglage, heuresDuJour, capacitePour } from "@/lib/creneaux";
import { tempsTrajetMin, zoneCouvre } from "@/lib/trajets";

const STATUTS_BLOQUANTS = ["A_RAPPELER", "CONFIRMEE", "AFFECTEE", "EN_COURS", "TERMINEE", "ABSENT"];

// "AAAA-MM-JJTHH:MM" → minutes depuis minuit (ou null).
function minutesDe(iso) {
  const m = /T(\d{2}):(\d{2})/.exec(String(iso || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
// 0 = lundi … 6 = dimanche (convention joursOff existante).
function jourSemaine(jour) {
  return (new Date(jour + "T12:00:00Z").getUTCDay() + 6) % 7;
}
function enConge(conges, jour) {
  return String(conges || "").split(",").map((s) => s.trim()).includes(jour);
}
function jourOff(joursOff, jour) {
  return String(joursOff || "").split(",").map((s) => s.trim()).includes(String(jourSemaine(jour)));
}
// Le type de véhicule couvre-t-il le besoin ? (médicalisé > accompagné > simple)
function vehiculeCompatible(typeVehicule, typeDemande) {
  if (!typeDemande || typeDemande === "simple") return true;
  if (typeDemande === "accompagne") return ["accompagne", "medicalise"].includes(typeVehicule);
  return typeVehicule === "medicalise"; // medicalise
}

// Ressources éligibles pour un jour/commune (avant regard sur le planning).
// Renvoie { pool, brut } : brut = nb de ressources actives AVANT filtres,
// pour distinguer « personne ne couvre ce créneau » (pool vide, brut > 0)
// de « aucune ressource configurée » (brut = 0 → repli capacité globale).
export async function ressourcesEligibles(service, jour, { commune, typeTrajet } = {}) {
  if (service === "domicile") {
    const tous = await prisma.soignant.findMany({ where: { statut: "VALIDE", dispo: { not: "ABSENT" } } });
    const pool = tous.filter((s) => !jourOff(s.joursOff, jour) && !enConge(s.conges, jour) && zoneCouvre(s.communes, commune));
    return { pool, brut: tous.length };
  }
  // transport (le Transporteur = couple chauffeur + véhicule chez ASM)
  const tous = await prisma.transporteur.findMany({ where: { statut: "VALIDE", dispo: { not: "ABSENT" } } });
  const pool = tous.filter(
    (t) => !jourOff(t.joursOff, jour) && !enConge(t.conges, jour) && zoneCouvre(t.zone, commune) && vehiculeCompatible(t.typeTransport, typeTrajet)
  );
  return { pool, brut: tous.length };
}

// Planning du jour : intervalles occupés (minutes) par intervenant,
// incluant durée + tampon + trajet estimé vers l'intervention suivante.
async function occupations(champ, ids, jour, reglage) {
  if (!ids.length) return new Map();
  const demandes = await prisma.demande.findMany({
    where: { [champ]: { in: ids }, date: { startsWith: jour }, statut: { in: STATUTS_BLOQUANTS } },
    select: { [champ]: true, date: true, dureeMin: true, commune: true },
  });
  const map = new Map();
  for (const d of demandes) {
    const debut = minutesDe(d.date);
    if (debut === null) continue;
    const fin = debut + (d.dureeMin || 60) + reglage.tamponMin + tempsTrajetMin(d.commune, null, reglage);
    const id = d[champ];
    if (!map.has(id)) map.set(id, []);
    map.get(id).push([debut, fin]);
  }
  return map;
}

function libre(intervales, debut, fin) {
  return !(intervales || []).some(([a, b]) => debut < b && a < fin);
}

// Capacité réelle d'un créneau : nombre de ressources éligibles ET libres.
export async function capaciteCreneau(service, iso, { duree = 60, commune, typeTrajet } = {}) {
  const jour = String(iso).slice(0, 10);
  const reglage = await getReglage();
  const { pool, brut } = await ressourcesEligibles(service, jour, { commune, typeTrajet });
  if (brut === 0) return { capacite: capacitePour(reglage, service), mode: "capacite", reglage };
  if (pool.length === 0) return { capacite: 0, libres: [], mode: "ressources", reglage };

  const champ = service === "domicile" ? "soignantId" : "transporteurId";
  const occ = await occupations(champ, pool.map((r) => r.id), jour, reglage);
  const debut = minutesDe(iso);
  const fin = debut + duree + reglage.tamponMin;
  const libres = pool.filter(
    (r) => debut >= r.heureDebut * 60 && debut + duree <= r.heureFin * 60 && libre(occ.get(r.id), debut, fin)
  );
  return { capacite: libres.length, libres, mode: "ressources", reglage };
}

// Créneaux d'un jour pour le patient (domicile / transport ponctuel).
export async function creneauxParRessources(service, jour, { duree = 60, commune, typeTrajet } = {}) {
  const reglage = await getReglage();
  const { pool, brut } = await ressourcesEligibles(service, jour, { commune, typeTrajet });
  const heures = heuresDuJour(reglage);
  const maintenant = Date.now();

  // Demandes du jour non affectées : elles consomment la capacité du pool.
  const nonAffectees = await prisma.demande.findMany({
    where: {
      service,
      date: { startsWith: jour },
      statut: { in: STATUTS_BLOQUANTS },
      ...(service === "domicile" ? { soignantId: null } : { transporteurId: null }),
    },
    select: { date: true },
  });
  const prisSans = {};
  for (const d of nonAffectees) {
    const h = (d.date.split("T")[1] || "").slice(0, 5);
    prisSans[h] = (prisSans[h] || 0) + 1;
  }

  // Repli capacité globale UNIQUEMENT si aucune ressource n'est configurée
  // pour ce service (phase de lancement). Si des ressources existent mais
  // qu'aucune n'est éligible (zone, congés…), les créneaux sont fermés.
  if (brut === 0) {
    const capacite = capacitePour(reglage, service);
    const prisTous = await prisma.demande.findMany({
      where: { service, date: { startsWith: jour }, statut: { in: STATUTS_BLOQUANTS } },
      select: { date: true },
    });
    const compte = {};
    for (const d of prisTous) {
      const h = (d.date.split("T")[1] || "").slice(0, 5);
      compte[h] = (compte[h] || 0) + 1;
    }
    return {
      mode: "capacite",
      creneaux: heures.map((h) => ({
        heure: h,
        iso: `${jour}T${h}`,
        dispo: (compte[h] || 0) < capacite && new Date(`${jour}T${h}`).getTime() > maintenant,
      })),
    };
  }

  const champ = service === "domicile" ? "soignantId" : "transporteurId";
  const occ = await occupations(champ, pool.map((r) => r.id), jour, reglage);

  const creneaux = heures.map((h) => {
    const iso = `${jour}T${h}`;
    const debut = minutesDe(iso);
    const fin = debut + duree + reglage.tamponMin;
    const libres = pool.filter(
      (r) => debut >= r.heureDebut * 60 && debut + duree <= r.heureFin * 60 && libre(occ.get(r.id), debut, fin)
    ).length;
    const restant = libres - (prisSans[h] || 0);
    return { heure: h, iso, dispo: restant > 0 && new Date(iso).getTime() > maintenant, restant: Math.max(0, restant) };
  });
  return { mode: "ressources", creneaux };
}

// Fenêtres de livraison du jour, avec capacité restante.
export const FENETRES_LIVRAISON = [
  { id: "asap", fr: "au plus tôt" },
  { id: "matin", fr: "matin (8h–12h)" },
  { id: "midi", fr: "midi (12h–15h)" },
  { id: "soir", fr: "après-midi (15h–19h)" },
];
export async function fenetresLivraison(jour) {
  const reglage = await getReglage();
  const demandes = await prisma.demande.findMany({
    where: { service: "medicaments", date: { startsWith: jour }, statut: { not: "ANNULEE" } },
    select: { fenetre: true },
  });
  const compte = {};
  for (const d of demandes) compte[d.fenetre || ""] = (compte[d.fenetre || ""] || 0) + 1;
  return FENETRES_LIVRAISON.map((f) => {
    const pris = compte[f.fr] || 0;
    const restant = Math.max(0, reglage.capaciteFenetre - pris);
    return { ...f, restant, complet: restant <= 0, presqueComplet: restant > 0 && restant <= 2 };
  });
}

// Choisit l'intervenant le moins chargé du jour parmi les libres (affectation auto).
export async function choisirIntervenant(service, iso, opts = {}) {
  const res = await capaciteCreneau(service, iso, opts);
  if (res.mode !== "ressources" || !res.libres?.length) return null;
  const jour = String(iso).slice(0, 10);
  const champ = service === "domicile" ? "soignantId" : "transporteurId";
  const charges = await prisma.demande.groupBy({
    by: [champ],
    where: { [champ]: { in: res.libres.map((r) => r.id) }, date: { startsWith: jour }, statut: { in: STATUTS_BLOQUANTS } },
    _count: true,
  });
  const charge = Object.fromEntries(charges.map((c) => [c[champ], c._count]));
  return [...res.libres].sort((a, b) => (charge[a.id] || 0) - (charge[b.id] || 0))[0];
}

// Contrôle anti double-réservation à l'affectation manuelle (admin).
// Renvoie null si OK, sinon la raison lisible du refus.
export async function conflitAffectation(entite, intervenantId, demande) {
  const jour = String(demande.date || "").slice(0, 10);
  const debut = minutesDe(demande.date);
  if (!jour || debut === null) return null; // date libre (ex. « au plus tôt ») : pas de contrôle horaire
  const reglage = await getReglage();
  const modele = entite === "soignant" ? prisma.soignant : prisma.transporteur;
  const iv = await modele.findUnique({ where: { id: Number(intervenantId) } });
  if (!iv) return "Intervenant introuvable.";
  if (iv.statut !== "VALIDE") return "Ce profil n'est pas validé.";
  if (enConge(iv.conges, jour)) return "En congé ce jour-là.";
  if (jourOff(iv.joursOff, jour)) return "Jour de repos de cet intervenant.";
  const duree = demande.dureeMin || 60;
  if (debut < iv.heureDebut * 60 || debut + duree > iv.heureFin * 60) {
    return `Hors horaires (${iv.heureDebut}h – ${iv.heureFin}h).`;
  }
  const champ = entite === "soignant" ? "soignantId" : "transporteurId";
  const occ = await occupations(champ, [iv.id], jour, reglage);
  const fin = debut + duree + reglage.tamponMin;
  const propres = (occ.get(iv.id) || []);
  // Exclut la demande elle-même (ré-affectation sur le même créneau).
  const autres = await prisma.demande.findMany({
    where: { [champ]: iv.id, date: { startsWith: jour }, statut: { in: STATUTS_BLOQUANTS }, id: { not: demande.id } },
    select: { date: true, dureeMin: true, commune: true },
  });
  for (const d of autres) {
    const a = minutesDe(d.date);
    if (a === null) continue;
    const b = a + (d.dureeMin || 60) + reglage.tamponMin + tempsTrajetMin(d.commune, demande.commune, reglage);
    if (debut < b && a < fin) {
      return `Déjà occupé(e) à ${d.date.split("T")[1]} (chevauchement, trajet compris).`;
    }
  }
  void propres;
  return null;
}
