// Notification de l'équipe ASM à chaque nouvelle demande — pour tenir
// la promesse du rappel en moins de 30 minutes sans garder /equipe ouvert.
//
// Deux canaux, activés par variables d'environnement (aucun si absentes) :
//  - Telegram (gratuit) : TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
//  - Webhook générique  : NOTIFY_WEBHOOK_URL (reçoit un POST JSON ;
//    compatible Slack/Discord/Make/Zapier — champ `text` + demande complète)
//
// Ne lève jamais d'erreur : une notification qui échoue ne doit pas
// faire échouer l'enregistrement de la demande.
import { logErreur } from "@/lib/log";

const SERVICES = {
  transport: "Transport médical",
  domicile: "Aide à domicile",
  medicaments: "Livraison de médicaments",
};
const TRAJETS = {
  simple: "simple (assis)",
  accompagne: "accompagné (fauteuil)",
  medicalise: "médicalisé (infirmier)",
};

function resumeDemande(d) {
  const lignes = [
    `🚑 Nouvelle demande ASM n°${d.id}${d.espace === "pro" ? " (établissement)" : ""}`,
    `Service : ${SERVICES[d.service] || d.service}${d.typeTrajet ? ` — ${TRAJETS[d.typeTrajet] || d.typeTrajet}` : ""}`,
    `Téléphone : ${d.telephone}`,
  ];
  if (d.depart || d.destination) lignes.push(`Trajet : ${d.depart || "?"} → ${d.destination || "?"}`);
  if (d.date) lignes.push(`Souhaité : ${d.date.replace("T", " à ")}`);
  if (d.recurrence && d.recurrence !== "Une seule fois") lignes.push(`Récurrence : ${d.recurrence}`);
  if (d.notes) lignes.push(`Notes : ${d.notes}`);
  lignes.push("→ Rappeler dans les 30 minutes");
  return lignes.join("\n");
}

async function poster(url, corps) {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), 4000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
      signal: controle.signal,
    });
  } finally {
    clearTimeout(minuteur);
  }
}

export async function notifierEquipe(demande) {
  const texte = resumeDemande(demande);
  const envois = [];

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (token && chat) {
    envois.push(
      poster(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chat,
        text: texte,
      })
    );
  }

  const webhook = process.env.NOTIFY_WEBHOOK_URL;
  if (webhook) {
    envois.push(poster(webhook, { text: texte, demande }));
  }

  if (envois.length === 0) return;
  const resultats = await Promise.allSettled(envois);
  for (const r of resultats) {
    if (r.status === "rejected") logErreur("notifier", r.reason);
  }
}
