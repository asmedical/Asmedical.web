// Adaptateur Infobip (couverture Algérie, API REST « Send SMS »).
//
// Variables d'environnement (serveur uniquement) :
//   INFOBIP_BASE_URL  — base personnelle du compte, ex. https://xxxxx.api.infobip.com
//   INFOBIP_API_KEY   — clé API
//   SMS_EXPEDITEUR    — nom d'expéditeur affiché (sender ID), ex. « ASM »
//
// Endpoint : POST {base}/sms/2/text/advanced
// Auth : en-tête « Authorization: App <clé> ».
export async function envoyerInfobip(phone, message) {
  const base = (process.env.INFOBIP_BASE_URL || "").replace(/\/$/, "");
  const cle = process.env.INFOBIP_API_KEY;
  if (!base || !cle) throw new Error("Configuration Infobip incomplète");

  const r = await fetch(`${base}/sms/2/text/advanced`, {
    method: "POST",
    headers: {
      Authorization: `App ${cle}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          from: (process.env.SMS_EXPEDITEUR || "ASM").slice(0, 11),
          destinations: [{ to: phone }],
          text: message,
        },
      ],
    }),
  });

  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    const msg = d?.requestError?.serviceException?.text || "envoi refusé";
    throw new Error(`Infobip ${r.status} : ${msg}`);
  }
  const d = await r.json().catch(() => ({}));
  return { id: d?.messages?.[0]?.messageId };
}
