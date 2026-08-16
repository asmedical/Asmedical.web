import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { raisonEchecConnexion, messageEchecConnexion, LIBELLE_RAISON } from "../lib/authErreurs.js";
import { raisonEchecConnexion as raisonApp } from "../mobile/src/authErreurs.js";

// Le compte de test remis à Apple ne pouvait pas se connecter : le service
// d'authentification plantait avant d'atteindre le mot de passe. Pendant
// cinq jours, l'application a répété à l'examinateur que son mot de passe
// était faux — et l'application a été refusée pour cette raison.
//
// Ces cas figent la règle : on n'accuse le mot de passe QUE lorsque rien
// n'indique le contraire.

// Chaque cas : ce que renvoie réellement Supabase (ou le réseau).
const CAS = [
  ["panne du service (500)", { status: 500, message: "Database error querying schema" }, "service"],
  ["panne interne annoncée par code", { code: "unexpected_failure", status: 500 }, "service"],
  ["colonne nulle en base", { status: 500, message: "converting NULL to string is unsupported" }, "service"],
  ["trop de tentatives", { status: 429, code: "over_request_rate_limit" }, "trop_de_tentatives"],
  ["email non confirmé", { status: 400, code: "email_not_confirmed" }, "email_non_confirme"],
  ["réseau coupé", { name: "TypeError", message: "Network request failed" }, "reseau"],
  ["réseau coupé (navigateur)", { name: "TypeError", message: "Failed to fetch" }, "reseau"],
  ["clés absentes du build", { message: "config" }, "config"],
  ["vrai mauvais mot de passe", { status: 400, code: "invalid_credentials" }, "identifiants"],
  ["nom d'utilisateur inconnu", { message: "resolution", status: 404 }, "identifiants"],
  ["erreur sans indice", { message: "boom" }, "identifiants"],
  ["rien du tout", null, "identifiants"],
];

describe("raison d'un échec de connexion", () => {
  for (const [nom, erreur, attendu] of CAS) {
    it(`${nom} → ${attendu}`, () => {
      expect(raisonEchecConnexion(erreur)).toBe(attendu);
    });
  }

  // C'est le cas qui a coûté la validation Apple : une panne de notre côté
  // ne doit jamais être présentée comme un mot de passe faux.
  it("ne met jamais une panne serveur sur le dos de l'utilisateur", () => {
    for (const statut of [500, 502, 503, 504]) {
      expect(raisonEchecConnexion({ status: statut }), String(statut)).toBe("service");
    }
  });

  it("chaque raison a un message à afficher", () => {
    for (const raison of new Set(CAS.map((c) => c[2]))) {
      expect(LIBELLE_RAISON[raison], raison).toBeTruthy();
    }
    expect(messageEchecConnexion({ status: 500 })).toBe("err_service");
    expect(messageEchecConnexion({ code: "invalid_credentials" })).toBe("err_identifiant");
  });
});

// L'application ne partage pas le dossier lib/ : elle en tient une copie.
// Deux copies qui divergent, ce sont deux comportements différents pour la
// même panne, du même côté de la même plateforme.
describe("le site et l'application classent pareil", () => {
  for (const [nom, erreur, attendu] of CAS) {
    it(nom, () => {
      expect(raisonApp(erreur)).toBe(attendu);
    });
  }
});

// Les deux écrans de connexion doivent se servir du classement, et de la
// même façon. Une des deux plateformes qui continue d'accuser le mot de
// passe, c'est exactement la situation qu'on vient de corriger.
describe("les deux écrans de connexion s'en servent", () => {
  const ECRANS = ["../mobile/src/screens/Connexion.js", "../app/connexion/page.js"];

  for (const chemin of ECRANS) {
    it(chemin.replace("../", ""), () => {
      const source = readFileSync(new URL(chemin, import.meta.url), "utf8");
      expect(source).toContain("messageEchecConnexion");
      // Réseau et configuration s'appliquent à tous les envois…
      expect(source).toContain('if (cle === "err_app_config" || cle === "err_reseau") return t(cle);');
      // …les autres précisions seulement à la connexion.
      expect(source).toContain('if (defaut === "err_identifiant" && cle !== "err_identifiant") return t(cle);');
    });
  }
});

// Les messages doivent exister dans les deux dictionnaires, et en arabe :
// un utilisateur arabophone devant un écran vide n'apprend rien du tout.
describe("les messages sont traduits partout", () => {
  const CLES = Object.values(LIBELLE_RAISON);

  for (const chemin of ["../lib/i18n.js", "../mobile/src/i18n.js"]) {
    it(`présents en français et en arabe dans ${chemin.replace("../", "")}`, () => {
      const source = readFileSync(new URL(chemin, import.meta.url), "utf8");
      for (const cle of CLES) {
        const occurrences = source.match(new RegExp(`^\\s{4}${cle}:\\s*"`, "gm")) || [];
        expect(occurrences.length, `${cle} dans ${chemin}`).toBe(2);
      }
    });
  }
});
