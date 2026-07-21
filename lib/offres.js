// Offre commerciale — packs forfaitaires, codes promo et parrainage.
// TOUT est validé et consommé côté serveur : un code ne se « dépense »
// qu'à la facturation réelle, une seule fois par client.
import { prisma } from "@/lib/prisma";
import { cleTel } from "@/lib/telephones";

const auj = () => new Date().toISOString().slice(0, 10);
export const RECOMPENSE_PARRAIN = 300; // DZD offerts au parrain par filleul

// ---- Packs ----
export function packsActifs(service) {
  return prisma.pack.findMany({
    where: { actif: true, ...(service ? { service } : {}) },
    orderBy: [{ ordre: "asc" }, { prix: "asc" }],
  });
}

// ---- Codes promo / parrainage ----

// Valide un code SANS le consommer : état, dates, quota, service, et
// une seule utilisation par client (téléphone). Un parrain ne peut pas
// utiliser son propre code.
export async function validerCode(code, { service, telephone, userId } = {}) {
  const propre = String(code || "").trim().toUpperCase();
  if (!propre) return { erreur: "code_invalide" };
  const c = await prisma.codePromo.findUnique({ where: { code: propre } });
  if (!c || !c.actif) return { erreur: "code_invalide" };
  const jour = auj();
  if (c.debut > jour) return { erreur: "code_pas_encore" };
  if (c.fin && c.fin < jour) return { erreur: "code_expire" };
  if (c.maxUsages && c.usages >= c.maxUsages) return { erreur: "code_epuise" };
  if (c.service && service && c.service !== service) return { erreur: "code_service" };
  if (c.parrainUserId && userId && c.parrainUserId === userId) return { erreur: "code_proprietaire" };
  const tel = cleTel(telephone);
  if (tel) {
    const deja = await prisma.codePromoUsage.findFirst({ where: { codeId: c.id, telCle: tel } });
    if (deja) return { erreur: "code_deja_utilise" };
  }
  return { ok: true, code: c };
}

// Remise d'un code sur un sous-total (jamais négatif, plafond respecté).
// Types : pourcentage | fixe | gratuit (prestation offerte — un « trajet
// offert » ou une « livraison offerte » est un code gratuit limité au
// service concerné via le champ `service`).
export function remiseDuCode(codePromo, sousTotal) {
  let m = codePromo.type === "gratuit"
    ? sousTotal
    : codePromo.type === "pourcentage"
    ? Math.round((sousTotal * codePromo.valeur) / 100)
    : codePromo.valeur;
  if (codePromo.plafond) m = Math.min(m, codePromo.plafond);
  return Math.max(0, Math.min(m, sousTotal));
}

// Consomme un code à la FACTURATION (transactionnel) : usage compté, une
// fois par client, et récompense du parrain (RemiseClient plafonnée) si
// c'est un code de parrainage. Idempotent par (code, client).
export async function consommerCode(codePromo, { telephone, demandeId }) {
  const tel = cleTel(telephone);
  if (!tel) return { erreur: "telephone_manquant" };
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.codePromoUsage.create({
        data: { codeId: codePromo.id, telCle: tel, demandeId: demandeId || null },
      });
      await tx.codePromo.update({ where: { id: codePromo.id }, data: { usages: { increment: 1 } } });

      // Parrainage : le parrain gagne une remise fixe sur sa prochaine facture.
      if (codePromo.parrainUserId) {
        const compte = await tx.compteFinancier.findUnique({ where: { userId: codePromo.parrainUserId } });
        if (compte) {
          await tx.remiseClient.create({
            data: {
              compteId: compte.id, type: "fixe", valeur: RECOMPENSE_PARRAIN,
              motif: `Parrainage — merci ! (code ${codePromo.code})`,
              debut: auj(), fin: null, plafond: null, auteur: "Parrainage automatique",
            },
          });
        }
      }
      return { ok: true };
    });
  } catch (e) {
    // Contrainte unique (codeId, telCle) : déjà consommé par ce client.
    if (String(e.code) === "P2002") return { deja: true };
    throw e;
  }
}

// Code de parrainage personnel d'un compte (créé au premier besoin).
export async function codeParrainageDe(userId, nom) {
  const existant = await prisma.codePromo.findFirst({ where: { parrainUserId: userId, actif: true } });
  if (existant) return existant;
  let code;
  for (let i = 0; i < 5; i++) {
    code = "ASM" + Math.random().toString(36).slice(2, 7).toUpperCase();
    const pris = await prisma.codePromo.findUnique({ where: { code } });
    if (!pris) break;
  }
  return prisma.codePromo.create({
    data: {
      code, type: "pourcentage", valeur: 10, plafond: 1000,
      debut: auj(), parrainUserId: userId, actif: true,
      creePar: `Parrainage — ${String(nom || "client").slice(0, 60)}`,
    },
  });
}

// ---- Devis ----
export async function creerDevis({ nom, telephone, email, service, besoin }) {
  if (!String(nom || "").trim() || cleTel(telephone).length < 8) return { erreur: "coordonnees" };
  if (String(besoin || "").trim().length < 10) return { erreur: "besoin_trop_court" };
  const { prochainNumero } = await import("@/lib/finances");
  const devis = await prisma.$transaction(async (tx) => {
    const numero = await prochainNumero(tx, "devis", "ASM-DV-");
    return tx.devis.create({
      data: {
        numero,
        nom: String(nom).trim().slice(0, 120),
        telephone: String(telephone).trim().slice(0, 20),
        email: email ? String(email).trim().slice(0, 160) : null,
        service: ["transport", "domicile", "medicaments"].includes(service) ? service : null,
        besoin: String(besoin).trim().slice(0, 1500),
      },
    });
  });
  return { ok: true, devis };
}
