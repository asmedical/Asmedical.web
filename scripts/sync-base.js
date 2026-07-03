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

execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" });
