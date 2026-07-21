// Cerveau de l'assistant ASM — appel à Google Gemini (IA) CÔTÉ SERVEUR.
// La clé API vit exclusivement dans une variable d'environnement Vercel
// (GEMINI_API_KEY) — jamais dans le code, jamais envoyée au navigateur.
// Si la clé n'est pas configurée, l'appelant retombe sur le moteur guidé.
//
// L'IA est « bridée » : elle répond uniquement à partir des FAITS ASM et du
// CONTEXTE réel du client (ses demandes, injecté côté serveur). Elle n'invente
// jamais de prix, ne donne pas de conseil médical, et oriente vers un humain
// ou les secours quand il le faut. La réponse est structurée { reponse, action }.

const NUMERO = "05 64 49 33 48";

// Actions que l'IA peut proposer (bouton sous sa réponse). Doit rester aligné
// avec CIBLES_ACTION du composant / lib assistantScenarios.
export const ACTIONS_IA = [
  "aucune", "rdv", "suivi", "packs", "abonnements", "devis",
  "proches", "paiements", "medicaments", "connexion", "appeler",
];

// Diagnostic sûr : indique SI la clé est lue et SI Gemini répond, avec la
// raison d'erreur éventuelle — SANS jamais renvoyer la clé.
export async function testIA() {
  const cle = process.env.GEMINI_API_KEY;
  const info = { configure: Boolean(cle), modele: modele() };
  if (!cle) {
    return { ...info, ok: false, raison: "GEMINI_API_KEY absente : la variable n'est pas lue (nom exact ? redéploiement fait ? cochée pour Production ?)." };
  }
  const corps = {
    contents: [{ role: "user", parts: [{ text: "Réponds juste OK." }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 20,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: { reponse: { type: "STRING" }, action: { type: "STRING", enum: ACTIONS_IA } },
        required: ["reponse", "action"],
      },
    },
  };
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modele())}` +
    `:generateContent?key=${encodeURIComponent(cle)}`;
  try {
    const rep = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corps),
    });
    const data = await rep.json().catch(() => ({}));
    if (!rep.ok) {
      // En cas d'échec, on liste les modèles Flash réellement disponibles pour
      // cette clé — pour choisir à coup sûr (ASM_ASSISTANT_MODEL).
      let dispo = [];
      try {
        const lst = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cle)}`
        );
        const j = await lst.json().catch(() => ({}));
        dispo = (j.models || [])
          .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
          .map((m) => String(m.name || "").replace(/^models\//, ""))
          .filter((n) => /flash|gemini/i.test(n));
      } catch {}
      return {
        ...info,
        ok: false,
        statut: rep.status,
        raison: String(data?.error?.message || "erreur inconnue").slice(0, 400),
        modelesDispo: dispo.slice(0, 20),
      };
    }
    const cand = data.candidates?.[0];
    const txt = (cand?.content?.parts || []).map((p) => p.text || "").join("");
    return { ...info, ok: Boolean(txt), statut: 200, finish: cand?.finishReason, apercu: txt.slice(0, 80) };
  } catch (e) {
    return { ...info, ok: false, raison: "réseau : " + String(e?.message || e).slice(0, 200) };
  }
}

export function assistantIAConfigure() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function modele() {
  // Surchargable en prod. Alias « flash le plus récent » : se met à jour tout
  // seul et reste ouvert aux nouveaux comptes (les versions figées comme
  // gemini-2.5-flash finissent fermées aux nouveaux projets).
  return process.env.ASM_ASSISTANT_MODEL || "gemini-flash-latest";
}

// Faits de référence ASM : la seule source de vérité de l'IA. Tout ce qui n'y
// est pas doit être renvoyé vers un conseiller — pas d'invention.
const FAITS = `
Tu es l'assistant virtuel d'ASM (Assistance Sociale Médicale), une plateforme
algérienne. Ton rôle : régler la demande du client tout de suite, avec chaleur
et clarté, comme un conseiller expérimenté. Vise à résoudre plus de 7 incidents
sur 10 sans intervention humaine.

SERVICES ASM :
- Transport médical (aller/retour vers hôpital, clinique, analyses…).
- Aide à domicile par un(e) auxiliaire de santé (toilette, soins simples, présence).
- Livraison de médicaments à domicile (l'ordonnance se joint en photo à la réservation).

RÉSERVER :
- Depuis « Prendre rendez-vous » (rdv). Le prix EXACT s'affiche AVANT de confirmer
  (estimé selon le trajet et l'horaire). On peut aussi réserver POUR un proche
  ajouté dans « Mes proches ».

PAIEMENT (très important) :
- Deux moyens seulement : en ligne (carte CIB / EDAHABIA), ou ticket d'agence
  (espèces réglées À L'AGENCE, avec un code ticket).
- On NE PAIE PAS le coursier ni l'auxiliaire en espèces (déconseillé en Algérie).
- Factures et reçus dans « Paiements & factures ». Des abonnements et des packs
  tout compris existent aussi.

SUIVI : la demande se suit en direct (étapes, chauffeur/soignant, arrivée estimée)
dans « Suivi ». On peut écrire dans la discussion de sa demande.

CONNEXION : par numéro de téléphone (code SMS/WhatsApp) ou compte Google. Pas de
mot de passe à retenir.

HORAIRES : 7j/7, de 7h à 19h (transport urgent possible en dehors — appeler).

CONTACT HUMAIN : téléphone ou WhatsApp au ${NUMERO}, 7j/7.

URGENCE VITALE : diriger d'abord vers le SAMU (16) ou la Protection civile (14).

RÈGLES STRICTES :
- N'invente JAMAIS un prix, un délai chiffré, une disponibilité précise, ni une
  information absente des faits ci-dessus. En cas de doute, propose d'appeler le ${NUMERO}.
- Ne donne AUCUN conseil médical ou diagnostic. Pour une question de santé,
  oriente vers un professionnel ou, si c'est grave, vers le 16 / 14.
- Ne demande jamais de mot de passe, de code de carte bancaire, ni de coordonnées
  bancaires. Ne prétends jamais qu'un paiement est confirmé.
- Reste bref (2 à 4 phrases), concret et rassurant. Une seule action proposée.

Réponds au client dans SA langue. "action" : UNE valeur parmi
${ACTIONS_IA.join(", ")} (un bouton d'aide sous ta réponse), ou "aucune" si
aucun bouton n'est utile. "appeler" pour joindre un humain.`;

