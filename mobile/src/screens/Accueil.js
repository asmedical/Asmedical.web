// Accueil : les trois prestations + prochain rendez-vous réel.
import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, S } from "../theme";
import { Pastille, SERVICES_LIB } from "../ui";
import { useLangue } from "../i18n";
import { apiGet } from "../api";

const SERVICES = [
  { id: "transport", ico: "🚑", t: "s_transport", d: "s_transport_d" },
  { id: "domicile", ico: "🏠", t: "s_domicile", d: "s_domicile_d" },
  { id: "medicaments", ico: "💊", t: "s_medic", d: "s_medic_d" },
];

export default function Accueil({ navigation }) {
  const { t } = useLangue();
  const [prochain, setProchain] = useState(null);
  const [rafraichit, setRafraichit] = useState(false);

  const charger = useCallback(() => {
    apiGet("/api/mes-demandes")
      .then((d) => {
        const maintenant = Date.now();
        const futurs = (d.demandes || [])
          .filter((x) => x.date && !["ANNULEE", "TERMINEE"].includes(x.statut) && new Date(x.date).getTime() > maintenant)
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        setProchain(futurs[0] || null);
      })
      .catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  return (
    <ScrollView
      style={S.ecran}
      contentContainerStyle={S.contenu}
      refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={() => { setRafraichit(true); charger(); setTimeout(() => setRafraichit(false), 600); }} tintColor={C.vert} />}
    >
      <Text style={S.h1}>{t("accueil_q")}</Text>

      {SERVICES.map((sv) => (
        <TouchableOpacity
          key={sv.id}
          style={[S.carte, { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 18 }]}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Reservation", { service: sv.id })}
        >
          <Text style={{ fontSize: 30 }}>{sv.ico}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16.5, fontWeight: "800", color: C.encre }}>{t(sv.t)}</Text>
            <Text style={{ fontSize: 13.5, color: C.gris, marginTop: 2 }}>{t(sv.d)}</Text>
          </View>
          <Text style={{ fontSize: 20, color: C.grisClair }}>›</Text>
        </TouchableOpacity>
      ))}

      {prochain && (
        <>
          <Text style={S.h2}>{t("prochain_rdv")}</Text>
          <TouchableOpacity
            style={S.cartePale}
            onPress={() => navigation.navigate("Suivi", { id: prochain.id })}
            activeOpacity={0.7}
          >
            <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 15.5 }}>
              n°{prochain.id} · {SERVICES_LIB[prochain.service] || prochain.service}
            </Text>
            <Text style={{ color: C.gris, marginTop: 3, marginBottom: 8 }}>
              {prochain.date?.replace("T", " à ")}{prochain.destination ? ` · ${prochain.destination}` : ""}
            </Text>
            <Pastille statut={prochain.statut} />
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}
