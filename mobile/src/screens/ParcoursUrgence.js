// « C'est urgent ? » — écran interstitiel.
//
// Il remplace la case « urgent » du formulaire. ASM organise des transports
// PROGRAMMÉS : une case à cocher laissait croire à une prise en charge
// immédiate. Devant une urgence vitale, la bonne action n'est pas de remplir
// un formulaire — d'où les numéros de secours en premier, en grand, et
// directement appelables.
import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking } from "react-native";
import { C, S } from "../theme";
import { useLangue, TEL_AFFICHE } from "../i18n";
import { proposerAppel } from "../ui";

function Secours({ libelle, numero }) {
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(`tel:${numero}`).catch(() => {})}
      accessibilityRole="button"
      style={{
        borderWidth: 1.5, borderColor: "#E3B7B7", backgroundColor: "#FBEDED",
        borderRadius: 14, paddingVertical: 18, alignItems: "center", marginBottom: 10,
      }}
    >
      <Text style={{ color: "#B03A3A", fontWeight: "800", fontSize: 17 }}>{libelle}</Text>
    </TouchableOpacity>
  );
}

export default function ParcoursUrgence() {
  const { t } = useLangue();

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Text style={S.h1}>{t("pc_urgent_t")}</Text>
      <Text style={S.sous}>{t("pc_urgent_p")}</Text>

      <Secours libelle={t("pc_urgent_samu")} numero="115" />
      <Secours libelle={t("pc_urgent_protection")} numero="14" />

      <TouchableOpacity
        onPress={() => proposerAppel(t)}
        accessibilityRole="button"
        style={{ marginTop: 14, minHeight: 54, borderRadius: 14, backgroundColor: C.vert, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ color: C.blanc, fontWeight: "800", fontSize: 15.5 }}>
          {t("pc_urgent_asm")} · {TEL_AFFICHE}
        </Text>
      </TouchableOpacity>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
