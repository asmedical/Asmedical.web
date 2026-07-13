// Adaptateur Elite SMS (SOFTART / sms-algerie.com) — SMS nationaux algériens.
// Implémente l'API HTTP(S) v2.1.0 :
//   POST {base}?function=sms_send — corps application/x-www-form-urlencoded
//   Succès : { "status": "success", "result": "<id du message>" }
//   Échec  : { "status": "fail", "result": { "error-id": n, "error-indicator": "…" } }
//
// Variables d'environnement (serveur uniquement) :
//   ELITESMS_API_KEY   — « API Key » du compte
//   ELITESMS_USER_KEY  — « User Key » du compte
//   ELITESMS_BASE_URL  — (option) défaut https://es3.smsalgerie.com/api/json
//
// Contraintes de l'API : numéros 213XXXXXXXXX (sans + ni 00213), 10 requêtes/
// minute, 5 parties max par SMS, réponses UTF-8. Jamais de clé dans les logs.

const ERREURS = {
  100: "authentification échouée",
  101: "clé API invalide",
  102: "clé utilisateur invalide",
  103: "limite de 10 requêtes/minute atteinte — réessayez dans une minute",
  501: "crédit SMS insuffisant — rechargez le compte Elite SMS",
  502: "message trop long (plus de 5 parties SMS)",
};

async function appelElite(fonction, params) {
  const apikey = String(process.env.ELITESMS_API_KEY || "").replace(/\s+/g, "");
  const userkey = String(process.env.ELITESMS_USER_KEY || "").replace(/\s+/g, "");
  const base = process.env.ELITESMS_BASE_URL || "https://es3.smsalgerie.com/api/json";
  if (!apikey || !userkey) throw new Error("Configuration Elite SMS incomplète");

  const corps = new URLSearchParams({ apikey, userkey, ...params });
  const r = await fetch(`${base}?function=${encodeURIComponent(fonction)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: corps.toString(),
  });

  // Réponse brute conservée (tronquée) pour le diagnostic : elle ne contient
  // jamais nos clés, seulement la réponse du fournisseur.
  const texte = await r.text();
  let d = {};
  try { d = JSON.parse(texte); } catch {}
  const brut = texte.slice(0, 300);

  if (d.status === "success") return { resultat: d.result, httpStatus: r.status, brut };

  const res = d.result && typeof d.result === "object" ? d.result : {};
  const codeErreur = Number(res["error-id"]) || null;
  const indicateur = ERREURS[codeErreur] || res["error-indicator"] || brut || `HTTP ${r.status}`;
  const e = new Error(`Elite SMS : ${indicateur}${codeErreur ? ` (erreur ${codeErreur})` : ""}`);
  e.codeElite = codeErreur;
  throw e;
}

// Envoi d'un SMS (function=sms_send). Retourne l'identifiant du message —
// à conserver si l'on veut suivre la livraison via sms_status.
export async function envoyerElite(phone, message) {
  // Normalisation exigée par Elite : 213 suivi du numéro, sans + ni 00.
  let to = String(phone).replace(/\D/g, "");
  if (to.startsWith("00")) to = to.slice(2);
  if (to.startsWith("0")) to = "213" + to.slice(1);
  if (!/^213(5|6|7)\d{8}$/.test(to)) {
    throw new Error("Numéro algérien invalide pour Elite SMS");
  }

  const { resultat, httpStatus, brut } = await appelElite("sms_send", { message, to });
  return { id: typeof resultat === "string" ? resultat : null, httpStatus, brut };
}

// Crédit restant du compte (function=profile_get_credit). Valide aussi
// l'authentification SANS consommer de SMS — utilisé par le diagnostic admin.
export async function creditElite() {
  const { resultat } = await appelElite("profile_get_credit", {});
  return String(resultat);
}
