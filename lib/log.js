// Journalisation structurée avec MASQUAGE automatique des données sensibles.
// Règle d'or : ne jamais écrire en clair dans les logs un téléphone, un email,
// un nom, un token, une clé, une URL de fichier privé ou le contenu d'un document.
// Sortie sur une seule ligne JSON → lisible par Vercel / Logtail / Better Stack.

const CLES_SENSIBLES = new Set([
  "telephone", "tel", "phone", "email", "mail", "nom", "prenom", "nom_utilisateur",
  "password", "motdepasse", "mot_de_passe", "motdepasse2", "token", "access_token",
  "refresh_token", "apikey", "api_key", "authorization", "auth", "key", "secret",
  "service_role", "anon", "chemin", "path", "signedurl", "notes", "depart",
  "destination", "contact", "adresse", "commune",
]);

export function masquerChaine(s) {
  if (typeof s !== "string") return s;
  return s
    // Jetons JWT (eyJ...) et « Bearer xxx »
    .replace(/\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b/g, "[token]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, "Bearer [token]")
    // Emails
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    // Numéros de téléphone (8 chiffres et plus, éventuellement +, espaces, .)
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[tel]");
}

export function rediger(valeur, prof = 0) {
  if (prof > 6 || valeur == null) return valeur;
  if (typeof valeur === "string") return masquerChaine(valeur);
  if (Array.isArray(valeur)) return valeur.map((v) => rediger(v, prof + 1));
  if (typeof valeur === "object") {
    const sortie = {};
    for (const [k, v] of Object.entries(valeur)) {
      sortie[k] = CLES_SENSIBLES.has(k.toLowerCase()) ? "[masqué]" : rediger(v, prof + 1);
    }
    return sortie;
  }
  return valeur;
}

export function logErreur(contexte, err, extra) {
  const paquet = {
    niveau: "error",
    horodatage: new Date().toISOString(),
    contexte: String(contexte).slice(0, 80),
    message: masquerChaine(String(err?.message || err)).slice(0, 300),
  };
  if (err?.code) paquet.code = String(err.code).slice(0, 40);
  if (extra) paquet.details = rediger(extra);
  console.error(JSON.stringify(paquet));
}

export function logInfo(contexte, extra) {
  // Silencieux en production sauf si LOG_VERBOSE=1 (évite les logs inutiles).
  if (process.env.NODE_ENV === "production" && process.env.LOG_VERBOSE !== "1") return;
  const paquet = { niveau: "info", horodatage: new Date().toISOString(), contexte: String(contexte).slice(0, 80) };
  if (extra) paquet.details = rediger(extra);
  console.log(JSON.stringify(paquet));
}
