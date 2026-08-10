// Parcours de réservation — côté application.
//
// La STRUCTURE (étapes, types, communes, validations) vient du serveur, par
// /api/parcours : c'est le même fichier que celui qu'importe le site
// (lib/parcours.js). L'application ne redéfinit rien — elle affiche.
//
// Ce module ne contient que ce qui est propre au téléphone : la mémoire des
// saisies entre les écrans et l'indicateur de progression.
import React, { createContext, useContext, useEffect, useState } from "react";
import { View, Text } from "react-native";
import { C } from "./theme";
import { apiGet } from "./api";

const Contexte = createContext(null);

// Repli minimal : si le réseau tombe pendant le chargement de la structure,
// l'écran affiche au moins les étapes plutôt qu'une page blanche. Les listes
// (types, communes) viennent forcément du serveur — les inventer ici serait
// exactement la divergence qu'on cherche à empêcher.
const REPLI = {
  etapes: [
    { cle: "besoin", titre: "pc_etape_besoin" },
    { cle: "lieux", titre: "pc_etape_lieux" },
    { cle: "creneau", titre: "pc_etape_creneau" },
    { cle: "confirmation", titre: "pc_etape_confirmation" },
  ],
  types: {},
  besoins: [],
  communes: [],
  fenetres: [],
  paiements: [],
};

export function ParcoursProvider({ children }) {
  const [structure, setStructure] = useState(null);
  const [demande, setDemande] = useState({});

  useEffect(() => {
    apiGet("/api/parcours")
      .then((d) => setStructure(d && d.etapes ? d : REPLI))
      .catch(() => setStructure(REPLI));
  }, []);

  // Les saisies survivent au retour arrière : on fusionne, on ne remplace
  // jamais. Repartir de zéro se fait explicitement, par reinitialiser().
  const maj = (champs) => setDemande((d) => ({ ...d, ...champs }));
  const reinitialiser = (champs = {}) => setDemande(champs);

  return (
    <Contexte.Provider value={{ structure: structure || REPLI, pret: !!structure, demande, maj, reinitialiser }}>
      {children}
    </Contexte.Provider>
  );
}

export const useParcours = () => useContext(Contexte);

// --- Règles de validation, recopiées de lib/parcours.js.
//
// Elles sont courtes et vérifiées des deux côtés par les mêmes tests : mieux
// vaut cette duplication assumée qu'un aller-retour réseau pour savoir si un
// champ est rempli. Le serveur revalide de toute façon à l'enregistrement.
export function estRecurrent(structure, service, type) {
  return !!(structure.types?.[service] || []).find((x) => x.cle === type)?.recurrent;
}

export function validerEtape(structure, etape, d = {}) {
  const manque = [];
  if (etape === "besoin") {
    if (!d.service) manque.push("pc_err_service");
    if (!d.type) manque.push("pc_err_type");
  }
  if (etape === "lieux") {
    if (d.service === "medicaments") {
      if (!d.destination?.trim()) manque.push("pc_err_adresse");
    } else {
      if (!d.depart?.trim()) manque.push("pc_err_depart");
      if (!d.destination?.trim()) manque.push("pc_err_destination");
    }
    if (!d.commune) manque.push("pc_err_commune");
  }
  if (etape === "creneau" && !estRecurrent(structure, d.service, d.type)) {
    if (d.service === "medicaments") {
      if (!d.fenetre) manque.push("pc_err_fenetre");
    } else if (!d.iso) {
      manque.push("pc_err_creneau");
    }
  }
  if (etape === "confirmation" && !d.paiement) manque.push("pc_err_paiement");
  return manque;
}

export function numeroEtape(structure, cle) {
  return (structure.etapes || []).findIndex((e) => e.cle === cle) + 1;
}

// Indicateur de progression — même lecture que sur le site : où j'en suis,
// combien il reste.
export function Stepper({ etape }) {
  const { structure } = useParcours();
  const etapes = structure.etapes || [];
  const courant = numeroEtape(structure, etape);

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 4, marginBottom: 20 }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: etapes.length, now: courant }}
    >
      {etapes.map((e, i) => {
        const n = i + 1;
        const atteint = n <= courant;
        return (
          <React.Fragment key={e.cle}>
            <View
              style={{
                width: 30, height: 30, borderRadius: 15,
                alignItems: "center", justifyContent: "center",
                backgroundColor: atteint ? C.vert : C.vertPale,
                borderWidth: 1.5, borderColor: atteint ? C.vert : C.ligne,
              }}
            >
              <Text style={{ fontWeight: "800", fontSize: 14, color: atteint ? C.blanc : C.gris }}>{n}</Text>
            </View>
            {i < etapes.length - 1 && (
              <View style={{ flex: 1, height: 2, backgroundColor: n < courant ? C.vert : C.ligne }} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}
