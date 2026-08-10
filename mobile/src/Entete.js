// En-tête commun à tous les écrans — repris du site, où il figure sur chaque
// page : bandeau d'appel, logo ASM, sélecteur de langue.
//
// Ce n'est pas de l'ornement. Sur une plateforme médicale, ces trois éléments
// disent « vous êtes au bon endroit, vous pouvez appeler, on vous parle dans
// votre langue ». Leur absence donnait à l'application un air d'ébauche là où
// le site inspire confiance.
import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { C } from "./theme";
import { useLangue, TEL_AFFICHE } from "./i18n";
import { proposerAppel } from "./ui";
import { IcoTelephone } from "./icones";

export default function Entete() {
  const { t, langue, setLangue } = useLangue();

  return (
    <View>
      {/* Bandeau d'appel — le numéro reste joignable partout, en un geste. */}
      <TouchableOpacity
        onPress={() => proposerAppel(t)}
        accessibilityRole="button"
        accessibilityLabel={`${t("entete_question")} ${TEL_AFFICHE}`}
        style={{
          backgroundColor: C.vertPale,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 9,
          gap: 7,
        }}
      >
        <IcoTelephone couleur={C.vertFonce} taille={15} />
        <Text style={{ color: C.vertFonce, fontSize: 13.5, fontWeight: "700" }}>
          {t("entete_question")}{" "}
          <Text style={{ textDecorationLine: "underline" }}>{TEL_AFFICHE}</Text>
          {"  ·  "}
          {t("entete_dispo")}
        </Text>
      </TouchableOpacity>

      {/* Logo et langue */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: C.ligne,
          backgroundColor: C.blanc,
        }}
      >
        <Image
          source={require("../assets/icon.png")}
          style={{ width: 34, height: 34, borderRadius: 17 }}
          accessibilityLabel="ASM"
        />
        <Text style={{ marginLeft: 10, fontSize: 18, fontWeight: "800", color: C.encre, flex: 1 }}>
          ASM
        </Text>

        {/* Sélecteur FR / ع — sur le site il est dans l'en-tête, pas enfoui
            dans les réglages : un lecteur arabophone doit pouvoir basculer
            immédiatement. */}
        <View style={{ flexDirection: "row", borderRadius: 99, overflow: "hidden", borderWidth: 1, borderColor: C.vert }}>
          {[["fr", "FR"], ["ar", "ع"]].map(([code, libelle]) => (
            <TouchableOpacity
              key={code}
              onPress={() => setLangue(code)}
              accessibilityRole="button"
              accessibilityState={{ selected: langue === code }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 6,
                backgroundColor: langue === code ? C.vert : C.blanc,
              }}
            >
              <Text style={{ fontWeight: "800", fontSize: 14, color: langue === code ? C.blanc : C.vertFonce }}>
                {libelle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}
