import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Les scripts de scripts/tests/*.mjs tournent hors de Next.js : ils recopient
// les fichiers de lib/ dans un dossier temporaire en réécrivant les imports
// « @/lib/… », que Node ne sait pas résoudre seul.
//
// Ajouter un import entre deux fichiers de lib/ casse donc silencieusement
// ces scripts — la panne n'apparaît qu'au lancement, sur une machine avec
// une base de données, longtemps après le commit. C'est arrivé en ajoutant
// « @/lib/parcours » dans lib/disponibilites.js.
//
// Ce test relit chaque script et vérifie que tout ce qu'il recopie est
// résolvable.

const DOSSIER = "scripts/tests";

function scripts() {
  if (!fs.existsSync(DOSSIER)) return [];
  return fs.readdirSync(DOSSIER).filter((f) => f.endsWith(".mjs"));
}

// Imports STATIQUES « @/lib/… » que le script sait réécrire. On s'en tient
// aux imports statiques : ce sont eux qui font échouer le chargement du
// module, immédiatement et à tous les coups. Un import dynamique ne casse
// que la branche qui l'exécute.
function reecrits(source) {
  const noms = new Set();
  for (const m of source.matchAll(/'from "@\/lib\/([a-zA-Z0-9_-]+)"'/g)) noms.add(m[1]);
  return noms;
}

// Modules disponibles dans le dossier temporaire : recopiés depuis lib/, ou
// remplacés par un bouchon écrit à la main.
function fournis(source) {
  const noms = new Set();
  for (const m of source.matchAll(/\.test-fin\/([a-zA-Z0-9_-]+)\.js"/g)) noms.add(m[1]);
  return noms;
}

// Fichiers de lib/ que le script recopie tels quels (donc dont les imports
// doivent être résolvables).
function copies(source) {
  const noms = new Set();
  for (const m of source.matchAll(/adapter\("lib\/([a-zA-Z0-9_-]+)\.js"\)/g)) noms.add(m[1]);
  return noms;
}

// Dépendances statiques « @/lib/… » d'un fichier de lib/.
function dependances(nom) {
  const chemin = path.join("lib", `${nom}.js`);
  if (!fs.existsSync(chemin)) return [];
  const s = fs.readFileSync(chemin, "utf8");
  const noms = new Set();
  for (const m of s.matchAll(/^import .*from "@\/lib\/([a-zA-Z0-9_-]+)";/gm)) noms.add(m[1]);
  return [...noms];
}

describe("scripts de test autonomes", () => {
  it("trouve les scripts à vérifier", () => {
    expect(scripts().length).toBeGreaterThan(0);
  });

  it("chaque module recopié voit toutes ses dépendances réécrites et recopiées", () => {
    const manques = [];
    for (const f of scripts()) {
      const source = fs.readFileSync(path.join(DOSSIER, f), "utf8");
      const sues = reecrits(source);
      const dispo = fournis(source);
      for (const module of copies(source)) {
        for (const dep of dependances(module)) {
          if (!sues.has(dep)) manques.push(`${f} : lib/${module}.js importe @/lib/${dep} — import non réécrit`);
          else if (!dispo.has(dep)) manques.push(`${f} : lib/${module}.js importe @/lib/${dep} — module absent du dossier temporaire`);
        }
      }
    }
    expect(manques, manques.join("\n")).toEqual([]);
  });
});
