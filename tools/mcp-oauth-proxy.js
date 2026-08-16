#!/usr/bin/env node
// Passerelle OAuth devant un serveur MCP local (Maestro, exposé par
// supergateway sur 127.0.0.1:8765).
//
// Pourquoi : claude.ai refuse d'ajouter un connecteur distant qui n'expose
// aucun service d'authentification. Il cherche les métadonnées OAuth, tente
// un enregistrement dynamique de client, puis un échange de jeton. Un
// serveur MCP nu ne répond à rien de tout cela — d'où le message
// « Impossible de s'inscrire auprès du service de connexion ».
//
// Ce fichier implémente le strict nécessaire du protocole (OAuth 2.1 avec
// PKCE et enregistrement dynamique), puis relaie tout le reste au serveur
// MCP local. Aucune dépendance : uniquement les modules de Node.
//
// L'accès est protégé par une phrase de passe, demandée UNE fois au moment
// d'ajouter le connecteur. Sans elle, l'adresse publique du tunnel donnerait
// le contrôle de l'émulateur à quiconque la connaît.
//
// Utilisation :
//   MCP_BASE_URL=https://xxx.trycloudflare.com \
//   MCP_PASSPHRASE=une_phrase_a_vous \
//   node tools/mcp-oauth-proxy.js
//
// Variables facultatives : PORT (8766), CIBLE_PORT (8765).

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 8766);
const CIBLE_PORT = Number(process.env.CIBLE_PORT || 8765);

// Plusieurs serveurs MCP derrière la MÊME adresse et la même phrase de
// passe, distingués par le premier segment du chemin :
//
//   CIBLES="maestro:8765,metro:8767"
//   https://mcp.asm-sante.com/metro/mcp  ->  127.0.0.1:8767/mcp
//
// Un sous-domaine par serveur imposerait un enregistrement DNS et un
// certificat de plus à chaque fois. Ici, ajouter un serveur ne coûte qu'une
// entrée dans cette liste. Sans CIBLES, tout part vers CIBLE_PORT : les
// installations existantes ne changent pas de comportement.
const CIBLES = new Map(
  (process.env.CIBLES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [nom, port] = s.split(":");
      return [nom, Number(port)];
    })
    .filter(([nom, port]) => nom && Number.isInteger(port))
);

// Aiguillage : renvoie le port visé et le chemin tel que le serveur MCP
// l'attend, préfixe retiré.
function aiguiller(chemin) {
  const m = chemin.match(/^\/([^/?]+)(\/.*)?$/);
  if (m && CIBLES.has(m[1])) return { port: CIBLES.get(m[1]), chemin: m[2] || "/" };
  return { port: CIBLE_PORT, chemin };
}
const BASE = (process.env.MCP_BASE_URL || "").replace(/\/+$/, "");
const PHRASE = process.env.MCP_PASSPHRASE || "";

if (!BASE || !PHRASE) {
  console.error("MCP_BASE_URL et MCP_PASSPHRASE sont obligatoires.");
  process.exit(1);
}

// Clients et codes restent en mémoire : ils ne servent que le temps d'une
// autorisation, et rien ne justifie qu'ils survivent au processus.
const clients = new Map(); // client_id -> { redirect_uris }
const codes = new Map(); // code -> { client_id, redirect_uri, defi, expire }

// Les jetons, eux, sont gardés sur disque. En mémoire seule, le moindre
// redémarrage de la passerelle — ajout d'un serveur MCP, mise à jour du
// code — déconnectait TOUS les connecteurs d'un coup, sans prévenir : ils
// se contentent de redemander la phrase de passe. Le fichier est en 0600 et
// ne contient que des jetons, jamais la phrase.
const FICHIER_JETONS = process.env.MCP_JETONS || path.join(os.homedir(), ".asm-mcp-jetons.json");
const DUREE_JETON = 30 * 24 * 60 * 60 * 1000;

function chargerJetons() {
  try {
    const brut = JSON.parse(fs.readFileSync(FICHIER_JETONS, "utf8"));
    const vivants = Object.entries(brut).filter(([, expire]) => expire > Date.now());
    return new Map(vivants);
  } catch {
    return new Map(); // premier démarrage, ou fichier illisible
  }
}

const jetons = chargerJetons(); // jeton -> date d'expiration

function enregistrerJetons() {
  try {
    fs.writeFileSync(FICHIER_JETONS, JSON.stringify(Object.fromEntries(jetons)), { mode: 0o600 });
  } catch (e) {
    // Ne pas refuser le jeton pour autant : la session en cours doit
    // fonctionner, quitte à être perdue au prochain redémarrage.
    console.warn(`Jetons non enregistrés (${FICHIER_JETONS}) : ${e.message}`);
  }
}

function jetonValide(jeton) {
  const expire = jetons.get(jeton);
  if (!expire) return false;
  if (expire <= Date.now()) {
    jetons.delete(jeton);
    enregistrerJetons();
    return false;
  }
  return true;
}

