import { describe, it, expect } from "vitest";
import {
  ETAPES, TYPES, BESOINS, COMMUNES, FENETRES, PAIEMENTS,
  validerEtape, estRecurrent, etapeSuivante, etapePrecedente, numeroEtape,
  vehiculePour, construireDemande,
} from "../lib/parcours.js";

// Le site et l'application partagent cette définition — l'un l'importe,
// l'autre la reçoit par /api/parcours. Ces tests portent donc sur les DEUX
// supports à la fois : c'est ce qui remplace, chez nous, le package commun
// d'un monorepo.

describe("structure du parcours", () => {
  it("quatre étapes, dans l'ordre attendu", () => {
    expect(ETAPES.map((e) => e.cle)).toEqual(["besoin", "lieux", "creneau", "confirmation"]);
  });

  it("chaque service propose au moins un type de demande", () => {
    for (const service of ["transport", "domicile", "medicaments"]) {
      expect(TYPES[service]?.length, service).toBeGreaterThan(0);
    }
  });

  it("les clés de type sont uniques dans chaque service", () => {
    for (const [service, liste] of Object.entries(TYPES)) {
      const cles = liste.map((x) => x.cle);
      expect(new Set(cles).size, service).toBe(cles.length);
    }
  });

  it("dialyse et chimiothérapie sont récurrentes", () => {
    expect(estRecurrent("transport", "dialyse")).toBe(true);
    expect(estRecurrent("transport", "chimiotherapie")).toBe(true);
    expect(estRecurrent("transport", "consultation")).toBe(false);
  });

  it("aucun type « urgent » : l'urgence ne se réserve pas par formulaire", () => {
    const toutes = Object.values(TYPES).flat().map((x) => x.cle);
    expect(toutes.some((c) => /urgen/i.test(c))).toBe(false);
  });

  it("les besoins particuliers ne sont définis qu'une fois", () => {
    const cles = BESOINS.map((b) => b.cle);
    expect(new Set(cles).size).toBe(cles.length);
  });

  // lib/finances.js facture les suppléments en cherchant ces clés exactes
  // dans details.besoinsCles. Les renommer supprimerait les suppléments sans
  // provoquer la moindre erreur — d'où ce test.
  it("les besoins facturés gardent les clés que lit la facturation", () => {
    const cles = BESOINS.map((b) => b.cle);
    expect(cles).toContain("b_fauteuil");
    expect(cles).toContain("b_oxygene");
    expect(cles.every((c) => c.startsWith("b_"))).toBe(true);
  });

  it("les communes sont une liste fermée, sans doublon", () => {
    expect(COMMUNES.length).toBeGreaterThan(40);
    expect(new Set(COMMUNES).size).toBe(COMMUNES.length);
  });

  it("les fenêtres de livraison couvrent la journée sans trou", () => {
    expect(FENETRES.map((f) => f.cle)).toEqual(["asap", "matin", "midi", "soir"]);
    const horaires = FENETRES.filter((f) => f.debut);
    for (let i = 1; i < horaires.length; i++) {
      expect(horaires[i].debut).toBe(horaires[i - 1].fin);
    }
  });

  // « fr » est écrit en base et sert de clé de comptage des places restantes
  // (fenetresLivraison). Une valeur modifiée ferait repartir tous les
  // compteurs de zéro, sans erreur visible : les demandes déjà prises
  // cesseraient d'occuper leur fenêtre.
  it("les libellés stockés des fenêtres sont figés", () => {
    expect(FENETRES.map((f) => f.fr)).toEqual([
      "au plus tôt", "matin (8h–12h)", "midi (12h–15h)", "après-midi (15h–19h)",
    ]);
  });

  it("un seul moyen de paiement par défaut", () => {
    expect(PAIEMENTS.filter((p) => p.defaut).length).toBe(1);
  });
});

describe("classe de véhicule déduite du besoin", () => {
  it("n'oblige jamais à reposer la question du type de trajet", () => {
    expect(vehiculePour("transport", "chauffeur_medical")).toBe("medicalise");
    expect(vehiculePour("transport", "accompagnement")).toBe("accompagne");
    expect(vehiculePour("transport", "consultation")).toBe("simple");
    // Hors transport, la notion n'existe pas : le champ doit rester vide.
    expect(vehiculePour("domicile", "toilette")).toBeUndefined();
  });

  it("ne renvoie que des valeurs comprises par le moteur de disponibilités", () => {
    const connues = new Set(["simple", "accompagne", "medicalise"]);
    for (const ty of TYPES.transport) {
      expect(connues.has(vehiculePour("transport", ty.cle)), ty.cle).toBe(true);
    }
  });
});

describe("navigation entre étapes", () => {
  it("avance et recule sans sortir des bornes", () => {
    expect(etapeSuivante("besoin")).toBe("lieux");
    expect(etapeSuivante("confirmation")).toBe(null);
    expect(etapePrecedente("besoin")).toBe(null);
    expect(etapePrecedente("creneau")).toBe("lieux");
  });

  it("numérote les étapes à partir de 1, pour l'indicateur de progression", () => {
    expect(numeroEtape("besoin")).toBe(1);
    expect(numeroEtape("confirmation")).toBe(4);
  });
});

