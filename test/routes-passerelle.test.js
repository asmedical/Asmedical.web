import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Chaque serveur MCP du VPS pose sa route dans la MÊME ligne CIBLES. Écrire
// cette ligne entière depuis chaque script d'installation revenait à
// l'écraser : installer Playwright coupait Metro. La panne est silencieuse —
// le service tourne, mais la passerelle ne sait plus où l'envoyer.

const SCRIPT = new URL("../scripts/vps/ajouter-cible.sh", import.meta.url).pathname;

let dossier;
let fichier;

function ajouter(nom, port) {
  return execFileSync("bash", [SCRIPT, nom, port, fichier], { encoding: "utf8" });
}

function routes() {
  const ligne = readFileSync(fichier, "utf8").split("\n").find((l) => l.startsWith("CIBLES="));
  return ligne ? ligne.slice("CIBLES=".length) : "";
}

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), "asm-cibles-"));
  fichier = join(dossier, "mcp.env");
  writeFileSync(fichier, "");
});

afterEach(() => rmSync(dossier, { recursive: true, force: true }));

describe("routes de la passerelle MCP", () => {
  // Le cas qui échouait sans bruit : sur une liste vide, grep ne trouve rien
  // et fait sortir le script, qui n'écrivait donc AUCUNE route.
  it("pose la première route dans un fichier vide", () => {
    ajouter("metro", "8767");
    expect(routes()).toBe("metro:8767");
  });

  it("ajoute une deuxième route sans effacer la première", () => {
    ajouter("metro", "8767");
    ajouter("playwright", "8769");
    expect(routes()).toBe("metro:8767,playwright:8769");
  });

  it("relancer une installation ne change rien", () => {
    ajouter("metro", "8767");
    ajouter("playwright", "8769");
    const sortie = ajouter("metro", "8767");
    expect(routes()).toBe("metro:8767,playwright:8769");
    // Une ligne réécrite à l'identique redémarrerait la passerelle pour rien.
    expect(sortie).toContain("rien à changer");
  });

  it("change le port d'une route sans déplacer les autres", () => {
    ajouter("metro", "8767");
    ajouter("playwright", "8769");
    ajouter("metro", "8770");
    expect(routes()).toBe("metro:8770,playwright:8769");
  });

  it("laisse les autres réglages du fichier intacts", () => {
    writeFileSync(fichier, "MCP_PASSPHRASE=secret\nCIBLES=metro:8767\nPORT=8766\n");
    ajouter("playwright", "8769");
    const contenu = readFileSync(fichier, "utf8");
    expect(contenu).toContain("MCP_PASSPHRASE=secret");
    expect(contenu).toContain("PORT=8766");
    expect(routes()).toBe("metro:8767,playwright:8769");
  });

  // Un nom ou un port fantaisiste produirait une ligne que la passerelle
  // ignore en silence.
  it("refuse un nom ou un port invalide", () => {
    expect(() => ajouter("mauvais nom", "8769")).toThrow();
    expect(() => ajouter("metro", "abc")).toThrow();
    expect(routes()).toBe("");
  });
});
