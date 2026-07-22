// Petits composants partagés (charte ASM).
import React from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { C, S } from "./theme";

// Champ mot de passe avec œil pour afficher / masquer la saisie.
export function ChampMotDePasse({ value, onChangeText, placeholder, onSubmitEditing, returnKeyType }) {
  const [voir, setVoir] = React.useState(false);
  return (
    <View style={{ marginBottom: 12, position: "relative" }}>
      <TextInput
        style={[S.champ, { marginBottom: 0, paddingRight: 48 }]}
        secureTextEntry={!voir}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.grisClair}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
      />
      <TouchableOpacity
        onPress={() => setVoir((v) => !v)}
        style={{ position: "absolute", right: 6, top: 0, bottom: 0, width: 42, alignItems: "center", justifyContent: "center" }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        <Text style={{ fontSize: 20 }}>{voir ? "🙈" : "👁️"}</Text>
      </TouchableOpacity>
    </View>
  );
}

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

// Choix « nous joindre » : WhatsApp ou appel téléphonique classique.
export function proposerAppel(t) {
  const { Alert, Linking } = require("react-native");
  const { TEL_LIEN, WHATSAPP_LIEN } = require("./i18n");
  Alert.alert("ASM", t("appel_t"), [
    { text: t("annuler"), style: "cancel" },
    { text: t("appel_normal"), onPress: () => Linking.openURL(TEL_LIEN).catch(() => {}) },
    { text: t("appel_whatsapp"), onPress: () => Linking.openURL(WHATSAPP_LIEN).catch(() => {}) },
  ]);
}
