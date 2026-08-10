// Nos packs — écran natif, mêmes données que le site (/api/packs).
// Les prix affichés sont ceux du serveur : aucun tarif n'est recopié dans
// l'application, sans quoi les deux supports finiraient par diverger.
import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, S } from "../theme";
import { Charge, SERVICES_LIB } from "../ui";
import { useLangue } from "../i18n";
import { apiGet } from "../api";
import { useParcours } from "../parcours";

const DA = (n) => `${Number(n || 0).toLocaleString("fr-FR")} DZD`;

export default function Packs({ navigation }) {
  const { t, langue } = useLangue();
  const { reinitialiser } = useParcours();
  const [packs, setPacks] = useState(null);

  // Le pack accompagne la demande jusqu'à l'enregistrement : il conditionne
  // le prix. On repart d'une feuille blanche et on le pose d'emblée.
  function choisirPack(p) {
    reinitialiser({
      service: p.service,
      packId: p.id,
      packNom: langue === "ar" && p.nomAr ? p.nomAr : p.nom,
      packPrix: p.prix,
    });
    navigation.navigate("ParcoursBesoin", { service: p.service });
  }

  const charger = useCallback(() => {
    apiGet("/api/packs")
      .then((d) => setPacks(d?.packs || []))
      .catch(() => setPacks([]));
  }, []);

  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  if (packs === null) return <View style={S.ecran}><Charge /></View>;

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Text style={S.h1}>{t("pk_t")}</Text>
      <Text style={S.sous}>{t("pk_s")}</Text>

      {packs.length === 0 && <Text style={S.vide}>{t("pk_vide")}</Text>}

      {packs.map((p) => {
        // Le serveur fournit les deux langues : on affiche celle du lecteur.
        const nom = (langue === "ar" && p.nomAr) || p.nom;
        const desc = (langue === "ar" && p.descriptionAr) || p.description;
        return (
          <View key={p.id} style={[S.carte, { marginBottom: 10 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Text style={{ fontWeight: "800", color: C.encre, fontSize: 16, flex: 1, paddingRight: 10 }}>
                {nom}
              </Text>
              <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 16 }}>{DA(p.prix)}</Text>
            </View>
            <Text style={{ color: C.gris, fontSize: 13, marginTop: 3 }}>
              {SERVICES_LIB[p.service] || p.service}
              {p.dureeMin ? ` · ${p.dureeMin} min` : ""}
            </Text>
            {!!desc && <Text style={{ color: C.gris, marginTop: 8, lineHeight: 20 }}>{desc}</Text>}
            <View style={{ height: 10 }} />
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => choisirPack(p)}
              style={{ minHeight: 50, borderRadius: 12, backgroundColor: C.vert, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: C.blanc, fontWeight: "800", fontSize: 15.5 }}>{t("pk_reserver")}</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <TouchableOpacity onPress={() => navigation.navigate("Devis")} style={{ marginTop: 14, alignItems: "center" }}>
        <Text style={{ color: C.gris, textAlign: "center" }}>
          {t("pk_devis_hint")} <Text style={{ color: C.vertFonce, fontWeight: "800" }}>{t("dv_t")}</Text>
        </Text>
      </TouchableOpacity>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
