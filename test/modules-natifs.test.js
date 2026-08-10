import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Le build 1.3.0 (numéro 10) n'a pas démarré sur iPhone :
//   Symbol not found: _$s15ExpoModulesCore10BaseModuleC11willDestroyyyFTj
//   Referenced from: ExpoFileSystem — Expected in: ExpoModulesCore
//
// Cause : « expo » était figé en 57.0.4 par le verrou, tandis que les modules
// ajoutés ensuite, déclarés en ~57.0.x, se sont résolus vers les versions du
// SDK 57.0.11. Deux générations de code natif dans le même binaire.
//
// Une version approximative sur un module NATIF ne se voit ni à la
// compilation, ni aux tests, ni à l'installation : elle ne se voit qu'au
// lancement sur un vrai téléphone, après vingt minutes de build. D'où ce
// contrôle, qui coûte une milliseconde.

const paquet = JSON.parse(readFileSync(new URL("../mobile/package.json", import.meta.url)));
const verrou = JSON.parse(readFileSync(new URL("../mobile/package-lock.json", import.meta.url)));

const EST_NATIF = (nom) =>
  nom === "react" ||
  nom === "react-native" ||
  nom.startsWith("expo") ||
  nom.startsWith("react-native-");

describe("modules natifs de l'application mobile", () => {
  const natifs = Object.entries(paquet.dependencies).filter(([nom]) => EST_NATIF(nom));

  it("il y a bien des modules natifs à contrôler", () => {
    expect(natifs.length).toBeGreaterThan(8);
  });

  it("aucune version approximative : ni ~ ni ^ ni *", () => {
    const flous = natifs.filter(([, v]) => /[~^*x><|]|\s-\s/.test(String(v)));
    expect(
      flous.map(([n, v]) => `${n}@${v}`),
      "un module natif doit être figé à une version exacte"
    ).toEqual([]);
  });

  it("la version installée est exactement celle demandée", () => {
    const ecarts = natifs
      .map(([nom, demande]) => ({
        nom,
        demande,
        installe: verrou.packages[`node_modules/${nom}`]?.version,
      }))
      .filter((e) => e.installe !== e.demande);
    expect(
      ecarts.map((e) => `${e.nom} : demandé ${e.demande}, verrouillé ${e.installe}`),
      "le verrou doit refléter exactement package.json"
    ).toEqual([]);
  });

  it("expo-modules-core correspond au noyau du SDK installé", () => {
    // C'est l'appariement précis qui a manqué : le noyau vient de « expo »,
    // les modules l'appellent. S'ils divergent, le binaire meurt au lancement.
    expect(verrou.packages["node_modules/expo"]?.version).toBe("57.0.11");
    expect(verrou.packages["node_modules/expo-modules-core"]?.version).toBe("57.0.10");
  });
});
