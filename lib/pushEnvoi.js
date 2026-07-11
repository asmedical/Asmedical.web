// Envoi de notifications push (Web Push / VAPID), côté serveur uniquement.
// Clés dans les variables d'environnement :
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY (publique, utilisée aussi côté navigateur)
//   VAPID_PRIVATE_KEY            (secrète, jamais exposée)
// Best-effort : ne lève jamais ; les abonnements morts sont supprimés.
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;

export function pushConfigure() {
  return Boolean(PUB && PRIV);
}

let initialise = false;
function init() {
  if (initialise || !pushConfigure()) return;
  webpush.setVapidDetails("mailto:Contact@asm-sante.com", PUB, PRIV);
  initialise = true;
}

// Envoie un push à TOUS les appareils d'un utilisateur.
// { titre, corps, url } — url = page ouverte au clic.
export async function envoyerPush(userId, { titre, corps, url }) {
  try {
    if (!pushConfigure() || !userId) return;
    init();
    const abonnements = await prisma.pushAbonnement.findMany({ where: { userId } });
    if (!abonnements.length) return;
    const charge = JSON.stringify({ titre, corps: corps || "", url: url || "/messagerie" });
    await Promise.allSettled(
      abonnements.map(async (a) => {
        try {
          await webpush.sendNotification(
            { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
            charge
          );
        } catch (e) {
          // 404/410 = abonnement expiré → on le supprime.
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await prisma.pushAbonnement.delete({ where: { id: a.id } }).catch(() => {});
          }
        }
      })
    );
  } catch {}
}
