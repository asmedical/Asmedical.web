// Adaptateur SMS Partner (passerelle FR/Maghreb, API JSON simple).
//
// Variables d'environnement (serveur uniquement) :
//   SMSPARTNER_API_KEY  — clé API du compte
//   SMS_EXPEDITEUR      — nom d'expéditeur affiché (sender ID), ex. « ASM »
//
// Endpoint documenté : POST https://api.smspartner.fr/v1/send
// Le format exact peut varier selon le contrat ; on isole ici l'appel pour
// n'avoir qu'un seul fichier à ajuster le jour où le devis est signé.
export async function envoyerSmsPartner(phone, message) {
  const cle = process.env.SMSPARTNER_API_KEY;
  if (!cle) throw new Error("Configuration SMS Partner incomplète");

  const r = await fetch("https://api.smspartner.fr/v1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: cle,
      phoneNumbers: phone,
      message,
      sender: (process.env.SMS_EXPEDITEUR || "ASM").slice(0, 11),
    }),
  });

  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(`SMS Partner ${r.status} : ${d.message || "envoi refusé"}`);
  }
  const d = await r.json().catch(() => ({}));
  return { id: d.message_id || d.messageId };
}
