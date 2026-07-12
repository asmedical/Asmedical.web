// Mes rendez-vous : la liste réelle des demandes du patient.
import React, { useCallback, useState } from "react";
import { Text, ScrollView, TouchableOpacity, RefreshControl, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, S } from "../theme";
import { Pastille, Charge, SERVICES_LIB } from "../ui";
import { useLangue } from "../i18n";
import { apiGet } from "../api";

export default function MesDemandes({ navigation }) {
  const { t } = useLangue();
  const [demandes, setDemandes] = useState(null);
  const [rafraichit, setRafraichit] = useState(false);

  const charger = useCallback(() => {
    apiGet("/api/mes-demandes")
      .then((d) => setDemandes(d.demandes || []))
      .catch(() => setDemandes([]));
  }, []);
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  return (
    <ScrollView
      style={S.ecran}
      contentContainerStyle={S.contenu}
      refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={() => { setRafraichit(true); charger(); setTimeout(() => setRafraichit(false), 600); }} tintColor={C.vert} />}
    >
      <Text style={S.h1}>{t("mes_rdv_t")}</Text>
      {demandes === null && <Charge />}
      {demandes?.length === 0 && <Text style={S.vide}>{t("aucune_demande")}</Text>}
      {(demandes || []).map((d) => (
        <TouchableOpacity key={d.id} style={S.carte} activeOpacity={0.7} onPress={() => navigation.navigate("Suivi", { id: d.id })}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontWeight: "800", color: C.encre, fontSize: 15.5, flex: 1 }}>
              n°{d.id} · {SERVICES_LIB[d.service] || d.service}
              {d.avis ? `  ${"★".repeat(d.avis.note)}` : ""}
            </Text>
            <Pastille statut={d.statut} />
          </View>
          <Text style={{ color: C.gris, marginTop: 4 }}>
            {d.date ? d.date.replace("T", " à ") : "—"}
            {d.destination ? ` · ${d.destination}` : ""}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
