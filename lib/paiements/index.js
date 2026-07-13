// ─────────────────────────────────────────────────────────────────────────
// Couche FOURNISSEURS DE PAIEMENT — indépendante du prestataire.
// Interface commune : creerPaiement, verifierWebhook. Seuls les
// fournisseurs réellement configurés (variables d'environnement serveur)
// sont proposés. AUCUNE clé côté navigateur, AUCUNE transaction simulée.
//
//  - especes  : interne (tickets sécurisés, encaissement par le staff)
//  - virement : interne (référence obligatoire, validation manuelle)
//  - chargily : passerelle algérienne CIB + EDAHABIA (si CHARGILY_SECRET_KEY)
//  - satim    : emplacement prévu — nécessite l'agrément SATIM/BNA (non intégré)
//  - paypal   : emplacement prévu — désactivé tant que le compte marchand
//               ASM n'est pas autorisé (ne jamais afficher sans cela)
// ─────────────────────────────────────────────────────────────────────────
import crypto from "crypto";

const CHARGILY_CLE = process.env.CHARGILY_SECRET_KEY || "";
const CHARGILY_BASE = process.env.CHARGILY_MODE === "production"
  ? "https://pay.chargily.net/api/v2"
  : "https://pay.chargily.net/test/api/v2";

// Moyens de paiement réellement proposables aujourd'hui.
export function moyensDisponibles() {
  const m = [{ id: "especes", libelle: "Espèces (ticket de paiement)" }];
  if (CHARGILY_CLE) {
    m.push({ id: "edahabia", libelle: "Carte EDAHABIA" });
    m.push({ id: "cib", libelle: "Carte CIB" });
  }
  if (process.env.VIREMENT_ACTIF === "1") m.push({ id: "virement", libelle: "Virement / dépôt bancaire" });
  return m;
}

// ---- Chargily Pay (CIB / EDAHABIA) ----
// Crée un paiement hébergé chez le fournisseur ; le client y saisit sa
// carte (jamais chez ASM). La confirmation ne vient QUE du webhook signé.
export async function creerPaiementEnLigne({ moyen, montant, devise, description, referenceInterne, urlRetour }) {
  if (!CHARGILY_CLE) throw new Error("fournisseur non configuré");
  const r = await fetch(`${CHARGILY_BASE}/checkouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CHARGILY_CLE}` },
    body: JSON.stringify({
      amount: montant,
      currency: (devise || "dzd").toLowerCase(),
      payment_method: moyen, // "cib" | "edahabia"
      description: String(description || "").slice(0, 180),
      success_url: urlRetour,
      failure_url: urlRetour,
      metadata: { referenceInterne },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d?.checkout_url) {
    throw new Error("création du paiement refusée par le fournisseur" + (d?.message ? ` : ${d.message}` : ""));
  }
  return { idFournisseur: d.id, url: d.checkout_url, fournisseur: "chargily" };
}

// Vérifie la signature d'un webhook Chargily (HMAC-SHA256 du corps brut).
export function verifierWebhookChargily(corpsBrut, signature) {
  if (!CHARGILY_CLE || !signature) return false;
  const attendue = crypto.createHmac("sha256", CHARGILY_CLE).update(corpsBrut).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(attendue));
  } catch {
    return false;
  }
}

// Informations de virement (affichées uniquement si configurées).
export function infosVirement() {
  if (process.env.VIREMENT_ACTIF !== "1") return null;
  return {
    banque: process.env.VIREMENT_BANQUE || "",
    titulaire: process.env.VIREMENT_TITULAIRE || "",
    rib: process.env.VIREMENT_RIB || "",
    consigne: "Indiquez OBLIGATOIREMENT votre référence de paiement sur le virement.",
  };
}
