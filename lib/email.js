// Envoi d'emails transactionnels via l'API Brevo (HTTP), côté serveur
// uniquement. La clé API reste dans les variables d'environnement
// (BREVO_API_KEY) — jamais exposée au frontend.

const EXPEDITEUR_EMAIL = process.env.EMAIL_EXPEDITEUR || "Contact@asm-sante.com";
const EXPEDITEUR_NOM = process.env.EMAIL_EXPEDITEUR_NOM || "ASM";

export function emailConfigure() {
  return Boolean(process.env.BREVO_API_KEY);
}

// Envoie un email HTML. Ne lève jamais : renvoie { ok, raison }.
export async function envoyerEmail({ to, subject, html }) {
  const key = process.env.BREVO_API_KEY;
  if (!key) return { ok: false, raison: "non_configure" };
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: EXPEDITEUR_EMAIL, name: EXPEDITEUR_NOM },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!r.ok) return { ok: false, raison: "echec", detail: (await r.text().catch(() => "")).slice(0, 200) };
    return { ok: true };
  } catch {
    return { ok: false, raison: "reseau" };
  }
}

// Gabarit HTML réutilisable, aux couleurs ASM.
function gabarit(titre, corps) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#F4F9F6;font-family:Arial,Helvetica,sans-serif;color:#22332C">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <div style="background:#0E6B3F;color:#fff;padding:16px 20px;border-radius:14px 14px 0 0;font-size:18px;font-weight:bold">ASM · Assistance Santé Médical</div>
    <div style="background:#fff;border:1px solid #E6EEE9;border-top:none;border-radius:0 0 14px 14px;padding:22px">
      <h1 style="font-size:20px;color:#0A5230;margin:0 0 14px">${titre}</h1>
      ${corps}
    </div>
    <p style="color:#6B7A72;font-size:12px;text-align:center;margin-top:16px">ASM — Bir Mourad Raïs, Alger</p>
  </div></body></html>`;
}

// Email d'invitation d'un employé (identifiant + mot de passe temporaire).
export function emailInvitation({ prenom, email, motDePasse, lien, role }) {
  const bonjour = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  const corps = `
    <p>${bonjour}</p>
    <p>Un compte vient d'être créé pour vous sur l'espace employé ASM${role ? ` (rôle : <b>${role}</b>)` : ""}.</p>
    <div style="background:#F4F9F6;border:1px solid #E6EEE9;border-radius:10px;padding:14px;margin:16px 0">
      <p style="margin:0 0 8px"><b>Identifiant :</b> ${email}</p>
      <p style="margin:0"><b>Mot de passe temporaire :</b> <span style="font-family:monospace;font-size:16px">${motDePasse}</span></p>
    </div>
    <p><a href="${lien}" style="display:inline-block;background:#0E6B3F;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">Se connecter</a></p>
    <p style="color:#6B7A72;font-size:14px;margin-top:16px">Pour votre sécurité, vous devrez <b>choisir un nouveau mot de passe</b> dès votre première connexion.</p>
  `;
  return gabarit("Bienvenue dans l'équipe ASM", corps);
}
