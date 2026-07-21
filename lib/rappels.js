// Rappels de rendez-vous automatiques — logique centrale (testable).
// Deux rappels par demande, jamais plus (table RappelRdv, contrainte unique) :
//  - « veille »  : la demande a lieu dans 18 à 30 heures ;
//  - « h2 »      : la demande a lieu dans 1 à 3 heures.
// Canaux : notification interne + push toujours ; SMS Elite si du crédit
// reste ; WhatsApp si un modèle utilitaire approuvé est configuré
// (WHATSAPP_TEMPLATE_RAPPEL). Chaque envoi trace ses canaux réels.
//
// Déclenchement SANS infrastructure dédiée : « opportuniste » (au passage
// du trafic, avec un verrou anti-rafale en base) + cron Vercel quotidien
// sur /api/rappels en filet de sécurité.
import { prisma } from "@/lib/prisma";
import { cleTel } from "@/lib/telephones";
import { getReglage } from "@/lib/creneaux";

const H = 3600 * 1000;
const LIB_SERVICE = { transport: "transport", domicile: "aide à domicile", medicaments: "livraison de médicaments" };
const STATUTS_RAPPEL = ["A_RAPPELER", "CONFIRMEE", "AFFECTEE"];
export const SEUIL_CREDIT_SMS = 5; // on garde toujours quelques SMS pour les codes de connexion

function fenetre(now, deMin, aMax) {
  const iso = (t) => new Date(t).toISOString().slice(0, 16);
  return { gte: iso(now.getTime() + deMin), lte: iso(now.getTime() + aMax) };
}

// Demandes à rappeler maintenant, par type — celles qui n'ont pas déjà eu
// LEUR rappel (veille et h2 sont indépendants).
export async function demandesARappeler(now = new Date()) {
  const [veille, h2, deja] = await Promise.all([
    prisma.demande.findMany({ where: { statut: { in: STATUTS_RAPPEL }, date: fenetre(now, 18 * H, 30 * H) } }),
    prisma.demande.findMany({ where: { statut: { in: STATUTS_RAPPEL }, date: fenetre(now, 1 * H, 3 * H) } }),
    prisma.rappelRdv.findMany({ select: { demandeId: true, type: true } }),
  ]);
  const fait = new Set(deja.map((r) => `${r.demandeId}:${r.type}`));
  return {
    veille: veille.filter((d) => !fait.has(`${d.id}:veille`)),
    h2: h2.filter((d) => !fait.has(`${d.id}:h2`)),
  };
}

function texteRappel(d, type) {
  const heure = (d.date || "").slice(11, 16);
  const service = LIB_SERVICE[d.service] || d.service;
  return type === "veille"
    ? `Rappel ASM : votre ${service} est prévu demain à ${heure}. Pour annuler ou modifier, appelez le 05 64 49 33 48.`
    : `Rappel ASM : votre ${service} est prévu à ${heure} (dans environ 2 h). Votre intervenant arrive — tenez-vous prêt(e).`;
}

// Envoie les rappels dus. `admin` (Supabase service-role) sert à retrouver
// les comptes ; `canaux` permet d'injecter des envoyeurs factices en test.
export async function envoyerRappels({ admin, now = new Date(), canaux = {} } = {}) {
  const aFaire = await demandesARappeler(now);
  const sms = canaux.sms || (await import("@/lib/sms/elitesms"));
  const push = canaux.push || (await import("@/lib/pushEnvoi"));
  const whatsapp = canaux.whatsapp || (await import("@/lib/sms/whatsapp"));

  // Crédit SMS vérifié UNE fois par passage — jamais bloquant.
  // creditElite() renvoie le crédit sous forme de chaîne (ex. "42.0").
  let credit = 0;
  try { credit = parseFloat(await sms.creditElite()) || 0; } catch {}
  const modeleWa = process.env.WHATSAPP_TEMPLATE_RAPPEL || "";
  const waPret = Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID && modeleWa);

  let envoyes = 0;
  for (const [type, liste] of [["veille", aFaire.veille], ["h2", aFaire.h2]]) {
    for (const d of liste) {
      // Verrou anti-doublon AVANT tout envoi : si une autre instance a déjà
      // pris ce rappel (contrainte unique), on passe sans rien envoyer.
      try {
        await prisma.rappelRdv.create({ data: { demandeId: d.id, type } });
      } catch (e) {
        if (String(e.code) === "P2002") continue;
        throw e;
      }

      const texte = texteRappel(d, type);
      const heure = (d.date || "").slice(11, 16);
      const faits = [];

      // 1. Notification interne (compte retrouvé par téléphone)
      let userId = null;
      try {
        const cle = cleTel(d.telephone);
        if (admin && cle) {
          const { data } = await admin.from("profil").select("id").ilike("telephone", `%${cle}%`).limit(1);
          userId = data?.[0]?.id || null;
        }
        if (userId) {
          await prisma.notification.create({
            data: {
              userId, type: "rappel",
              titre: type === "veille" ? "⏰ Rendez-vous demain" : "⏰ Rendez-vous dans 2 h",
              corps: texte, auteur: "Rappel automatique", statut: "NON_LU",
              lienType: "demande", lienId: String(d.id),
            },
          });
          faits.push("notification");
        }
      } catch {}

      // 2. Push
      try {
        if (userId) {
          await push.envoyerPush(userId, { titre: "⏰ Rappel ASM", corps: texte, url: `/suivi?id=${d.id}` });
          faits.push("push");
        }
      } catch {}

      // 3. SMS Elite — seulement s'il reste du crédit au-delà du seuil.
      try {
        if (credit > SEUIL_CREDIT_SMS) {
          await sms.envoyerElite(d.telephone, texte);
          credit -= 1;
          faits.push("sms");
        }
      } catch {}

      // 4. WhatsApp (modèle utilitaire approuvé, quand configuré)
      try {
        if (waPret) {
          await whatsapp.envoyerWhatsAppModele(d.telephone, modeleWa, [LIB_SERVICE[d.service] || d.service, heure]);
          faits.push("whatsapp");
        }
      } catch {}

      await prisma.rappelRdv.update({
        where: { demandeId_type: { demandeId: d.id, type } },
        data: { canaux: faits.join(",") },
      });
      envoyes++;
    }
  }
  return { envoyes };
}

// Déclencheur opportuniste : appelé au passage par des routes fréquentées.
// Le verrou en base (mise à jour conditionnelle atomique) garantit qu'au
// plus UNE exécution démarre par période de 10 minutes, même sur plusieurs
// instances serveur en parallèle.
export async function tickRappels({ admin } = {}) {
  const reglage = await getReglage();
  if (!reglage.rappelsAuto) return { saute: true };
  const seuil = new Date(Date.now() - 10 * 60 * 1000);
  const pris = await prisma.reglage.updateMany({
    where: { id: 1, OR: [{ rappelsTickLe: null }, { rappelsTickLe: { lt: seuil } }] },
    data: { rappelsTickLe: new Date() },
  });
  if (pris.count === 0) return { saute: true }; // une autre instance s'en occupe
  return envoyerRappels({ admin });
}
