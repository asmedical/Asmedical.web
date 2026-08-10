import { describe, it, expect } from "vitest";
import {
  ETAPES, TYPES, BESOINS, COMMUNES, FENETRES, PAIEMENTS,
  validerEtape, estRecurrent, etapeSuivante, etapePrecedente, numeroEtape,
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

  it("les communes sont une liste fermée, sans doublon", () => {
    expect(COMMUNES.length).toBeGreaterThan(40);
    expect(new Set(COMMUNES).size).toBe(COMMUNES.length);
  });

  it("les trois fenêtres de livraison se suivent sans trou", () => {
    expect(FENETRES.map((f) => f.cle)).toEqual(["matin", "midi", "apresmidi"]);
    for (let i = 1; i < FENETRES.length; i++) {
      expect(FENETRES[i].debut).toBe(FENETRES[i - 1].fin);
    }
  });

  it("un seul moyen de paiement par défaut", () => {
    expect(PAIEMENTS.filter((p) => p.defaut).length).toBe(1);
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

  it("n'exige qu'une adresse pour une livraison", () => {
    const manque = validerEtape("lieux", { service: "medicaments", commune: "Kouba" });
    expect(manque).toContain("pc_err_adresse");
    expect(manque).not.toContain("pc_err_depart");
  });

  it("exige toujours la commune : c'est elle qui décide des ressources", () => {
    expect(validerEtape("lieux", { service: "transport", depart: "a", destination: "b" }))
      .toContain("pc_err_commune");
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
