// Limitation anti-abus simple, en mémoire (best-effort).
// ⚠️ Sur Vercel, chaque instance a sa propre mémoire : cette limite freine
// les rafales évidentes mais n'est pas une protection distribuée. Pour une
// vraie limitation, brancher Upstash Redis / Vercel KV (voir docs).
const seaux = new Map();

export function autorise(cle, max, fenetreMs) {
  const maintenant = Date.now();
  const e = seaux.get(cle);
  if (!e || maintenant > e.reset) {
    seaux.set(cle, { n: 1, reset: maintenant + fenetreMs });
    return true;
  }
  if (e.n >= max) return false;
  e.n++;
  return true;
}

// Nettoyage occasionnel pour éviter que la Map grossisse indéfiniment.
export function nettoyer() {
  const maintenant = Date.now();
  for (const [cle, e] of seaux) if (maintenant > e.reset) seaux.delete(cle);
}
