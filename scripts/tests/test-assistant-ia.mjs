// Test du cerveau IA de l'assistant (lib/assistantIA.js). On stub global.fetch
// pour ne PAS appeler l'API réelle : on vérifie la config, le contexte injecté,
// le parsing structuré { reponse, action } et la liste blanche des actions.
// lib/assistantIA.js n'importe rien en @/ → import direct sans adaptateur.

let ok = 0, ko = 0;
const verif = (nom, cond) => {
  if (cond) { ok++; console.log("  ✓ " + nom); }
  else { ko++; console.log("  ✗ ECHEC: " + nom); }
};

const M = await import(process.cwd() + "/lib/assistantIA.js");

// --- 1. Configuration pilotée par la variable d'environnement ---
delete process.env.ANTHROPIC_API_KEY;
verif("sans clé → assistant IA non configuré", M.assistantIAConfigure() === false);
process.env.ANTHROPIC_API_KEY = "sk-test-xxx";
verif("avec clé → assistant IA configuré", M.assistantIAConfigure() === true);

// --- 2. Contexte client (injecté côté serveur) ---
const ctx = M.contexteClient({
  prenom: "Yasmine",
  demandes: [
    { id: 12, service: "transport", statut: "EN_COURS", date: "2026-07-20" },
    { id: 9, service: "domicile", statut: "TERMINEE" },
  ],
});
verif("le contexte cite le prénom", ctx.includes("Yasmine"));
verif("le contexte liste la demande #12 EN_COURS", ctx.includes("#12") && ctx.includes("EN_COURS"));
verif("contexte vide → mention « pas de demande »",
  M.contexteClient({ demandes: [] }).includes("pas de demande"));

// --- 3. Liste blanche d'actions ---
verif("les actions clés sont autorisées",
  ["rdv", "suivi", "paiements", "appeler", "aucune"].every((a) => M.ACTIONS_IA.includes(a)));

// --- 4. Appel IA : on stub fetch pour simuler la passerelle ---
const stub = (payload, { statut = 200, stop } = {}) => {
  global.fetch = async () => ({
    ok: statut >= 200 && statut < 300,
    status: statut,
    json: async () => ({
      stop_reason: stop || "end_turn",
      content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload) }],
    }),
  });
};

// 4a. Réponse structurée propre → renvoyée telle quelle.
stub({ reponse: "Votre course est en route.", action: "suivi" });
let r = await M.demanderIA({ message: "où est mon chauffeur ?", langue: "fr" });
verif("réponse IA lisible → { reponse, action } renvoyés",
  r.reponse === "Votre course est en route." && r.action === "suivi");

// 4b. Action hors liste blanche → neutralisée (aucun bouton douteux).
stub({ reponse: "ok", action: "supprimer_base" });
r = await M.demanderIA({ message: "x", langue: "fr" });
verif("action inconnue → ramenée à null (sécurité)", r.action === null);

// 4c. action "aucune" → pas de bouton.
stub({ reponse: "Bonjour !", action: "aucune" });
r = await M.demanderIA({ message: "salam", langue: "fr" });
verif("action « aucune » → null", r.action === null && r.reponse === "Bonjour !");

// 4d. JSON entouré de texte → extrait quand même.
stub('Voici: {"reponse":"Salut","action":"rdv"} merci');
r = await M.demanderIA({ message: "y", langue: "fr" });
verif("JSON noyé dans du texte → extrait", r.reponse === "Salut" && r.action === "rdv");

// 4e. Refus de l'IA → erreur (l'appelant retombera sur le moteur guidé).
stub({ reponse: "x", action: "aucune" }, { stop: "refusal" });
let leve = false;
try { await M.demanderIA({ message: "z", langue: "fr" }); } catch { leve = true; }
verif("refus IA → lève une erreur (repli côté route)", leve);

// 4f. Erreur HTTP → erreur.
stub({}, { statut: 500 });
leve = false;
try { await M.demanderIA({ message: "z", langue: "fr" }); } catch { leve = true; }
verif("erreur HTTP → lève une erreur (repli côté route)", leve);

// 4g. Sans clé → lève immédiatement (pas d'appel réseau).
delete process.env.ANTHROPIC_API_KEY;
leve = false;
try { await M.demanderIA({ message: "z", langue: "fr" }); } catch { leve = true; }
verif("sans clé → lève sans appeler le réseau", leve);

console.log(`\nRésultat : ${ok} OK / ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
