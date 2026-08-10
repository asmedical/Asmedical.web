import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Parité des traductions, vérifiée en intégration continue plutôt que par un
// script réécrit à chaque fois — l'un d'eux s'est d'ailleurs trompé en
// prenant la clé « pc_trajet_ar » pour le début du dictionnaire arabe.
//
// Deux dictionnaires à tenir alignés : celui du site et celui de
// l'application. Une clé traduite d'un seul côté produit, chez l'utilisateur,
// un écran à moitié en français et à moitié vide.

function dictionnaires(chemin) {
  const s = readFileSync(new URL(chemin, import.meta.url), "utf8");
  // Ancre stricte sur la déclaration de bloc, jamais sur « fr: » ou « ar: »
  // qui apparaissent aussi à l'intérieur de noms de clés.
  const bloc = (langue) => {
    const debut = s.indexOf(`\n  ${langue}: {`);
    if (debut < 0) throw new Error(`bloc ${langue} introuvable dans ${chemin}`);
    return s.slice(debut, s.indexOf("\n  },", debut));
  };
  const cles = (langue) =>
    new Set([...bloc(langue).matchAll(/^\s{4}([a-zA-Z0-9_]+):\s*"/gm)].map((m) => m[1]));
  return { fr: cles("fr"), ar: cles("ar") };
}

const SITE = dictionnaires("../lib/i18n.js");
const APP = dictionnaires("../mobile/src/i18n.js");

describe("traductions du site", () => {
  it("chaque clé française a sa traduction arabe", () => {
    expect([...SITE.fr].filter((k) => !SITE.ar.has(k))).toEqual([]);
  });
  it("aucune clé arabe orpheline", () => {
    expect([...SITE.ar].filter((k) => !SITE.fr.has(k))).toEqual([]);
  });
});

describe("traductions de l'application", () => {
  it("chaque clé française a sa traduction arabe", () => {
    expect([...APP.fr].filter((k) => !APP.ar.has(k))).toEqual([]);
  });
  it("aucune clé arabe orpheline", () => {
    expect([...APP.ar].filter((k) => !APP.fr.has(k))).toEqual([]);
  });
});

describe("parcours de réservation", () => {
  const source = readFileSync(new URL("../lib/parcours.js", import.meta.url), "utf8");
  const utilisees = [...new Set([...source.matchAll(/"(pc_[a-z0-9_]+)"/g)].map((m) => m[1]))];

  it("la définition du parcours référence bien des libellés", () => {
    expect(utilisees.length).toBeGreaterThan(20);
  });

  // Le site importe lib/parcours.js, l'application la reçoit par
  // /api/parcours : les deux affichent donc les MÊMES clés. Si l'une des
  // deux ne les traduit pas, l'écran est vide de ce côté-là seulement.
  it("tous ses libellés existent dans le dictionnaire du site", () => {
    expect(utilisees.filter((k) => !SITE.fr.has(k))).toEqual([]);
  });
  it("tous ses libellés existent dans le dictionnaire de l'application", () => {
    expect(utilisees.filter((k) => !APP.fr.has(k))).toEqual([]);
  });
});
