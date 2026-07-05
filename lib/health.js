// Agrège des contrôles individuels en un statut global.
// Chaque contrôle : { ok: boolean, critique: boolean }
//  - un contrôle critique en échec  → ERROR (le site ne peut pas fonctionner)
//  - un contrôle non critique échoué → WARNING (service dégradé)
//  - tout va bien                    → OK
export function agregerStatut(checks) {
  const valeurs = Object.values(checks || {});
  if (valeurs.some((c) => c && c.ok === false && c.critique)) return "ERROR";
  if (valeurs.some((c) => c && c.ok === false)) return "WARNING";
  return "OK";
}

// Petite aide : exécute une promesse avec un délai maximal.
export function avecDelai(promesse, ms) {
  let minuteur;
  const limite = new Promise((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(new Error("timeout")), ms);
  });
  return Promise.race([promesse, limite]).finally(() => clearTimeout(minuteur));
}
