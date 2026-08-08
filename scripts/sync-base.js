// Synchronise le schéma Prisma avec la base au moment du build.
// Si DATABASE_URL n'est pas configurée (ex. projet Vercel fraîchement
// importé, aperçu sans variables), on n'échoue pas : le site se déploie
// quand même et l'API répondra une erreur claire tant que la base
// n'est pas branchée.
const { execSync } = require("child_process");

if (!process.env.DATABASE_URL) {
  console.warn(
    "\n⚠️  DATABASE_URL n'est pas définie — synchronisation de la base ignorée.\n" +
      "   Le site va se déployer, mais les demandes ne seront pas enregistrées.\n" +
      "   → Sur Vercel : Settings → Environment Variables → ajoutez DATABASE_URL\n" +
      "     (l'URL PostgreSQL de Railway), puis redéployez.\n"
  );
  process.exit(0);
}

// La synchro du schéma est un CONFORT au build, pas une condition de
// déploiement. Si `prisma db push` échoue (base momentanément injoignable,
// limite de connexions Railway, hoquet réseau…), on NE casse PAS le
// déploiement : on avertit et on continue. Le code déployé n'exige pas la
// synchro ; en cas de vrai changement de schéma non appliqué, l'API le
// signalera au runtime plutôt que de bloquer toute la mise en ligne.
try {
  execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" });
} catch (e) {
  console.warn(
    "\n⚠️  Synchronisation de la base échouée (prisma db push) — déploiement\n" +
      "   poursuivi quand même. Vérifiez la connexion à la base (Railway) si le\n" +
      "   problème persiste ; relancez ensuite un redéploiement pour appliquer\n" +
      "   d'éventuels changements de schéma.\n" +
      "   Détail : " + (e && e.message ? e.message : e) + "\n"
  );
  process.exit(0);
}
