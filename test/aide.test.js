import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { AIDE, LANGUES } from "../lib/aide.js";

// La page d'assistance est l'adresse déclarée aux stores : elle doit rester
// joignable et complète dans les trois langues. Une traduction oubliée n'y
// provoque aucune erreur — elle laisse simplement un visiteur arabophone ou
// un examinateur anglophone devant une page à trous.

const CLES = ["fr", "ar", "en"];

describe("page d'assistance", () => {
  it("existe dans les trois langues annoncées", () => {
    expect(LANGUES.map((l) => l.cle)).toEqual(CLES);
    for (const c of CLES) expect(AIDE[c], c).toBeTruthy();
  });

  it("porte exactement les mêmes rubriques d'une langue à l'autre", () => {
    const reference = Object.keys(AIDE.fr).sort();
    for (const c of CLES) expect(Object.keys(AIDE[c]).sort(), c).toEqual(reference);
  });

  it("ne laisse aucun texte vide", () => {
    for (const c of CLES) {
      for (const [cle, valeur] of Object.entries(AIDE[c])) {
        if (typeof valeur === "string") expect(valeur.trim(), `${c}.${cle}`).not.toBe("");
      }
    }
  });

  it("pose les mêmes questions, dans le même ordre, avec les mêmes liens", () => {
    const ref = AIDE.fr.sujets;
    for (const c of CLES) {
      const s = AIDE[c].sujets;
      expect(s.length, c).toBe(ref.length);
      s.forEach((x, i) => {
        expect(x.q?.trim(), `${c}.sujets[${i}].q`).toBeTruthy();
        expect(x.r?.trim(), `${c}.sujets[${i}].r`).toBeTruthy();
        // Le lien doit accompagner la même question partout : une réponse qui
        // renvoie ailleurs selon la langue est pire qu'une absence de lien.
        expect(x.lien, `${c}.sujets[${i}].lien`).toBe(ref[i].lien);
        if (x.lien) expect(x.lien_l?.trim(), `${c}.sujets[${i}].lien_l`).toBeTruthy();
      });
    }
  });

  // Ces pages sont citées comme recours : un lien mort y serait un cul-de-sac
  // pour quelqu'un qui cherche à supprimer son compte ou à lire ses droits.
  it("ne renvoie que vers des pages qui existent", () => {
    for (const s of AIDE.fr.sujets) {
      if (!s.lien) continue;
      expect(fs.existsSync(`app${s.lien}/page.js`), s.lien).toBe(true);
    }
  });

  it("donne les numéros d'urgence algériens dans les trois langues", () => {
    for (const c of CLES) {
      expect(AIDE[c].urgence_p, c).toContain("115");
      expect(AIDE[c].urgence_p, c).toContain("14");
    }
  });
});
