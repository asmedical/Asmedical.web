// Tests de la passerelle OAuth du serveur MCP.
// Lancer :  node scripts/tests/test-mcp-oauth.mjs
//
// Déroule exactement ce que fait claude.ai quand on ajoute le connecteur :
// métadonnées, enregistrement du client, page de phrase de passe, échange du
// code contre un jeton, puis appel relayé. Un maillon cassé dans cette
// chaîne ne produit aucune erreur lisible côté client — juste un retour à la
// page d'autorisation, indéfiniment.
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FICHIER_JETONS = path.join(os.tmpdir(), "essai-mcp-jetons.json");
const PORT = 8799;
const CIBLE = 8798; // volontairement vide : rien n'écoute derrière
const CIBLE_METRO = 8797; // faux serveur MCP, pour vérifier l'aiguillage
const BASE = `http://127.0.0.1:${PORT}`;
const PHRASE = "secret-essai";
const REDIR = "https://claude.ai/api/mcp/auth_callback";

const b64url = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let reussis = 0;
let echoues = 0;
function verifier(nom, condition) {
  if (condition) { reussis++; console.log(`  ok   ${nom}`); }
  else { echoues++; console.log(`  ÉCHEC ${nom}`); }
}

// Faux serveur MCP : il renvoie le chemin qu'il a reçu, ce qui suffit à
// prouver que le préfixe d'aiguillage a bien été retiré.
const faux = http.createServer((req, rep) => {
  rep.writeHead(200, { "Content-Type": "application/json" });
  rep.end(JSON.stringify({ recu: req.url }));
});
faux.listen(CIBLE_METRO, "127.0.0.1");

fs.rmSync(FICHIER_JETONS, { force: true });

