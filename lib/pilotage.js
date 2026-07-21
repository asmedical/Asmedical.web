// Pilotage — statistiques réelles pour l'espace pro et l'admin.
// AUCUN chiffre inventé : tout est compté dans la base. Les périmètres
// (quel compte voit quoi) sont recalculés côté serveur.
import { prisma } from "@/lib/prisma";
import { cleTel } from "@/lib/telephones";

// "2026-07" des N derniers mois, du plus ancien au plus récent.
export function derniersMois(n = 12, ref = new Date()) {
  const mois = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - i, 1));
    mois.push(d.toISOString().slice(0, 7));
  }
  return mois;
}

const SERVICES = ["transport", "domicile", "medicaments"];

// ---- Statistiques d'un ÉTABLISSEMENT (ou d'un groupe de sites) ----
// Périmètre = réservations posées PAR ces comptes pro (parEtabUserId).
export async function statsEtablissement(userIds, { nbMois = 6 } = {}) {
  const ids = (userIds || []).filter(Boolean);
  if (!ids.length) return null;
  const mois = derniersMois(nbMois);
  const depuis = mois[0] + "-01";
  const demandes = await prisma.demande.findMany({
    where: { parEtabUserId: { in: ids }, date: { gte: depuis } },
    select: { service: true, statut: true, date: true, telephone: true, parEtabUserId: true },
  });

  const parMois = Object.fromEntries(mois.map((m) => [m, 0]));
  const moisCourant = mois[mois.length - 1];
  const courant = { total: 0, terminees: 0, annulees: 0, parService: { transport: 0, domicile: 0, medicaments: 0 } };
  const patients = new Set();
  const parSite = {};
  for (const d of demandes) {
    const m = String(d.date || "").slice(0, 7);
    if (m in parMois) parMois[m]++;
    if (m === moisCourant) {
      courant.total++;
      if (d.statut === "TERMINEE") courant.terminees++;
      if (d.statut === "ANNULEE") courant.annulees++;
      if (SERVICES.includes(d.service)) courant.parService[d.service]++;
      const cle = cleTel(d.telephone);
      if (cle) patients.add(cle);
      parSite[d.parEtabUserId] = (parSite[d.parEtabUserId] || 0) + 1;
    }
  }
  courant.patients = patients.size;

  // Finances : restant dû des comptes du périmètre (factures ouvertes).
  const comptes = await prisma.compteFinancier.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  let resteDu = 0;
  if (comptes.length) {
    const ouvertes = await prisma.facture.findMany({
      where: { compteId: { in: comptes.map((c) => c.id) }, statut: { in: ["EMISE", "PARTIELLEMENT_PAYEE", "EN_RETARD"] } },
      select: { total: true, paye: true },
    });
    resteDu = ouvertes.reduce((s, f) => s + Math.max(0, f.total - f.paye), 0);
  }

  return {
    mois: mois.map((m) => ({ mois: m, demandes: parMois[m] })),
    moisCourant: courant,
    resteDu,
    parSite, // demandes du mois par compte pro (détail des sites d'un groupe)
  };
}

// ---- Statistiques avancées ADMIN (activité + finances, 12 mois) ----
export async function statsAvancees({ nbMois = 12 } = {}) {
  const mois = derniersMois(nbMois);
  const depuis = mois[0] + "-01";

  const [demandes, factures, paiements, avisAgg] = await Promise.all([
    prisma.demande.findMany({
      where: { date: { gte: depuis } },
      select: { service: true, statut: true, date: true, commune: true },
    }),
    prisma.facture.findMany({
      where: { emissionLe: { gte: depuis }, statut: { not: "ANNULEE" } },
      select: { emissionLe: true, total: true },
    }),
    prisma.paiement.findMany({
      where: { statut: { in: ["CONFIRME", "PARTIELLEMENT_REMBOURSE", "REMBOURSE"] }, confirmeLe: { gte: new Date(depuis + "T00:00:00Z") } },
      select: { confirmeLe: true, montant: true },
    }),
    prisma.avis.aggregate({ _avg: { note: true }, _count: true }),
  ]);

  const vide = () => Object.fromEntries(mois.map((m) => [m, 0]));
  const activite = { transport: vide(), domicile: vide(), medicaments: vide() };
  const facture = vide();
  const encaisse = vide();
  const communes = {};
  let total = 0, annulees = 0, terminees = 0;

  for (const d of demandes) {
    const m = String(d.date || "").slice(0, 7);
    if (!(m in facture)) continue;
    if (SERVICES.includes(d.service)) activite[d.service][m]++;
    total++;
    if (d.statut === "ANNULEE") annulees++;
    if (d.statut === "TERMINEE") terminees++;
    const c = String(d.commune || "").trim();
    if (c && d.statut !== "ANNULEE") communes[c] = (communes[c] || 0) + 1;
  }
  for (const f of factures) {
    const m = String(f.emissionLe).slice(0, 7);
    if (m in facture) facture[m] += f.total;
  }
  for (const p of paiements) {
    const m = p.confirmeLe.toISOString().slice(0, 7);
    if (m in encaisse) encaisse[m] += p.montant;
  }

  return {
    mois: mois.map((m) => ({
      mois: m,
      transport: activite.transport[m],
      domicile: activite.domicile[m],
      medicaments: activite.medicaments[m],
      facture: facture[m],
      encaisse: encaisse[m],
    })),
    topCommunes: Object.entries(communes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([commune, demandes2]) => ({ commune, demandes: demandes2 })),
    totaux: {
      demandes: total,
      terminees,
      annulees,
      tauxAnnulation: total ? Math.round((annulees / total) * 100) : 0,
      noteMoyenne: avisAgg._avg.note ? Math.round(avisAgg._avg.note * 10) / 10 : null,
      nbAvis: avisAgg._count,
    },
  };
}
