// Adaptateur Twilio (API REST « Messages »).
//
// Variables d'environnement (serveur uniquement — jamais NEXT_PUBLIC_) :
//   TWILIO_ACCOUNT_SID           — « Account ID » Twilio (commence par AC…)
//   TWILIO_AUTH_TOKEN            — jeton d'authentification
//   TWILIO_MESSAGING_SERVICE_SID — « Service ID » du Messaging Service (MG…)
//   TWILIO_FROM                  — (option) numéro expéditeur si pas de service
//
// Twilio s'authentifie en HTTP Basic : identifiant = Account SID,
// mot de passe = Auth Token.
export async function envoyerTwilio(phone, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const from = process.env.TWILIO_FROM;

  if (!sid || !token || (!service && !from)) {
    throw new Error("Configuration Twilio incomplète");
  }

  const corps = new URLSearchParams();
  corps.set("To", phone);
  corps.set("Body", message);
  if (service) corps.set("MessagingServiceSid", service);
  else corps.set("From", from);

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: corps.toString(),
    }
  );

  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(`Twilio ${r.status} : ${d.message || "envoi refusé"}`);
  }
  const d = await r.json().catch(() => ({}));
  return { id: d.sid };
}