function demarrer() {
  return spawn("node", ["tools/mcp-oauth-proxy.js"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      CIBLE_PORT: String(CIBLE),
      CIBLES: `metro:${CIBLE_METRO}`,
      MCP_BASE_URL: BASE,
      MCP_PASSPHRASE: PHRASE,
      MCP_JETONS: FICHIER_JETONS,
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
}

let passerelle = demarrer();

async function attendreDemarrage() {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`${BASE}/.well-known/oauth-authorization-server`);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return false;
}

try {
  if (!(await attendreDemarrage())) throw new Error("la passerelle n'a pas démarré");

  const verif = b64url(crypto.randomBytes(32));
  const defi = b64url(crypto.createHash("sha256").update(verif).digest());

  console.log("\nMétadonnées");
  // L'adresse du connecteur porte un chemin (.../mcp). La ressource annoncée
  // doit être CETTE adresse : si elle renvoie la racine, le client considère
  // que le jeton ne vaut pas pour ce qu'il demande et redemande l'accès.
  const res = await (await fetch(`${BASE}/.well-known/oauth-protected-resource/mcp`)).json();
  verifier("la ressource annoncée est l'adresse demandée", res.resource === `${BASE}/mcp`);
  verifier("le serveur d'autorisation est indiqué", res.authorization_servers?.[0] === BASE);

  const meta = await (await fetch(`${BASE}/.well-known/oauth-authorization-server`)).json();
  verifier("adresse d'autorisation", meta.authorization_endpoint === `${BASE}/authorize`);
  verifier("adresse du jeton", meta.token_endpoint === `${BASE}/token`);
  verifier("PKCE en SHA-256 annoncé", meta.code_challenge_methods_supported?.includes("S256"));

  console.log("\nEnregistrement du client");
  const inscr = await (await fetch(`${BASE}/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ redirect_uris: [REDIR] }),
  })).json();
  verifier("un identifiant de client est délivré", !!inscr.client_id);

  console.log("\nPage d'autorisation");
  const q = new URLSearchParams({
    client_id: inscr.client_id,
    redirect_uri: REDIR,
    response_type: "code",
    code_challenge: defi,
    code_challenge_method: "S256",
    state: "abc&def",
    resource: `${BASE}/mcp`,
  });
  const page = await (await fetch(`${BASE}/authorize?${q}`)).text();
  verifier("le champ de phrase de passe est présent", page.includes('name="phrase"'));
  // Sans ce report, le formulaire renvoie une demande amputée : la
  // passerelle n'a plus d'adresse de retour, et la page se rouvre.
  verifier("l'adresse de retour est reportée dans le formulaire", page.includes(REDIR));

  const refus = await fetch(`${BASE}/authorize`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...Object.fromEntries(q), phrase: "faux" }),
    redirect: "manual",
  });
  verifier("une phrase fausse est refusée", refus.status === 401);

  // Les claviers de téléphone ajoutent une espace après un mot de passe
  // collé. Elle est invisible et rendrait la phrase fausse.
  const ok = await fetch(`${BASE}/authorize`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...Object.fromEntries(q), phrase: ` ${PHRASE} ` }),
    redirect: "manual",
  });
  verifier("la bonne phrase est acceptée malgré une espace", ok.status === 302);
  const dest = new URL(ok.headers.get("location") || BASE);
  verifier("le navigateur repart vers le client", dest.origin + dest.pathname === REDIR);
  verifier("un code est joint", !!dest.searchParams.get("code"));
  verifier("l'état est rendu intact", dest.searchParams.get("state") === "abc&def");

  console.log("\nJeton");
  const corpsJeton = new URLSearchParams({
    grant_type: "authorization_code",
    code: dest.searchParams.get("code") || "",
    redirect_uri: REDIR,
    client_id: inscr.client_id,
  });
  const mauvais = await (await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...Object.fromEntries(corpsJeton), code_verifier: "mauvais" }),
  })).json();
  verifier("un vérificateur PKCE incorrect est rejeté", mauvais.error === "invalid_grant");

  // Le code a été consommé par la tentative précédente : il en faut un neuf.
  const ok2 = await fetch(`${BASE}/authorize`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...Object.fromEntries(q), phrase: PHRASE }),
    redirect: "manual",
  });
  const code2 = new URL(ok2.headers.get("location")).searchParams.get("code");
  const jeton = await (await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...Object.fromEntries(corpsJeton), code: code2, code_verifier: verif }),
  })).json();
  verifier("un jeton d'accès est délivré", !!jeton.access_token);

  const rejoue = await (await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...Object.fromEntries(corpsJeton), code: code2, code_verifier: verif }),
  })).json();
  verifier("un code ne sert qu'une fois", rejoue.error === "invalid_grant");

  console.log("\nAccès au serveur MCP");
  const sans = await fetch(`${BASE}/mcp`, { method: "POST", body: "{}" });
  verifier("l'accès est refusé sans jeton", sans.status === 401);
  verifier(
    "le refus indique où s'authentifier",
    (sans.headers.get("www-authenticate") || "").includes("oauth-protected-resource")
  );

  // Rien n'écoute sur le port cible pendant l'essai : un 502 prouve que le
  // jeton a été accepté et la requête relayée.
  const avec = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: { authorization: `Bearer ${jeton.access_token}`, "content-type": "application/json" },
    body: "{}",
  });
  verifier("avec un jeton valide, la requête est relayée", avec.status === 502);

  console.log("\nPlusieurs serveurs MCP sur la même adresse");
  const entetes = { authorization: `Bearer ${jeton.access_token}` };
  // Le préfixe /metro sert à choisir le serveur ; il ne doit PAS être
  // transmis, sinon le serveur MCP ne reconnaît pas son propre chemin.
  const r1 = await (await fetch(`${BASE}/metro/mcp`, { headers: entetes })).json();
  verifier("le préfixe d'aiguillage est retiré", r1.recu === "/mcp");
  const r2 = await (await fetch(`${BASE}/metro/mcp?session=42`, { headers: entetes })).json();
  verifier("les paramètres d'adresse sont conservés", r2.recu === "/mcp?session=42");
  const r3 = await (await fetch(`${BASE}/metro`, { headers: entetes })).json();
  verifier("le préfixe seul mène à la racine du serveur", r3.recu === "/");
  // Un nom inconnu ne doit pas être avalé comme un préfixe : il appartient
  // au serveur par défaut, qui ici ne répond pas.
  const r4 = await fetch(`${BASE}/mcp`, { headers: entetes });
  verifier("un chemin inconnu reste sur le serveur par défaut", r4.status === 502);

  const meta2 = await (await fetch(`${BASE}/.well-known/oauth-protected-resource/metro/mcp`)).json();
  verifier("la ressource annoncée garde le préfixe", meta2.resource === `${BASE}/metro/mcp`);

  console.log("\nSurvie au redémarrage");
  // Ajouter un serveur MCP oblige à redémarrer la passerelle. Si les jetons
  // n'y survivent pas, TOUS les connecteurs déjà en place se retrouvent
  // déconnectés d'un coup, sans autre signe qu'un retour à la phrase de passe.
  passerelle.kill();
  await new Promise((r) => passerelle.once("exit", r));
  passerelle = demarrer();
  await attendreDemarrage();
  const apres = await (await fetch(`${BASE}/metro/mcp`, { headers: entetes })).json();
  verifier("le jeton reste valable après un redémarrage", apres.recu === "/mcp");

  const droits = fs.statSync(FICHIER_JETONS).mode & 0o777;
  verifier("le fichier de jetons n'est lisible que par son propriétaire", droits === 0o600);

  // Un jeton périmé ne doit pas ressusciter au chargement du fichier.
  fs.writeFileSync(FICHIER_JETONS, JSON.stringify({ perime: Date.now() - 1000 }));
  passerelle.kill();
  await new Promise((r) => passerelle.once("exit", r));
  passerelle = demarrer();
  await attendreDemarrage();
  const vieux = await fetch(`${BASE}/metro/mcp`, { headers: { authorization: "Bearer perime" } });
  verifier("un jeton expiré est refusé au redémarrage", vieux.status === 401);
} catch (e) {
  echoues++;
  console.log(`  ÉCHEC imprévu : ${e.message}`);
} finally {
  passerelle.kill();
  faux.close();
  fs.rmSync(FICHIER_JETONS, { force: true });
}

console.log(`\n${reussis} réussis, ${echoues} échoués`);
process.exit(echoues ? 1 : 0);
