// Écran d'orientation — MÊME rôle que la page d'accueil du site (app/page.js) :
// avant toute chose, on demande qui vous êtes. C'est ce choix qui structure
// la suite du parcours, et il doit exister sur les deux supports.
import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { C } from "../theme";
import { useLangue } from "../i18n";
import { IcoPersonne, IcoEtablissement } from "../icones";

// Carte de choix : grande zone tactile, libellé et description toujours
// visibles — pas d'icône seule à déchiffrer.
function CarteEspace({ Icone, titre, description, couleurTitre, fond, fondIcone, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${titre}. ${description}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: fond,
        borderRadius: 18,
        padding: 20,
        marginBottom: 14,
        minHeight: 104,
      }}
    >
      <View
        style={{
          width: 52, height: 52, borderRadius: 26, backgroundColor: fondIcone,
          alignItems: "center", justifyContent: "center", marginRight: 16,
        }}
      >
        <Icone couleur={couleurTitre} taille={27} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 19, fontWeight: "800", color: couleurTitre, marginBottom: 4 }}>
          {titre}
        </Text>
        <Text style={{ fontSize: 14.5, color: C.gris, lineHeight: 20 }}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function Demarrage({ navigation }) {
  const { t } = useLangue();

  const aller = (espace) => navigation.navigate("Connexion", { espace });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.vertFonce }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 22, paddingVertical: 48 }}
    >
      <Text style={{ fontSize: 30, fontWeight: "800", color: C.blanc, textAlign: "center" }}>
        {t("dem_t")}
      </Text>
      {/* Devise arabe, présente sur le site quelle que soit la langue. */}
      <Text
        style={{ fontSize: 21, color: "#D8B45A", textAlign: "center", marginTop: 12 }}
        // eslint-disable-next-line react-native/no-raw-text
      >
        دائماً قريبون منكم
      </Text>
      <Text style={{ fontSize: 16, color: "rgba(255,255,255,0.86)", textAlign: "center", marginTop: 10, marginBottom: 30 }}>
        {t("dem_s")}
      </Text>

      {/* Les patients sont l'immense majorité : leur espace est mis en avant,
          l'espace professionnel reste présent mais en second plan — même
          hiérarchie que sur le site. */}
      <CarteEspace
        Icone={IcoPersonne}
        titre={t("esp_patient")}
        description={t("esp_patient_d")}
        couleurTitre={C.vertFonce}
        fond={C.blanc}
        fondIcone={C.vertPale}
        onPress={() => aller("patient")}
      />
      <CarteEspace
        Icone={IcoEtablissement}
        titre={t("esp_pro")}
        description={t("esp_pro_d")}
        couleurTitre="#1F4E79"
        fond="#E8EFF5"
        fondIcone="#D3E1EE"
        onPress={() => aller("pro")}
      />
    </ScrollView>
  );
}
