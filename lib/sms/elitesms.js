// Adaptateur Elite SMS (smsalgerie.com) — SMS nationaux algériens.
//
// Variables d'environnement (serveur uniquement) :
//   ELITESMS_API_KEY   — « API Key » du compte (page Profil de la console)
//   ELITESMS_USER_KEY  — « User Key » du compte
//   ELITESMS_BASE_URL  — (option) défaut https://es3.smsalgerie.com/api/json
//   SMS_EXPEDITEUR     — (option) nom d'expéditeur si le compte l'autorise
//
// La documentation détaillée d'Elite n'étant fournie que sur demande, les
// noms de paramètres d'authentification varient selon les versions : on
// essaie les variantes connues dans l'ordre. Une variante refusée pour
// « authentification » ne coûte rien (aucun SMS parti) ; dès qu'une passe,
// on s'arrête. La réponse observée du serveur est en kebab-case
// ({"status":"fail","result":{"error-id":100,…}}).
export async function envoyerElite(phone, message) {
  // Les clés sont des hexadécimaux : on retire tout blanc (espace ou retour
  // à la ligne glissé au copier-coller dans Vercel).
  const apikey = String(process.env.ELITESMS_API_KEY || "").replace(/\s+/g, "");
  const userkey = String(process.env.ELITESMS_USER_KEY || "").replace(/\s+/g, "");
  const base = process.env.ELITESMS_BASE_URL || "https://es3.smsalgerie.com/api/json";
  if (!apikey || !userkey) throw new Error("Configuration Elite SMS incomplète");

  // Normalisation exigée par Elite : 213 suivi du numéro, sans + ni 00.
  let to = String(phone).replace(/\D/g, "");
  if (to.startsWith("00")) to = to.slice(2);
  if (to.startsWith("0")) to = "213" + to.slice(1);
  if (!/^213(5|6|7)\d{8}$/.test(to)) {
    throw new Error("Numéro algérien invalide pour Elite SMS");
  }

  const exp = (process.env.SMS_EXPEDITEUR || "").slice(0, 11) || null;
  const variantes = [
    { nom: "apikey/userkey", corps: { apikey, userkey, function: "sms_send", to, message, ...(exp ? { sender: exp } : {}) } },
    { nom: "api_key/user_key", corps: { api_key: apikey, user_key: userkey, function: "sms_send", to, message, ...(exp ? { sender: exp } : {}) } },
    { nom: "api-key/user-key", corps: { "api-key": apikey, "user-key": userkey, function: "sms_send", to, message, ...(exp ? { sender: exp } : {}) } },
  ];

  let derniere = null;
  for (const v of variantes) {
    const r = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v.corps),
    });
    // Réponse BRUTE conservée (tronquée) pour le diagnostic : elle ne
    // contient jamais nos clés, seulement la réponse du fournisseur.
    const texte = await r.text();
    let d = {};
    try { d = JSON.parse(texte); } catch {}
    const brut = texte.slice(0, 300);
    derniere = { httpStatus: r.status, brut };

    const statut = String(d.status ?? "").toUpperCase();
    const res = d.result && typeof d.result === "object" ? d.result : {};
    const indicateur = String(res["error-indicator"] || d.message || d.error || d.erreur || "");
    const echec = !r.ok || ["FAIL", "KO", "ERROR", "ERREUR", "FAILED", "NOK"].includes(statut) || d.error || d.erreur;

    // Authentification refusée → la variante suivante (aucun SMS parti).
    const authRefusee = res["error-id"] === 100 || /uthentifi/i.test(indicateur);
    if (echec && authRefusee) continue;

    if (echec) {
      throw new Error(`Elite SMS HTTP ${r.status} : ${indicateur || brut || "envoi refusé"}`);
    }
    return {
      id: res.sms_id || res.id || d.sms_id || d.id || d.message_id || null,
      httpStatus: r.status, brut, variante: v.nom,
    };
  }

  throw new Error(
    `Elite SMS : authentification refusée (toutes variantes). Vérifiez ELITESMS_API_KEY et ELITESMS_USER_KEY dans Vercel — copie complète, sans espace. Dernière réponse : ${derniere?.brut || "—"}`
  );
}
