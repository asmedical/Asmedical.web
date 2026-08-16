// Pourquoi une connexion a échoué.
//
// L'écran de connexion affichait « Identifiant ou mot de passe incorrect »
// pour absolument tout : service en panne, compte non confirmé, trop de
// tentatives, réseau coupé. Le compte de test remis à Apple ne pouvait pas
// se connecter — le service d'authentification plantait avant même de
// regarder le mot de passe — et pendant cinq jours l'application a répété à
// l'examinateur que son mot de passe était faux. L'application a été
// refusée pour cette raison.
//
// Accuser le mot de passe est le pire message par défaut : c'est le seul
// qui pousse l'utilisateur à ressaisir indéfiniment quelque chose de juste.
//
// Ce classement est volontairement prudent : en cas de doute il retombe sur
// « identifiants », le message le plus courant. Il ne sert qu'à écarter les
// cas où l'on SAIT que le mot de passe n'est pas en cause.
//
// mobile/src/authErreurs.js en tient la copie — l'application ne partage
// pas ce dossier. Un test compare les deux sur les mêmes entrées.

export const RAISONS = {
  CONFIG: "config",
  SERVICE: "service",
  RESEAU: "reseau",
  EMAIL_NON_CONFIRME: "email_non_confirme",
  TROP_DE_TENTATIVES: "trop_de_tentatives",
  IDENTIFIANTS: "identifiants",
};

// Clé de traduction à afficher pour chaque raison.
export const LIBELLE_RAISON = {
  config: "err_app_config",
  service: "err_service",
  reseau: "err_reseau",
  email_non_confirme: "err_email_non_confirme",
  trop_de_tentatives: "err_trop_tentatives",
  identifiants: "err_identifiant",
};

export function raisonEchecConnexion(e) {
  if (!e) return RAISONS.IDENTIFIANTS;

  const message = String(e.message || "").toLowerCase();
  const code = String(e.code || "").toLowerCase();
  const statut = Number(e.status || e.statusCode || 0);

  // Clés Supabase absentes du build : rien n'a même été tenté.
  if (message === "config") return RAISONS.CONFIG;

  // Le téléphone n'a pas pu joindre le serveur. Un réseau algérien qui
  // hoquette ne doit pas être présenté comme un mot de passe faux.
  if (
    e.name === "TypeError" ||
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("networkerror")
  ) {
    return RAISONS.RESEAU;
  }

  // 5xx : la panne est chez nous. C'est le cas qui a coûté la validation
  // Apple, et celui qu'il ne faut jamais imputer à l'utilisateur.
  if (statut >= 500) return RAISONS.SERVICE;
  if (code === "unexpected_failure" || message.includes("database error")) return RAISONS.SERVICE;

  if (statut === 429 || code.includes("rate") || message.includes("rate limit")) {
    return RAISONS.TROP_DE_TENTATIVES;
  }

  if (code === "email_not_confirmed" || message.includes("not confirmed")) {
    return RAISONS.EMAIL_NON_CONFIRME;
  }

  return RAISONS.IDENTIFIANTS;
}

// Raison → clé de traduction, en une étape pour les écrans.
export function messageEchecConnexion(e) {
  return LIBELLE_RAISON[raisonEchecConnexion(e)] || "err_identifiant";
}
