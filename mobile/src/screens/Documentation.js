// Documentation — même entrée que sur le site (barre du bas). Les contenus
// (packs, abonnements, devis, confidentialité) vivent sur le site : plutôt
// que d'en maintenir une copie qui divergerait, on y renvoie directement.
import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking } from "react-native";
import { C, S } from "../theme";
import { useLangue, TEL_AFFICHE } from "../i18n";
import { proposerAppel } from "../ui";
import { API_BASE } from "../api";

const PAGES = [
  { cle: "doc_packs", chemin: "/packs" },
  { cle: "doc_abonnements", chemin: "/abonnements" },
  { cle: "doc_devis", chemin: "/devis" },
  { cle: "doc_connaitre", chemin: "/connaitre" },
  { cle: "doc_confidentialite", chemin: "/confidentialite" },
];

export default function Documentation() {
  const { t } = useLangue();
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Text style={S.h1}>{t("doc_t")}</Text>
      <Text style={S.sous}>{t("doc_s")}</Text>

      {PAGES.map((p) => (
        <TouchableOpacity
          key={p.cle}
          accessibilityRole="link"
          onPress={() => Linking.openURL(`${API_BASE}${p.chemin}`).catch(() => {})}
          style={[S.carte, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, minHeight: 58 }]}
        >
          <Text style={{ flex: 1, color: C.encre, fontWeight: "700", fontSize: 15.5 }}>{t(p.cle)}</Text>
          <Text style={{ color: C.gris, fontSize: 18 }}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity onPress={() => proposerAppel(t)} style={{ marginTop: 26, alignItems: "center" }}>
        <Text style={{ color: C.gris }}>
          {t("urgence")} <Text style={{ color: C.vertFonce, fontWeight: "800" }}>{TEL_AFFICHE}</Text>
        </Text>
      </TouchableOpacity>
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}
