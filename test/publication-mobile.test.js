import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// La publication Android part du VPS : compilation chez Expo, puis remise
// directe à Google. Personne ne télécharge de fichier, donc personne ne voit
// ce qui part. Une erreur de nom entre le script et eas.json ne se
// manifesterait qu'au bout d'une vingtaine de minutes d'attente, ou pire :
// en déposant la version sur la mauvaise piste Play.

const EAS = JSON.parse(readFileSync(new URL("../mobile/eas.json", import.meta.url), "utf8"));
const SCRIPT = readFileSync(new URL("../scripts/vps/publier-android.sh", import.meta.url), "utf8");

describe("configuration de publication mobile", () => {
  it("le profil de compilation production vise le canal production", () => {
    expect(EAS.build.production.channel).toBe("production");
    // Sans incrément automatique, Google refuse la version : le numéro de
    // build doit être plus grand que le précédent.
    expect(EAS.build.production.autoIncrement).toBe(true);
  });

  it("chaque profil d'envoi désigne une piste Play", () => {
    for (const [nom, profil] of Object.entries(EAS.submit)) {
      expect(profil.android?.track, `${nom}.android.track`).toBeTruthy();
      // « draft » laisserait la version en attente dans Play sans que rien
      // ne le dise ici.
      expect(profil.android.releaseStatus, `${nom}.releaseStatus`).toBe("completed");
    }
  });

  it("le test fermé et la production ne visent pas la même piste", () => {
    expect(EAS.submit.ferme.android.track).not.toBe(EAS.submit.production.android.track);
  });

  // L'identifiant App Store Connect sert aux deux profils : oublié sur l'un,
  // l'envoi iOS s'arrête pour demander lequel — sans personne pour répondre.
  it("l'identifiant App Store Connect est présent partout", () => {
    for (const [nom, profil] of Object.entries(EAS.submit)) {
      expect(profil.ios?.ascAppId, `${nom}.ios.ascAppId`).toBeTruthy();
    }
  });
});

describe("le script de publication et eas.json s'accordent", () => {
  // Les profils acceptés par le script, tels qu'écrits dans son garde-fou.
  const acceptes = SCRIPT.match(/^\s*([a-z|]+)\)\s*;;\s*$/m)?.[1].split("|") || [];

  it("le script accepte au moins deux profils", () => {
    expect(acceptes.length).toBeGreaterThan(1);
  });

  it("tous les profils acceptés existent dans eas.json", () => {
    for (const nom of acceptes) {
      expect(EAS.submit[nom], `profil « ${nom} » absent de eas.json`).toBeTruthy();
    }
  });

  it("le profil par défaut du script existe", () => {
    const defaut = SCRIPT.match(/PROFIL_ENVOI="\$\{1:-([a-z]+)\}"/)?.[1];
    expect(defaut).toBeTruthy();
    expect(EAS.submit[defaut], `profil par défaut « ${defaut} »`).toBeTruthy();
  });

  // C'est la leçon de l'OTA publié depuis un dépôt en retard : eas empaquette
  // les fichiers du disque, pas un commit.
  it("le script refuse de publier un dépôt qui n'est pas à jour", () => {
    expect(SCRIPT).toContain("git status --porcelain");
    expect(SCRIPT).toContain("git pull --ff-only origin main");
  });


  // Un greffon déclaré dans app.json mais absent de node_modules fait
  // échouer « expo config », donc la compilation — avec un message qui ne
  // nomme même pas le paquet manquant. Le script ne réinstallait que si le
  // dossier était absent : il ne l'était pas.
  it("synchronise les dépendances à chaque fois, pas seulement si elles manquent", () => {
    expect(SCRIPT).toContain("npm ci");
    expect(SCRIPT, "ne pas conditionner à l'absence du dossier")
      .not.toMatch(/if \[ ! -d .*node_modules/);
  });

  // Vingt minutes d'attente pour apprendre que la configuration ne se lit
  // pas, c'est vingt minutes de trop.
  it("relit la configuration avant de lancer la compilation", () => {
    expect(SCRIPT).toContain("expo config --json");
    expect(SCRIPT.indexOf("expo config --json")).toBeLessThan(SCRIPT.indexOf("eas build"));
  });

  it("le script enchaîne compilation et envoi sans intervention", () => {
    expect(SCRIPT).toContain("--auto-submit-with-profile");
    expect(SCRIPT).toContain("--non-interactive");
  });
});
