import { prisma } from "@/lib/prisma";

// Capacité (nombre de prises en charge simultanées) selon le service.
export function capacitePour(reglage, service) {
  if (service === "domicile") return reglage.capaciteDomicile;
  if (service === "medicaments") return reglage.capaciteMedicaments;
  return reglage.capaciteTransport; // transport (simple / accompagné / médicalisé)
}

// Récupère les réglages (crée la ligne par défaut si absente).
export async function getReglage() {
  const existant = await prisma.reglage.findUnique({ where: { id: 1 } });
  if (existant) return existant;
  return prisma.reglage.create({ data: { id: 1 } });
}

// Génère les débuts de créneaux d'un jour ("AAAA-MM-JJ") -> ["07:00", "08:00", …]
export function heuresDuJour(reglage) {
  const pas = Math.max(15, reglage.dureeCreneauMin) / 60;
  const heures = [];
  for (let h = reglage.heureDebut; h + pas <= reglage.heureFin + 1e-9; h += pas) {
    const hh = String(Math.floor(h)).padStart(2, "0");
    const mm = String(Math.round((h % 1) * 60)).padStart(2, "0");
    heures.push(`${hh}:${mm}`);
  }
  return heures;
}

// Calcule les créneaux d'un service pour un jour donné, avec leur
// disponibilité (dispo = capacité non atteinte et créneau pas dans le passé).
export async function creneauxDuJour(service, jour) {
  const reglage = await getReglage();
  const capacite = capacitePour(reglage, service);
  const heures = heuresDuJour(reglage);

  // Demandes déjà prises ce jour pour ce service (hors annulées)
  const demandes = await prisma.demande.findMany({
    where: {
      service,
      date: { startsWith: jour },
      statut: { not: "ANNULEE" },
    },
    select: { date: true },
  });
  const compte = {};
  for (const d of demandes) {
    const hhmm = (d.date.split("T")[1] || "").slice(0, 5);
    compte[hhmm] = (compte[hhmm] || 0) + 1;
  }

  const maintenant = Date.now();
  return heures.map((h) => {
    const iso = `${jour}T${h}`;
    const pris = compte[h] || 0;
    const futur = new Date(iso).getTime() > maintenant;
    return { heure: h, iso, dispo: pris < capacite && futur };
  });
}
