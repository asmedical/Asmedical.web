import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { telephoneVerifie } from "../lib/telephones.js";

// Sur cette plateforme, le numéro de téléphone sert à retrouver les demandes
// passées sans compte. Deux numéros existent pourtant : celui que Supabase a
// vérifié par code, et `profil.telephone`, un champ libre que chacun modifie
// sur son propre compte.
//
// Fonder un accès sur le second laissait n'importe qui saisir le numéro d'un
// autre patient et voir ses trajets, ses préférences et sa position en
// direct — et, sur modifier-trajet, changer sa destination.

// Routes où le numéro décide de ce qu'on a le droit de voir ou de modifier.
const ACCES = [
  "app/api/mes-demandes/route.js",
  "app/api/assistant/route.js",
  "app/api/avis/route.js",
  "app/api/geo/route.js",
  "app/api/preferences/route.js",
  "app/api/rattachements/route.js",
  "app/api/signalement/route.js",
  "app/api/renouveler/route.js",
  "app/api/paiement/route.js",
  "app/api/demandes/modifier-trajet/route.js",
  "app/api/demandes/retour-pret/route.js",
];

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");

describe("le numéro vérifié", () => {
  it("est celui du compte, jamais un champ déclaré", () => {
    expect(telephoneVerifie({ phone: "+213555443322" })).toBe("+213555443322");
  });

  // Un compte créé par e-mail n'a pas de numéro vérifié. Il ne doit alors
  // rien retrouver par téléphone — surtout pas ce qu'il déclare.
  it("est vide quand le compte n'en a pas", () => {
    expect(telephoneVerifie({})).toBe("");
    expect(telephoneVerifie(null)).toBe("");
    expect(telephoneVerifie({ telephone: "0555443322" })).toBe("");
  });
});

describe("aucun accès fondé sur un numéro déclaré", () => {
  for (const chemin of ACCES) {
    it(chemin.replace("app/api/", "").replace("/route.js", ""), () => {
      const source = lire(chemin);
      // `profil.telephone` ne doit plus apparaître dans ces routes : il n'y
      // servait qu'à décider d'un droit.
      const fautes = source
        .split("\n")
        .map((l, i) => [i + 1, l])
        .filter(([, l]) => /profil\??\.telephone/.test(l) && !l.trim().startsWith("//"));
      expect(fautes.map(([n, l]) => `${n}: ${l.trim()}`)).toEqual([]);
    });
  }

  // La règle doit rester énoncée en un seul endroit, sinon elle se perd.
  it("la règle est expliquée là où elle s'applique", () => {
    const source = lire("lib/telephones.js");
    expect(source).toContain("export function telephoneVerifie");
    expect(source).toMatch(/champ libre|vérifi/i);
  });
});
