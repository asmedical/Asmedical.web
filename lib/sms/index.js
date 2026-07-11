// ─────────────────────────────────────────────────────────────────────────
// Abstraction d'envoi SMS — point d'entrée UNIQUE du reste de l'application.
//
// Le reste du code n'importe QUE ce fichier et n'utilise QUE :
//     sendSms(phone, message)
//     sendOtp(phone, code)
//
// ROUTAGE AUTOMATIQUE par numéro :
//   • numéro algérien (+213…) → Elite SMS (sms-algerie.com), national, moins cher
//   • tout autre numéro        → Twilio, international
// On peut forcer un fournisseur unique via SMS_PROVIDER (utile pour les tests :
// "mock" n'envoie rien, "twilio" force Twilio partout, etc.).
//
// ⚠️ Sécurité : ce module ne s'exécute QUE côté serveur. Toutes les clés sont
// lues via process.env sans préfixe NEXT_PUBLIC_, donc jamais envoyées au
// navigateur. Ne jamais importer ce fichier depuis un composant client.
// ─────────────────────────────────────────────────────────────────────────
import { envoyerTwilio } from "./twilio";
import { envoyerElite } from "./elitesms";
import { envoyerSmsPartner } from "./smspartner";
import { envoyerInfobip } from "./infobip";
import { envoyerMock } from "./mock";

const FOURNISSEURS = {
  twilio: envoyerTwilio,
  elite_sms: envoyerElite,
  sms_partner: envoyerSmsPartner,
  infobip: envoyerInfobip,
  mock: envoyerMock,
};

// Numéro algérien ? (indicatif 213, avec ou sans +, ou format local 0X)
export function estAlgerien(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("213")) return true;
  if (d.startsWith("0") && /^0(5|6|7)/.test(d)) return true; // format local
  return false;
}

// Choisit le fournisseur pour un numéro donné.
// Priorité : SMS_PROVIDER (forçage explicite) > routage auto > repli.
export function choisirFournisseur(phone) {
  const force = (process.env.SMS_PROVIDER || "").toLowerCase();
  if (force && FOURNISSEURS[force]) return { nom: force, envoyer: FOURNISSEURS[force] };

  if (estAlgerien(phone) && process.env.ELITESMS_API_KEY && process.env.ELITESMS_USER_KEY) {
    return { nom: "elite_sms", envoyer: envoyerElite };
  }
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return { nom: "twilio", envoyer: envoyerTwilio };
  }
  // Aucun fournisseur configuré → mock (aucun envoi réel, pas d'échec bloquant).
  return { nom: "mock", envoyer: envoyerMock };
}

// Message standard du code de connexion (OTP).
export function messageOtp(code) {
  return `ASM : votre code de connexion est ${code}. Il expire dans 5 minutes.`;
}

// Masque un numéro dans les journaux : +213550123456 → +2135****3456.
function masquerTel(phone) {
  const s = String(phone || "");
  if (s.length <= 8) return "***";
  return s.slice(0, 5) + "****" + s.slice(-4);
}

// Envoi générique d'un SMS. Lève une erreur en cas d'échec (le hook Supabase
// doit savoir que l'envoi a échoué pour renvoyer un code d'erreur). Journalise
// l'échec sans jamais afficher le contenu du message ni le numéro complet.
export async function sendSms(phone, message) {
  const { nom, envoyer } = choisirFournisseur(phone);
  try {
    const res = await envoyer(phone, message);
    console.log(`[SMS ${nom}] envoyé vers ${masquerTel(phone)}`);
    return { fournisseur: nom, ...res };
  } catch (e) {
    console.error(`[SMS ${nom}] échec vers ${masquerTel(phone)} : ${e.message}`);
    throw e;
  }
}

// Canal préféré de l'utilisateur (choisi sur l'écran de connexion juste
// avant la demande de code). En cas de doute ou d'erreur : SMS.
async function canalPrefere(phone) {
  try {
    const { prisma } = await import("../prisma");
    const pref = await prisma.otpCanal.findUnique({ where: { telephone: String(phone) } });
    if (!pref) return "sms";
    // Préférence récente uniquement (10 min) : pas d'effet surprise plus tard.
    if (Date.now() - new Date(pref.majLe).getTime() > 10 * 60 * 1000) return "sms";
    return pref.canal === "whatsapp" ? "whatsapp" : "sms";
  } catch {
    return "sms";
  }
}

// Envoi d'un code de connexion (OTP). C'est Supabase qui GÉNÈRE et VÉRIFIE le
// code ; notre rôle se limite à l'acheminer — par WhatsApp si l'utilisateur
// l'a demandé (et que WhatsApp est configuré), sinon par SMS. En cas d'échec
// WhatsApp, on retombe automatiquement sur le SMS.
export async function sendOtp(phone, code) {
  const { whatsappConfigure, envoyerWhatsAppOtp } = await import("./whatsapp");
  if (whatsappConfigure() && (await canalPrefere(phone)) === "whatsapp") {
    try {
      const res = await envoyerWhatsAppOtp(phone, code);
      console.log(`[OTP whatsapp] envoyé vers ${masquerTel(phone)}`);
      return { fournisseur: "whatsapp", ...res };
    } catch (e) {
      console.error(`[OTP whatsapp] échec vers ${masquerTel(phone)} : ${e.message} — repli SMS`);
    }
  }
  return sendSms(phone, messageOtp(code));
}