describe("validation des étapes", () => {
  it("refuse une étape « besoin » sans service ni type", () => {
    expect(validerEtape("besoin", {})).toContain("pc_err_service");
    expect(validerEtape("besoin", { service: "transport" })).toContain("pc_err_type");
    expect(validerEtape("besoin", { service: "transport", type: "consultation" })).toEqual([]);
  });

  it("exige départ ET destination pour un transport", () => {
    const manque = validerEtape("lieux", { service: "transport", commune: "Kouba" });
    expect(manque).toContain("pc_err_depart");
    expect(manque).toContain("pc_err_destination");
  });

  it("n'exige qu'une adresse pour une livraison ou une intervention", () => {
    for (const service of ["medicaments", "domicile"]) {
      const manque = validerEtape("lieux", { service, commune: "Kouba" });
      expect(manque, service).toContain("pc_err_adresse");
      expect(manque, service).not.toContain("pc_err_destination");
    }
    expect(validerEtape("lieux", { service: "domicile", depart: "a", commune: "Kouba" })).toEqual([]);
  });

  it("exige toujours la commune : c'est elle qui décide des ressources", () => {
    expect(validerEtape("lieux", { service: "transport", depart: "a", destination: "b" }))
      .toContain("pc_err_commune");
  });

  it("refuse un aller-retour sans heure de reprise", () => {
    const base = { service: "transport", depart: "a", destination: "b", commune: "Kouba" };
    expect(validerEtape("lieux", { ...base, allerRetour: true })).toContain("pc_err_retour");
    expect(validerEtape("lieux", { ...base, allerRetour: true, retourHeure: "sortie" })).toEqual([]);
    // Aller simple : la question ne se pose pas.
    expect(validerEtape("lieux", base)).toEqual([]);
  });

  it("exige un créneau, sauf pour une demande récurrente", () => {
    expect(validerEtape("creneau", { service: "transport", type: "consultation" }))
      .toContain("pc_err_creneau");
    // Dialyse : la régulation rappelle, aucun créneau n'est choisi ici.
    expect(validerEtape("creneau", { service: "transport", type: "dialyse" })).toEqual([]);
  });

  it("exige une fenêtre, et non une heure, pour une livraison", () => {
    const manque = validerEtape("creneau", { service: "medicaments", type: "ordonnance" });
    expect(manque).toContain("pc_err_fenetre");
    expect(validerEtape("creneau", { service: "medicaments", type: "ordonnance", fenetre: "matin" }))
      .toEqual([]);
  });

  it("exige un moyen de paiement avant de confirmer", () => {
    expect(validerEtape("confirmation", {})).toContain("pc_err_paiement");
    expect(validerEtape("confirmation", { paiement: "especes" })).toEqual([]);
  });
});

// La demande est assemblée UNE seule fois, côté serveur, à partir de l'état
// du parcours : le site et l'application envoient le même état brut. Ces
// tests portent donc sur ce que les deux supports enregistrent réellement.
describe("assemblage de la demande", () => {
  const transport = {
    service: "transport", type: "chauffeur_medical",
    depart: "12 rue A", destination: "CHU Mustapha", commune: "Kouba",
    iso: "2026-09-14T10:00", heure: "10:00", jour: "2026-09-14",
    telephone: "0550123456", besoins: ["b_fauteuil"], etage: "3", ascenseur: false,
    paiement: "especes",
  };

  it("place le créneau choisi dans la date, et le véhicule dans typeTrajet", () => {
    const c = construireDemande(transport);
    expect(c.date).toBe("2026-09-14T10:00");
    expect(c.typeTrajet).toBe("medicalise");
    expect(c.sousMode).toBe("ponctuel");
  });

  it("écrit l'étage et l'ascenseur en clair, sans perdre le « non »", () => {
    const d = JSON.parse(construireDemande(transport).details);
    expect(d.acces).toBe("Étage 3, sans ascenseur");
    expect(d.besoinsCles).toEqual(["b_fauteuil"]);
  });

  it("ne renseigne l'ascenseur que s'il a été répondu", () => {
    const d = JSON.parse(construireDemande({ ...transport, ascenseur: undefined }).details);
    expect(d.acces).toBe("Étage 3");
  });

  it("porte l'aller-retour dans les précisions, pas dans typeTrajet", () => {
    const c = construireDemande({ ...transport, allerRetour: true, retourHeure: "sortie" });
    expect(c.typeTrajet).toBe("medicalise");
    const d = JSON.parse(c.details);
    expect(d.allerRetour).toBe(true);
    expect(d.retourHeure).toBe("sortie");
  });

  it("n'invente pas d'aller-retour hors transport", () => {
    const c = construireDemande({ service: "domicile", type: "toilette", allerRetour: true, depart: "a" });
    expect(JSON.parse(c.details || "{}").allerRetour).toBeUndefined();
    expect(c.typeTrajet).toBe(null);
  });

  it("cale une livraison sur un jour et une fenêtre, jamais sur une heure", () => {
    const c = construireDemande({
      service: "medicaments", type: "ordonnance", depart: "12 rue A",
      commune: "Kouba", jour: "2026-09-14", fenetre: "matin", telephone: "0550123456",
    });
    expect(c.date).toBe("2026-09-14");
    expect(c.sousMode).toBe("fenetre");
    // La valeur stockée doit être celle que compte fenetresLivraison.
    expect(c.fenetre).toBe("matin (8h–12h)");
    expect(c.destination).toBe("");
  });

  it("laisse les précisions à null quand rien n'a été saisi", () => {
    const c = construireDemande({ service: "domicile", type: "toilette", depart: "a", commune: "Kouba" });
    expect(c.details).toBe(null);
  });

  it("ne laisse jamais un espace autre que patient ou pro", () => {
    expect(construireDemande({ service: "transport", espace: "admin" }).espace).toBe("patient");
    expect(construireDemande({ service: "transport", espace: "pro" }).espace).toBe("pro");
  });
});