const b64url = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const alea = () => b64url(crypto.randomBytes(32));

function json(rep, code, corps, entetes = {}) {
  const texte = JSON.stringify(corps);
  rep.writeHead(code, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    ...entetes,
  });
  rep.end(texte);
}

// Journal d'une ligne par requête. Sans lui, une boucle d'autorisation est
// impossible à diagnostiquer : on voit le formulaire revenir, sans savoir si
// c'est la phrase qui est refusée, le code qui est perdu, ou le serveur MCP
// qui répond mal derrière. Aucune donnée sensible n'y figure.
function journaliser(req, rep, note) {
  const debut = Date.now();
  rep.on("finish", () => {
    const chemin = req.url.split("?")[0];
    console.log(
      `${req.method} ${chemin} -> ${rep.statusCode} (${Date.now() - debut}ms)` +
        (note.texte ? ` ${note.texte}` : "")
    );
  });
}

function lireCorps(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => resolve(d));
  });
}

function analyser(texte, type) {
  if (!texte) return {};
  if ((type || "").includes("json")) {
    try { return JSON.parse(texte); } catch { return {}; }
  }
  return Object.fromEntries(new URLSearchParams(texte));
}

// Page de saisie de la phrase de passe. Volontairement dépouillée : elle
// n'apparaît qu'une fois, dans un onglet ouvert par claude.ai.
function pageAutorisation(params, erreur) {
  const champs = Object.entries(params)
    .map(([c, v]) => `<input type="hidden" name="${c}" value="${String(v).replace(/"/g, "&quot;")}">`)
    .join("");
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ASM — autorisation</title>
<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:12vh auto;padding:0 20px;color:#14311f}
h1{font-size:20px;color:#0E6B3F}input[type=password]{width:100%;padding:14px;font-size:16px;border:1px solid #ccd6cf;border-radius:10px}
button{width:100%;margin-top:12px;padding:14px;font-size:16px;font-weight:700;color:#fff;background:#0E6B3F;border:0;border-radius:10px}
p.err{color:#B03A3A;font-weight:600}</style>
<h1>Connexion à Maestro ASM</h1>
<p>Saisissez la phrase de passe pour autoriser Claude à piloter l'émulateur.</p>
${erreur ? '<p class="err">Phrase incorrecte.</p>' : ""}
<form method="POST">${champs}
<input type="password" name="phrase" autofocus autocomplete="current-password" placeholder="Phrase de passe">
<button type="submit">Autoriser</button></form>`;
}

async function traiter(req, rep, note) {
  const u = new URL(req.url, BASE);
  const chemin = u.pathname;

  if (req.method === "OPTIONS") return json(rep, 204, {});

  // --- Métadonnées : c'est ce que claude.ai interroge en premier.
  //
  // Le connecteur pointe sur une adresse qui peut avoir un chemin
  // (.../mcp). La ressource annoncée doit alors être CETTE adresse, pas la
  // racine : le client compare les deux, et une ressource qui ne correspond
  // pas à celle qu'il a demandée le renvoie à l'autorisation — en boucle.
  const RES = "/.well-known/oauth-protected-resource";
  if (chemin === RES || chemin.startsWith(RES + "/")) {
    return json(rep, 200, {
      resource: BASE + chemin.slice(RES.length),
      authorization_servers: [BASE],
    });
  }
  if (chemin === "/.well-known/oauth-authorization-server" ||
      chemin === "/.well-known/openid-configuration" ||
      chemin.startsWith("/.well-known/oauth-authorization-server/")) {
    return json(rep, 200, {
      issuer: BASE,
      authorization_endpoint: `${BASE}/authorize`,
      token_endpoint: `${BASE}/token`,
      registration_endpoint: `${BASE}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["mcp"],
    });
  }

  // --- Enregistrement dynamique du client (RFC 7591).
  if (chemin === "/register" && req.method === "POST") {
    const corps = analyser(await lireCorps(req), req.headers["content-type"]);
    const client_id = alea();
    clients.set(client_id, { redirect_uris: corps.redirect_uris || [] });
    return json(rep, 201, {
      client_id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: corps.redirect_uris || [],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    });
  }

  // --- Autorisation : formulaire, puis redirection avec le code.
  if (chemin === "/authorize") {
    if (req.method === "GET") {
      const p = Object.fromEntries(u.searchParams.entries());
      rep.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return rep.end(pageAutorisation(p, false));
    }
    if (req.method === "POST") {
      const p = analyser(await lireCorps(req), req.headers["content-type"]);
      // Les claviers de téléphone ajoutent volontiers une espace après un
      // mot de passe collé ou complété. Elle rendrait la phrase fausse sans
      // que rien ne soit visible à l'écran.
      const attendue = Buffer.from(PHRASE.trim());
      const fournie = Buffer.from(String(p.phrase || "").trim());
      const bonne =
        attendue.length === fournie.length && crypto.timingSafeEqual(attendue, fournie);
      if (!bonne) {
        delete p.phrase;
        note.texte = "phrase refusée";
        rep.writeHead(401, { "Content-Type": "text/html; charset=utf-8" });
        return rep.end(pageAutorisation(p, true));
      }
      // Sans adresse de retour, il n'y a nulle part où renvoyer le code :
      // le navigateur resterait sur une page blanche, ce qui ressemble
      // exactement à une boucle.
      if (!p.redirect_uri) {
        note.texte = "redirect_uri absente";
        rep.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        return rep.end("<!doctype html><meta charset=utf-8><p>Adresse de retour manquante.");
      }
      const code = alea();
      codes.set(code, {
        client_id: p.client_id,
        redirect_uri: p.redirect_uri,
        defi: p.code_challenge || "",
        expire: Date.now() + 5 * 60 * 1000,
      });
      const dest = new URL(p.redirect_uri);
      dest.searchParams.set("code", code);
      if (p.state) dest.searchParams.set("state", p.state);
      note.texte = `code délivré -> ${dest.origin}${dest.pathname}`;
      rep.writeHead(302, { Location: dest.toString() });
      return rep.end();
    }
  }

  // --- Échange du code contre un jeton, avec vérification PKCE.
  if (chemin === "/token" && req.method === "POST") {
    const p = analyser(await lireCorps(req), req.headers["content-type"]);
    const enr = codes.get(p.code);
    codes.delete(p.code);
    if (!enr || enr.expire < Date.now()) {
      note.texte = enr ? "code expiré" : "code inconnu";
      return json(rep, 400, { error: "invalid_grant" });
    }
    if (enr.defi) {
      const calcule = b64url(crypto.createHash("sha256").update(String(p.code_verifier || "")).digest());
      if (calcule !== enr.defi) {
        note.texte = "vérificateur PKCE incorrect";
        return json(rep, 400, { error: "invalid_grant" });
      }
    }
    note.texte = "jeton délivré";
    const jeton = alea();
    jetons.set(jeton, Date.now() + DUREE_JETON);
    enregistrerJetons();
    return json(rep, 200, {
      access_token: jeton,
      token_type: "Bearer",
      expires_in: Math.floor(DUREE_JETON / 1000),
      scope: "mcp",
    });
  }

  // --- Tout le reste appartient au serveur MCP : jeton exigé.
  const entete = req.headers.authorization || "";
  const jeton = entete.replace(/^Bearer\s+/i, "");
  if (!jetonValide(jeton)) {
    note.texte = jeton ? "jeton inconnu (redemande d'autorisation)" : "aucun jeton";
    return json(rep, 401, { error: "invalid_token" }, {
      "WWW-Authenticate": `Bearer resource_metadata="${BASE}/.well-known/oauth-protected-resource"`,
    });
  }

  // Relais vers le serveur MCP local. Le flux SSE doit rester ouvert : on
  // se contente de tuyauter, sans jamais mettre en tampon.
  const vers = aiguiller(chemin);
  const requete = u.search || "";
  const entetes = { ...req.headers };
  delete entetes.authorization;
  entetes.host = `127.0.0.1:${vers.port}`;
  const amont = http.request(
    { host: "127.0.0.1", port: vers.port, path: vers.chemin + requete, method: req.method, headers: entetes },
    (r) => {
      note.texte = `MCP ${vers.port}${vers.chemin} a répondu ${r.statusCode}`;
      rep.writeHead(r.statusCode || 502, r.headers);
      r.pipe(rep);
    }
  );
  amont.on("error", (e) => {
    note.texte = `MCP ${vers.port} injoignable : ${e.message}`;
    if (!rep.headersSent) json(rep, 502, { error: "mcp_indisponible", detail: String(e.message) });
    else rep.end();
  });
  req.pipe(amont);
}

// Une exception non rattrapée dans le traitement laissait la requête sans
// réponse : le navigateur tourne dans le vide, ce qui se lit comme une
// boucle. On répond toujours, et on l'écrit dans le journal.
const serveur = http.createServer((req, rep) => {
  const note = { texte: "" };
  journaliser(req, rep, note);
  traiter(req, rep, note).catch((e) => {
    note.texte = `erreur : ${e.message}`;
    if (!rep.headersSent) json(rep, 500, { error: "erreur_passerelle" });
    else rep.end();
  });
});

serveur.listen(PORT, "127.0.0.1", () => {
  console.log(`Passerelle OAuth sur http://127.0.0.1:${PORT}`);
  console.log(`Adresse publique annoncée : ${BASE}`);
  console.log(`Serveur MCP par défaut : http://127.0.0.1:${CIBLE_PORT}`);
  for (const [nom, port] of CIBLES) {
    console.log(`  ${BASE}/${nom}/…  ->  http://127.0.0.1:${port}/…`);
  }
});
