// Petits composants partagés (charte ASM).
import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { C, S } from "./theme";

export function Bouton({ titre, onPress, charge, desactive, secondaire }) {
  return (
    <TouchableOpacity
      style={[secondaire ? S.boutonSec : S.bouton, (charge || desactive) && { opacity: 0.55 }]}
      onPress={onPress}
      disabled={charge || desactive}
      activeOpacity={0.8}
    >
      {charge ? (
        <ActivityIndicator color={secondaire ? C.vert : C.blanc} />
      ) : (
        <Text style={secondaire ? S.boutonSecTxt : S.boutonTxt}>{titre}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Chip({ titre, actif, onPress, desactive }) {
  return (
    <TouchableOpacity
      style={[S.chip, actif && S.chipActif, desactive && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={desactive}
    >
      <Text style={[S.chipTxt, actif && S.chipTxtActif]}>{titre}</Text>
    </TouchableOpacity>
  );
}

const LIB_STATUT = {
  A_RAPPELER: "À confirmer", CONFIRMEE: "Confirmée", AFFECTEE: "Intervenant assigné",
  EN_COURS: "En cours", TERMINEE: "Terminée", ANNULEE: "Annulée", ABSENT: "Absent",
};

export function Pastille({ statut }) {
  const ko = ["ANNULEE", "ABSENT"].includes(statut);
  const ok = ["TERMINEE", "CONFIRMEE"].includes(statut);
  return (
    <View style={[S.pastille, ko && { backgroundColor: "#FBEBEB" }, ok && { backgroundColor: "#E7F3EC" }]}>
      <Text style={[S.pastilleTxt, ko && { color: C.rouge }]}>{LIB_STATUT[statut] || statut}</Text>
    </View>
  );
}

export function Charge() {
  return (
    <View style={{ paddingVertical: 40, alignItems: "center" }}>
      <ActivityIndicator size="large" color={C.vert} />
    </View>
  );
}

export const SERVICES_LIB = {
  transport: "Transport médical",
  domicile: "Aide à domicile",
  medicaments: "Livraison de médicaments",
};
