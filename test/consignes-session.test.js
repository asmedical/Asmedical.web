import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

// CLAUDE.md est lu automatiquement au début de chaque session. C'est ce qui
// évite au client de recoller un fichier à la main à chaque fois — et ce
// qui, jusqu'ici, manquait : sans lui, chaque session repartait à zéro.
//
// Ces vérifications ne jugent pas le style du texte. Elles s'assurent que
// les consignes qui ont déjà coûté cher y figurent encore, et que les
// chemins cités existent vraiment.

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8");

describe("consignes chargées à chaque session", () => {
  const consignes = lire("CLAUDE.md");

  it("demande de contrôler les connecteurs dès le départ", () => {
    expect(consignes).toContain("À FAIRE EN PREMIER");
    for (const outil of ["list_devices", "get_connection_status", "browser_navigate", "list_projects"]) {
      expect(consignes, outil).toContain(outil);
    }
  });

  // Les connecteurs de Ba3na portent des noms voisins. Piloter le mauvais
  // émulateur ne produit aucune erreur — juste un résultat faux.
  it("prévient de la confusion avec le projet Ba3na", () => {
    expect(consignes).toContain("Ba3na");
  });

  // Chacun de ces pièges a déjà coûté une soirée ou un cycle de validation.
  it("rappelle les pièges qui ont déjà coûté cher", () => {
    expect(consignes, "eas empaquette le disque").toMatch(/eas.+(disque|commit)/s);
    expect(consignes, "INSERT direct dans auth.users").toContain("auth.users");
    expect(consignes, "identifiant Android à ne pas changer").toContain("com.asm_sante.twa");
    expect(consignes, "libellés du parcours").toContain("lib/parcours.js");
  });

  it("rappelle la règle posée par le client", () => {
    expect(consignes).toMatch(/aucun renvoi de l'application vers le site/i);
  });

  // Un chemin cité qui n'existe pas envoie la session chercher dans le vide.
  it("ne cite que des fichiers qui existent", () => {
    // Repérés partout, pas seulement entre accents graves : les chemins
    // apparaissent aussi dans les blocs de commandes.
    const cites = [...consignes.matchAll(/(?:scripts|lib|mobile)\/[\w/-]+\.[a-z]{2,4}\b/g)].map((m) => m[0]);
    expect(cites.length).toBeGreaterThan(3);
    for (const chemin of new Set(cites)) {
      expect(existsSync(new URL(chemin, RACINE)), chemin).toBe(true);
    }
  });

  // Sans délai d'expiration, supergateway ne tue le processus enfant qu'à
  // la fermeture propre de la connexion. Neuf machines virtuelles Maestro
  // abandonnées ont saturé la mémoire du VPS en une journée.
  it("les services supergateway expirent leurs sessions abandonnées", () => {
    const source = lire("scripts/vps/metro-mcp.sh");
    expect(source).toContain("--stateful");
    expect(source).toMatch(/--sessionTimeout \d+/);
  });

  // Le tableau des services doit correspondre aux scripts qui les posent :
  // un service annoncé mais jamais installé se cherche longtemps.
  it("les services annoncés sont bien ceux que les scripts installent", () => {
    const poses = ["metro-asm", "mcp-metro", "mcp-playwright", "surveillance-emulateur"];
    const sources = ["metro-mcp.sh", "playwright-mcp.sh", "sante-vps.sh"]
      .map((f) => lire(`scripts/vps/${f}`))
      .join("\n");
    for (const service of poses) {
      expect(consignes, `${service} dans CLAUDE.md`).toContain(service);
      expect(sources, `${service} posé par un script`).toContain(service);
    }
  });
});

// Un contrôle qui rassure à tort est pire que pas de contrôle. La première
// version annonçait « ok — répond 000000 » sur un port mort : curl écrit
// déjà « 000 » quand rien ne répond, et le repli en ajoutait un second.
describe("le contrôle du VPS ne se trompe pas sur les ports", () => {
  const source = lire("scripts/vps/verifier-asm.sh");

  it("ne recolle pas un code de repli derrière celui de curl", () => {
    expect(source).not.toMatch(/%\{http_code\}[^\n]*\|\|\s*echo/);
  });

  it("traite l'absence de réponse, le refus et l'erreur serveur comme des problèmes", () => {
    for (const cas of ["000)", "403)", "5[0-9][0-9])"]) {
      expect(source, cas).toContain(cas);
    }
    // Les trois branches doivent mener à « souci », pas à « ok ».
    const bloc = source.slice(source.indexOf("verifier_port()"), source.indexOf("verifier_port \"Maestro\""));
    expect((bloc.match(/souci /g) || []).length).toBeGreaterThanOrEqual(3);
  });

  // Deux fois le même piège : une commande qui imprime déjà « 0 » ou
  // « 000 » puis sort en erreur, et un repli qui colle une seconde valeur.
  // Le résultat ne correspond plus à rien et passe pour bon.
  it("ne compte pas les processus avec un repli qui double la valeur", () => {
    expect(source).not.toMatch(/pgrep[^\n]*\|\|\s*echo/);
    // Compter les vrais processus java, pas les lignes de commande qui
    // mentionnent le motif — le shell appelant en fait partie.
    expect(source).toContain('$1 == "java"');
  });

  it("ne modifie rien sans qu'on le demande", () => {
    expect(source).toContain('[ "${1:-}" = "--reparer" ]');
  });
});
