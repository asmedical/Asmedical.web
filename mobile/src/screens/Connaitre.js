// Nous connaître — écran natif, mêmes textes que le site
// (app/connaitre/page.js) : comment ça marche, et pourquoi faire confiance.
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { C, S } from "../theme";
import { Bouton } from "../ui";
import { useLangue } from "../i18n";

const ETAPES = [
  ["cm1", "cm1d"],
  ["cm2", "cm2d"],
  ["cm3", "cm3d"],
];
const ATOUTS = [
  ["conf1", "conf1d"],
  ["conf2", "conf2d"],
  ["conf3", "conf3d"],
  ["conf4", "conf4d"],
];

export default function Connaitre({ navigation }) {
  const { t } = useLangue();

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Text style={S.h1}>{t("connaitre_t")}</Text>
      <Text style={S.sous}>{t("connaitre_s")}</Text>

      <Text style={S.h2}>{t("cm_t")}</Text>
      {ETAPES.map(([titre, detail], i) => (
        <View key={titre} style={{ flexDirection: "row", marginBottom: 14 }}>
          {/* Le numéro d'étape, comme sur le site : on comprend l'ordre sans lire. */}
          <View
            style={{
              width: 30, height: 30, borderRadius: 15, backgroundColor: C.vert,
              alignItems: "center", justifyContent: "center", marginRight: 12,
            }}
          >
            <Text style={{ color: C.blanc, fontWeight: "800" }}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", color: C.encre, fontSize: 15.5 }}>{t(titre)}</Text>
            <Text style={{ color: C.gris, marginTop: 3, lineHeight: 21 }}>{t(detail)}</Text>
          </View>
        </View>
      ))}

      <Text style={S.h2}>{t("conf_t")}</Text>
      {ATOUTS.map(([titre, detail]) => (
        <View key={titre} style={[S.carte, { marginBottom: 8 }]}>
          <Text style={{ fontWeight: "800", color: C.encre, fontSize: 15 }}>{t(titre)}</Text>
          <Text style={{ color: C.gris, marginTop: 3, lineHeight: 21 }}>{t(detail)}</Text>
        </View>
      ))}

      <View style={{ height: 10 }} />
      <Bouton titre={t("faire_demande")} onPress={() => navigation.navigate("Reserver")} />
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
