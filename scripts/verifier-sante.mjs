// Petit script de vérification de santé (à lancer à la main ou en CI).
//   node scripts/verifier-sante.mjs                 → teste http://localhost:3000
//   BASE_URL=https://asmedical-web.vercel.app npm run sante
// Affiche le statut renvoyé par /api/health et sort en code ≠ 0 si ERROR.
const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
try {
  const r = await fetch(`${base}/api/health`);
  const j = await r.json();
  console.log(`Statut: ${j.statut} (HTTP ${r.status})`);
  console.log(JSON.stringify(j.checks, null, 2));
  process.exit(j.statut === "ERROR" ? 1 : 0);
} catch (e) {
  console.error("Impossible de joindre", base, "-", e.message);
  process.exit(1);
}
