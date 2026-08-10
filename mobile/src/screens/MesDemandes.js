// Mes rendez-vous — MÊME présentation que le tableau de bord du site
// (app/tableau/page.js) : un mot d'accueil, les demandes désignées par leur
// service et non par un numéro de dossier, et le bouton de nouvelle demande
// toujours accessible en bas.
import React, { useCallback, useState } from "react";
import { Text, ScrollView, TouchableOpacity, RefreshControl, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, S } from "../theme";
import { Pastille, Charge, Bouton, SERVICES_LIB } from "../ui";
import { useLangue } from "../i18n";
import { apiGet } from "../api";
import { IcoVehicule, IcoMaison, IcoMedicaments } from "../icones";

const ICONES = { transport: IcoVehicule, domicile: IcoMaison, medicaments: IcoMedicaments };

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
      refreshControl={
        <RefreshControl
          refreshing={rafraichit}
          onRefresh={() => { setRafraichit(true); charger(); setTimeout(() => setRafraichit(false), 600); }}
          tintColor={C.vert}
        />
      }
    >
      <Text style={S.h1}>{t("mes_rdv_t")}</Text>

      {/* Mot d'accueil : le site en ouvre son tableau de bord. */}
      <View style={S.cartePale}>
        <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 16 }}>{t("bonjour")}</Text>
        <Text style={{ color: C.gris, marginTop: 3 }}>{t("bienvenue_p")}</Text>
      </View>

      {demandes === null && <Charge />}
      {demandes?.length === 0 && <Text style={S.vide}>{t("tableau_vide")}</Text>}

      {(demandes || []).map((d) => {
        const Icone = ICONES[d.service] || IcoVehicule;
        return (
          <TouchableOpacity
            key={d.id}
            style={[S.carte, { flexDirection: "row", alignItems: "center", marginBottom: 10 }]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("Suivi", { id: d.id })}
          >
            <View
              style={{
                width: 44, height: 44, borderRadius: 22, backgroundColor: C.vertPale,
                alignItems: "center", justifyContent: "center", marginRight: 12,
              }}
            >
              <Icone couleur={C.vertFonce} taille={22} />
            </View>
            <View style={{ flex: 1 }}>
              {/* Le nom du service, pas « n°128 » : un numéro de dossier ne
                  dit rien à un patient. */}
              <Text style={{ fontWeight: "800", color: C.encre, fontSize: 15.5 }}>
                {SERVICES_LIB[d.service] || d.service}
                {d.avis ? `  ${"★".repeat(d.avis.note)}` : ""}
              </Text>
              <Text style={{ color: C.gris, marginTop: 3, fontSize: 13.5 }}>
                {d.date ? d.date.replace("T", " · ") : "—"}
                {d.destination ? ` · ${d.destination}` : ""}
              </Text>
            </View>
            <Pastille statut={d.statut} />
          </TouchableOpacity>
        );
      })}

      <View style={{ height: 8 }} />
      <Bouton titre={t("nouvelle")} onPress={() => navigation.navigate("Reserver")} />
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}
