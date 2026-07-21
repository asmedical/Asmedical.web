// ─────────────────────────────────────────────────────────────────────────
// WhatsApp Cloud API (Meta) — acheminement du code de connexion.
//
// Prérequis côté Meta (une seule fois) :
//   1. developers.facebook.com → app « Business » + produit WhatsApp
//   2. Un numéro d'expéditeur vérifié (WHATSAPP_PHONE_ID = son ID)
//   3. Un modèle de message d'AUTHENTIFICATION approuvé (nom dans
//      WHATSAPP_TEMPLATE, langue WHATSAPP_TEMPLATE_LANGUE) — Meta impose
//      ce format pour les codes : corps avec {{1}} + bouton « copier le code ».
//   4. Un jeton permanent (WHATSAPP_TOKEN, utilisateur système Business).
//
// ⚠️ Serveur uniquement : le jeton n'est jamais exposé au navigateur.
// ─────────────────────────────────────────────────────────────────────────

export function whatsappConfigure() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

// Envoi générique d'un MODÈLE approuvé (utilitaire) — rappels de rendez-vous,
// confirmations… `parametres` remplit les {{1}}, {{2}}… du corps dans l'ordre.
// À utiliser UNIQUEMENT avec des modèles validés par Meta (catégorie Utility).
export async function envoyerWhatsAppModele(phone, modele, parametres = [], langue = "fr") {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId || !modele) throw new Error("WhatsApp non configuré");
  const destinataire = String(phone || "").replace(/\D/g, "");

  const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: destinataire,
      type: "template",
      template: {
        name: modele,
        language: { code: langue },
        components: parametres.length
          ? [{ type: "body", parameters: parametres.map((t) => ({ type: "text", text: String(t) })) }]
          : [],
      },
    }),
  });
  if (!r.ok) {
    let detail = "";
    try { detail = (await r.json())?.error?.message || ""; } catch {}
    throw new Error(`WhatsApp ${r.status}${detail ? ` : ${detail}` : ""}`);
  }
  return { canal: "whatsapp" };
}

// Envoie le code via le modèle d'authentification approuvé.
export async function envoyerWhatsAppOtp(phone, code) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) throw new Error("WhatsApp non configuré");

  const modele = process.env.WHATSAPP_TEMPLATE || "asm_code";
  const langue = process.env.WHATSAPP_TEMPLATE_LANGUE || "fr";
  const destinataire = String(phone || "").replace(/\D/g, "");

  const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: destinataire,
      type: "template",
      template: {
        name: modele,
        language: { code: langue },
        components: [
          { type: "body", parameters: [{ type: "text", text: String(code) }] },
          // Bouton « copier le code » exigé par les modèles d'authentification Meta.
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: String(code) }] },
        ],
      },
    }),
  });

  if (!r.ok) {
    let detail = "";
    try {
      const j = await r.json();
      detail = j?.error?.message || "";
    } catch {}
    throw new Error(`WhatsApp ${r.status}${detail ? ` : ${detail}` : ""}`);
  }
  return { canal: "whatsapp" };
}