// Construit le bloc de contexte propre au client (demandes réelles), injecté
// côté serveur — jamais fourni par le navigateur, donc non falsifiable.
export function contexteClient({ prenom, demandes } = {}) {
  const lignes = [];
  if (prenom) lignes.push(`Prénom du client : ${prenom}.`);
  if (Array.isArray(demandes) && demandes.length) {
    lignes.push("Demandes récentes de ce client (les plus récentes d'abord) :");
    for (const d of demandes.slice(0, 5)) {
      const date = d.date ? new Date(d.date).toLocaleDateString("fr-FR") : "";
      lignes.push(
        `- #${d.id} · ${d.service || "prestation"} · statut ${d.statut || "?"}` +
          (date ? ` · ${date}` : "")
      );
    }
    lignes.push(
      "Statuts : A_RAPPELER=à confirmer, CONFIRMEE=confirmée, AFFECTEE=intervenant assigné, " +
        "EN_COURS=en cours, TERMINEE=terminée, ANNULEE=annulée."
    );
  } else {
    lignes.push("Ce client n'a pas de demande enregistrée (ou n'est pas connecté).");
  }
  return lignes.join("\n");
}

function extraireJSON(texte) {
  if (!texte) return null;
  try {
    return JSON.parse(texte);
  } catch {}
  const i = texte.indexOf("{");
  const j = texte.lastIndexOf("}");
  if (i >= 0 && j > i) {
    try {
      return JSON.parse(texte.slice(i, j + 1));
    } catch {}
  }
  return null;
}

// Appelle Gemini et renvoie { reponse, action }. Lève une erreur si la clé
// manque, si l'appel échoue, ou si l'IA est bloquée — l'appelant retombe alors
// sur le moteur guidé (repondreAssistant).
export async function demanderIA({ message, historique = [], langue = "fr", contexte = "" }) {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle) throw new Error("assistant_ia_absent");

  const texte = String(message || "").slice(0, 1000).trim();
  if (!texte) throw new Error("message_vide");

  // Gemini attend les rôles « user » et « model ». On ne garde que les derniers
  // échanges (coût + latence).
  const contents = [];
  for (const m of historique.slice(-8)) {
    const role = m.role === "assistant" || m.role === "model" ? "model" : "user";
    const content = String(m.content || "").slice(0, 1000);
    if (content) contents.push({ role, parts: [{ text: content }] });
  }
  contents.push({ role: "user", parts: [{ text: texte }] });

  const systeme =
    FAITS +
    `\n\nLANGUE : réponds en ${langue === "ar" ? "arabe" : "français"}.` +
    (contexte ? `\n\nCONTEXTE DU CLIENT :\n${contexte}` : "");

  const corps = {
    systemInstruction: { parts: [{ text: systeme }] },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 600,
      // Pas de « réflexion » : réponses courtes cadrées → plus rapide, moins cher.
      thinkingConfig: { thinkingBudget: 0 },
      // Réponse structurée garantie : { reponse, action }.
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          reponse: { type: "STRING" },
          action: { type: "STRING", enum: ACTIONS_IA },
        },
        required: ["reponse", "action"],
      },
    },
  };

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modele())}` +
    `:generateContent?key=${encodeURIComponent(cle)}`;

  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), 20000);
  let rep;
  try {
    rep = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corps),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(minuteur);
  }

  if (!rep.ok) throw new Error(`assistant_ia_http_${rep.status}`);
  const data = await rep.json();
  if (data.promptFeedback?.blockReason) throw new Error("assistant_ia_bloque");

  const cand = data.candidates?.[0];
  const raison = cand?.finishReason;
  if (raison && raison !== "STOP" && raison !== "MAX_TOKENS") throw new Error("assistant_ia_bloque");

  const brut = (cand?.content?.parts || []).map((p) => p.text || "").join("");
  const parse = extraireJSON(brut);
  if (!parse || typeof parse.reponse !== "string") throw new Error("assistant_ia_illisible");

  const action = ACTIONS_IA.includes(parse.action) ? parse.action : "aucune";
  return { reponse: parse.reponse.trim(), action: action === "aucune" ? null : action };
}
