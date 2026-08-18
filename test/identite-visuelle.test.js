import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";

// L'écran de chargement n'existait que sur Android : sans le greffon
// expo-splash-screen, Android affiche son écran système avec l'icône de
// l'application, iOS n'affiche rien. Le client tient à cet écran, et le site
// comme l'application doivent se ressembler d'un bout à l'autre.
//
// Ces vérifications ne jugent pas le dessin. Elles s'assurent que la
// configuration reste complète et que les images gardent les dimensions
// qu'Apple et Google exigent.

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE));
const json = (chemin) => JSON.parse(lire(chemin).toString("utf8"));

// Dimensions d'un PNG, lues dans son en-tête.
function tailleImage(chemin) {
  const d = lire(chemin);
  expect(d.subarray(0, 8).toString("hex"), `${chemin} n'est pas un PNG`).toBe("89504e470d0a1a0a");
  return { largeur: d.readUInt32BE(16), hauteur: d.readUInt32BE(20) };
}

const APP = json("mobile/app.json").expo;
const PAQUET = json("mobile/package.json");

describe("écran de chargement", () => {
  const greffon = APP.plugins.find((g) => Array.isArray(g) && g[0] === "expo-splash-screen");

  it("est configuré", () => {
    expect(greffon, "greffon expo-splash-screen absent de app.json").toBeTruthy();
  });

  // Déclaré sans être installé, le greffon fait échouer la compilation — et
  // seulement au bout des vingt minutes de build.
  it("le paquet correspondant est déclaré", () => {
    expect(PAQUET.dependencies["expo-splash-screen"]).toBeTruthy();
  });

  // Sans image ni couleur, le greffon retombe sur un écran blanc vide : on
  // perdrait précisément ce que le client veut garder.
  it("désigne une image et une couleur de fond", () => {
    const o = greffon[1];
    expect(o.image).toBeTruthy();
    expect(o.backgroundColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(o.imageWidth).toBeGreaterThan(0);
  });

  // C'est tout l'objet du correctif : les options hors « android » et « ios »
  // valent pour les deux. Les enfermer dans une plateforme rendrait l'autre
  // muette, comme avant.
  it("vaut pour les deux plateformes, pas seulement Android", () => {
    const o = greffon[1];
    expect(o.image, "image posée hors de tout bloc de plateforme").toBeTruthy();
    expect(o.android?.image, "ne pas enfermer l'image côté Android").toBeUndefined();
  });

  it("l'image de chargement existe", () => {
    const chemin = greffon[1].image.replace("./", "mobile/");
    expect(() => statSync(new URL(chemin, RACINE))).not.toThrow();
  });
});

describe("images de l'application", () => {
  // Une icône non carrée est déformée par les deux plateformes, et Apple
  // demande 1024×1024 pour la fiche App Store — en dessous, l'image est
  // agrandie et le liseré doré bave.
  for (const nom of ["icon.png", "adaptive-icon.png", "splash-icon.png"]) {
    it(`${nom} est carrée et au moins 1024`, () => {
      const { largeur, hauteur } = tailleImage(`mobile/assets/${nom}`);
      expect(largeur).toBe(hauteur);
      expect(largeur).toBeGreaterThanOrEqual(1024);
    });
  }

  // Deux logos différents entre l'icône du téléphone et l'écran de
  // chargement, c'est ce qu'on vient de corriger : ils doivent rester le même
  // dessin.
  it("l'icône et l'image de chargement portent le même logo", () => {
    expect(lire("mobile/assets/splash-icon.png").equals(lire("mobile/assets/icon.png"))).toBe(true);
  });
});
