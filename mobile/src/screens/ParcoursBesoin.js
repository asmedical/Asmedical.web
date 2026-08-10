// Étape 1 — « De quoi avez-vous besoin ? »
//
// Une seule question à l'écran. L'ancien formulaire empilait tout sur une
// page ; pour une personne âgée sur un téléphone, cela ne tient pas.
import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { C, S } from "../theme";
import { Charge } from "../ui";
import { useLangue } from "../i18n";
import { useParcours, Stepper, estRecurrent, validerEtape } from "../parcours";

export default function ParcoursBesoin({ route, navigation }) {
  const { t } = useLangue();
  const { structure, pret, demande, maj } = useParcours();
  const service = route?.params?.service || demande.service;

  if (!pret) return <View style={S.ecran}><Charge /></View>;

  const types = structure.types?.[service] || [];

  function choisir(type) {
    maj({ service, type });
    // Dialyse, chimiothérapie : besoin régulier → parcours abonnement.
    // Aucun créneau temps réel n'est affiché pour un abonnement.
    if (estRecurrent(structure, service, type)) {
      navigation.navigate("ParcoursAbonnement", { service, type });
      return;
    }
    if (!validerEtape(structure, "besoin", { service, type }).length) {
      navigation.navigate("ParcoursLieux", { service });
    }
  }

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Text style={S.h1}>{t("pc_besoin_q")}</Text>
      <Stepper etape="besoin" />

      {types.length === 0 && <Text style={S.vide}>{t("pc_err_service")}</Text>}

      {types.map((ty) => (
        <TouchableOpacity
          key={ty.cle}
          onPress={() => choisir(ty.cle)}
          accessibilityRole="button"
          style={[
            S.carte,
            { marginBottom: 10, minHeight: 64, justifyContent: "center" },
            demande.type === ty.cle && { borderColor: C.vert, backgroundColor: C.vertPale },
          ]}
        >
          <Text style={{ fontSize: 16.5, fontWeight: "800", color: C.encre }}>{t(ty.libelle)}</Text>
        </TouchableOpacity>
      ))}

      {/* L'urgence n'est plus une case à cocher : c'est un lien discret vers
          un écran qui dit ce qu'ASM peut — et ne peut pas — faire. */}
      <TouchableOpacity
        onPress={() => navigation.navigate("ParcoursUrgence")}
        style={{ marginTop: 16, alignItems: "center" }}
      >
        <Text style={{ color: C.gris, fontSize: 14.5, textDecorationLine: "underline" }}>
          {t("pc_urgent_lien")}
        </Text>
      </TouchableOpacity>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
