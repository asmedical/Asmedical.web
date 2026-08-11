import { describe, it, expect } from "vitest";
import { POLITIQUE, PRIMAUTE, LANGUES, SECTIONS, MAJ, RESUME_AR } from "../lib/confidentialite.js";

// La politique de confidentialité est déclarée à Apple et à Google Play. Une
// section absente d'une traduction ne provoque aucune erreur : elle laisse
// simplement un lecteur arabophone ou anglophone sans l'information qu'on
// s'est engagé à lui donner.

const CLES = ["fr", "ar", "en"];

describe("politique de confidentialité", () => {
  it("existe dans les trois langues annoncées", () => {
    expect(LANGUES.map((l) => l.cle)).toEqual(CLES);
    for (const c of CLES) expect(POLITIQUE[c], c).toBeTruthy();
  });

  it("compte les mêmes sections partout, dans le même ordre", () => {
    const n = POLITIQUE.fr.sections.length;
    expect(n).toBeGreaterThan(5);
    for (const c of CLES) {
      expect(POLITIQUE[c].sections.length, c).toBe(n);
      POLITIQUE[c].sections.forEach((s, i) => {
        // Les titres sont numérotés : le même numéro doit désigner la même
        // section d'une langue à l'autre, sinon les renvois se contredisent.
        expect(s.titre.match(/^\d+/)?.[0], `${c}[${i}]`).toBe(String(i + 1));
      });
    }
  });

  it("garde la même structure de listes et de paragraphes", () => {
    const ref = POLITIQUE.fr.sections;
    for (const c of CLES) {
      POLITIQUE[c].sections.forEach((s, i) => {
        expect((s.points || []).length, `${c}[${i}].points`).toBe((ref[i].points || []).length);
        expect((s.paragraphes || []).length, `${c}[${i}].paragraphes`).toBe((ref[i].paragraphes || []).length);
        (s.points || []).forEach((pt, j) => {
          expect(pt.texte?.trim(), `${c}[${i}].points[${j}]`).toBeTruthy();
          // Un intitulé en gras présent d'un côté et absent de l'autre
          // change la lecture du document.
          expect(!!pt.fort, `${c}[${i}].points[${j}].fort`).toBe(!!(ref[i].points || [])[j]?.fort);
        });
        (s.paragraphes || []).forEach((p, j) => {
          expect(p.trim(), `${c}[${i}].paragraphes[${j}]`).toBeTruthy();
        });
      });
    }
  });

  it("dit sur les traductions que le français fait foi", () => {
    expect(PRIMAUTE.ar?.trim()).toBeTruthy();
    expect(PRIMAUTE.en?.trim()).toBeTruthy();
    // Le français est l'original : il ne porte pas cette mention.
    expect(PRIMAUTE.fr).toBeUndefined();
  });

  it("répète les recours concrets dans les trois langues", () => {
    for (const c of CLES) {
      const texte = JSON.stringify(POLITIQUE[c]);
      expect(texte, c).toContain("contact@asm-sante.com");
      expect(texte, c).toContain("asm-sante.com/suppression-compte");
      expect(texte, c).toContain("30");
    }
  });

  // /api/confidentialite sert ces trois champs à l'application DÉJÀ
  // installée. En changer la forme casserait les versions en circulation,
  // sans que rien ne le signale au moment du déploiement.
  it("préserve le contrat attendu par les applications déjà installées", () => {
    expect(typeof MAJ).toBe("string");
    expect(typeof RESUME_AR).toBe("string");
    expect(SECTIONS).toBe(POLITIQUE.fr.sections);
    expect(SECTIONS[0]).toHaveProperty("titre");
    expect(SECTIONS[0]).toHaveProperty("paragraphes");
  });
});
