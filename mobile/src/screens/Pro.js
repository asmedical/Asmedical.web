// Espace établissement — tableau de bord et réservation au nom d'un patient
// rattaché. Mêmes routes que le site (/api/pro/tableau) ; le serveur
// revérifie le rôle « pro » à chaque appel (403 sinon).
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { C, S } from "../theme";
import { Bouton, Charge, proposerAppel, SERVICES_LIB } from "../ui";
import { useLangue, TEL_AFFICHE } from "../i18n";
import { apiGet } from "../api";

export default function Pro({ navigation }) {
  const { t } = useLangue();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [rafraichit, setRafraichit] = useState(false);

  const charger = useCallback(async () => {
    try {
      setData(await apiGet("/api/pro/tableau"));
      setErreur("");
    } catch (e) {
      setErreur(e?.data?.erreur || t("err_envoi"));
    }
  }, [t]);

  useEffect(() => { charger(); }, [charger]);

  if (!data && !erreur) return <View style={S.ecran}><Charge /></View>;

  const stats = data?.stats;
  const groupe = data?.groupe;

  return (
    <ScrollView
      style={S.ecran}
      contentContainerStyle={S.contenu}
      refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={async () => { setRafraichit(true); await charger(); setRafraichit(false); }} />}
    >
      <Text style={S.h1}>{t("pro_t")}</Text>
      {!!data?.etablissement && <Text style={S.sous}>{data.etablissement}</Text>}

      {!!erreur && <Text style={S.erreur}>{erreur}</Text>}

      {stats ? (
        <View style={[S.cartePale, { borderColor: C.vert }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
            <Text style={{ color: C.encre, fontWeight: "700" }}>{t("pro_demandes_mois")}</Text>
            <Text style={{ color: C.vertFonce, fontWeight: "800" }}>{stats.moisCourant ?? stats.mois ?? 0}</Text>
          </View>
          {stats.resteDu != null && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
              <Text style={{ color: C.encre, fontWeight: "700" }}>{t("pro_reste_du")}</Text>
              <Text style={{ color: C.vertFonce, fontWeight: "800" }}>
                {Number(stats.resteDu).toLocaleString("fr-FR")} DZD
              </Text>
            </View>
          )}
        </View>
      ) : (
        !erreur && <Text style={S.vide}>{t("pro_aucune_stat")}</Text>
      )}

      {Array.isArray(groupe?.sites) && groupe.sites.length > 0 && (
        <>
          <Text style={[S.label, { marginTop: 16, fontSize: 15 }]}>{t("pro_groupe")}</Text>
          {groupe.sites.map((s2, i) => (
            <View key={i} style={[S.carte, { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }]}>
              <Text style={{ color: C.encre, fontWeight: "700", flex: 1 }}>{s2.nom}</Text>
              <Text style={{ color: C.gris }}>{s2.demandesMois}</Text>
            </View>
          ))}
        </>
      )}

      {/* Réservation au nom d'un patient : entrée dans le parcours guidé. */}
      <Text style={[S.label, { marginTop: 20, fontSize: 15 }]}>{t("pro_reserver")}</Text>
      {Object.keys(SERVICES_LIB).map((s3) => (
        <View key={s3} style={{ marginBottom: 8 }}>
          <Bouton titre={SERVICES_LIB[s3]} onPress={() => navigation.navigate("ParcoursBesoin", { service: s3 })} />
        </View>
      ))}

      <TouchableOpacity onPress={() => proposerAppel(t)} style={{ marginTop: 26, alignItems: "center" }}>
        <Text style={{ color: C.gris }}>
          {t("urgence")} <Text style={{ color: C.vertFonce, fontWeight: "800" }}>{TEL_AFFICHE}</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
