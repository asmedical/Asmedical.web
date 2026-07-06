// ─────────────────────────────────────────────────────────────────────────
// Abstraction d'envoi SMS — point d'entrée UNIQUE du reste de l'application.
//
// Le reste du code n'importe QUE ce fichier et n'utilise QUE :
//     sendSms(phone, message)
//     sendOtp(phone, code)
//
// Le fournisseur réel est choisi par la variable d'environnement SMS_PROVIDER
// (twilio | sms_partner | infobip | mock). Changer d'opérateur = changer cette
// seule variable, sans toucher au moindre autre fichier.
//
// ⚠️ Sécurité : ce module ne s'exécute QUE côté serveur. Toutes les clés sont
// lues via process.env sans préfixe NEXT_PUBLIC_, donc jamais envoyées au
// navigateur. Ne jamais importer ce fichier depuis un composant client.
// ─────────────────────────────────────────────────────────────────────────
import { envoyerTwilio } from "./twilio";
import { envoyerSmsPartner } from "./smspartner";
import { envoyerInfobip } from "./infobip";
import { envoyerMock } from "./mock";

const FOURNISSEURS = {
  twilio: envoyerTwilio,
  sms_partner: envoyerSmsPartner,
  infobip: envoyerInfobip,
  mock: envoyerMock,
};

// Renvoie le fournisseur actif ({ nom, envoyer }). Défaut : mock (aucun envoi
// réel), pour ne jamais échouer ni facturer si la variable est absente.
export function fournisseurActuel() {
  const nom = (process.env.SMS_PROVIDER || "mock").toLowerCase();
  const envoyer = FOURNISSEURS[nom] || FOURNISSEURS.mock;
  return { nom: FOURNISSEURS[nom] ? nom : "mock", envoyer };
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
  const { nom, envoyer } = fournisseurActuel();
  try {
    const res = await envoyer(phone, message);
    return { fournisseur: nom, ...res };
  } catch (e) {
    console.error(`[SMS ${nom}] échec vers ${masquerTel(phone)} : ${e.message}`);
    throw e;
  }
}

// Envoi d'un code de connexion (OTP). C'est Supabase qui GÉNÈRE et VÉRIFIE le
// code ; notre rôle se limite à l'acheminer par SMS via le fournisseur actif.
export async function sendOtp(phone, code) {
  return sendSms(phone, messageOtp(code));
}
