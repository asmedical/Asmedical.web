// Adaptateur Elite SMS (smsalgerie.com) — SMS nationaux algériens.
//
// Variables d'environnement (serveur uniquement) :
//   ELITESMS_API_KEY   — « API Key » du compte (page Profil de la console)
//   ELITESMS_USER_KEY  — « User Key » du compte
//   ELITESMS_BASE_URL  — (option) défaut https://es3.smsalgerie.com/api/json
//   SMS_EXPEDITEUR     — (option) nom d'expéditeur si le compte l'autorise
//
// Elite SMS attend le numéro au format « 213XXXXXXXXX » (sans + ni 00).
export async function envoyerElite(phone, message) {
  const apikey = process.env.ELITESMS_API_KEY;
  const userkey = process.env.ELITESMS_USER_KEY;
  const base = process.env.ELITESMS_BASE_URL || "https://es3.smsalgerie.com/api/json";
  if (!apikey || !userkey) throw new Error("Configuration Elite SMS incomplète");

  // Normalisation exigée par Elite : 213 suivi du numéro, sans + ni 00.
  let to = String(phone).replace(/\D/g, "");
  if (to.startsWith("00")) to = to.slice(2);
  if (to.startsWith("0")) to = "213" + to.slice(1);
  if (!/^213(5|6|7)\d{8}$/.test(to)) {
    throw new Error("Numéro algérien invalide pour Elite SMS");
  }

  const corps = {
    apikey,
    userkey,
    function: "sms_send",
    to,
    message,
  };
  const exp = process.env.SMS_EXPEDITEUR;
  if (exp) corps.sender = exp.slice(0, 11);

  const r = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });

  // Réponse BRUTE conservée (tronquée) pour le diagnostic : elle ne contient
  // jamais nos clés, seulement la réponse du fournisseur.
  const texte = await r.text();
  let d = {};
  try { d = JSON.parse(texte); } catch {}
  const brut = texte.slice(0, 300);

  // Elite renvoie généralement un statut « OK » / « KO » + un identifiant.
  const statut = String(d.status ?? d.result ?? d.code ?? "").toUpperCase();
  const negatif = ["KO", "ERROR", "ERREUR", "FAILED", "NOK"].includes(statut) || d.error || d.erreur;
  if (!r.ok || negatif) {
    throw new Error(`Elite SMS HTTP ${r.status} : ${d.message || d.error || d.erreur || brut || "envoi refusé"}`);
  }
  return { id: d.sms_id || d.id || d.message_id || null, httpStatus: r.status, brut };
}
