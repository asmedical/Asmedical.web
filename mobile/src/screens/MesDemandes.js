// Mes rendez-vous — MÊME présentation que le tableau de bord du site
// (app/tableau/page.js) : un mot d'accueil, les demandes désignées par leur
// service et non par un numéro de dossier, et le bouton de nouvelle demande
// toujours accessible en bas.
import React, { useCallback, useState } from "react";
import { Text, ScrollView, TouchableOpacity, RefreshControl, View, Linking } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, S } from "../theme";
import { Pastille, Charge, Bouton, SERVICES_LIB } from "../ui";
import { useLangue } from "../i18n";
import { apiGet, API_BASE } from "../api";
import { IcoVehicule, IcoMaison, IcoMedicaments } from "../icones";

const ICONES = { transport: IcoVehicule, domicile: IcoMaison, medicaments: IcoMedicaments };

// Rappel des sommes dues — le site l'affiche sur son tableau de bord. Sans
// lui, un patient en retard de paiement ne l'apprenait jamais depuis
// l'application. Le règlement se fait sur le site : il s'agit d'un service
// réel (transport, aide à domicile), pas d'un achat dans l'application.
function RappelPaiement({ t }) {
  const [resume, setResume] = useState(null);

  useFocusEffect(
    useCallback(() => {
      apiGet("/api/finances/moi")
        .then((d) => setResume(d?.resume || null))
        .catch(() => setResume(null));
    }, [])
  );

  if (!resume || resume.duTotal <= 0) return null;
  const retard = resume.enRetard > 0;
  const montant = retard ? resume.enRetard : resume.duTotal;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => Linking.openURL(`${API_BASE}/compte/paiements`).catch(() => {})}
      style={[
        S.carte,
        {
          borderColor: retard ? "#E3B7B7" : C.vert,
          backgroundColor: retard ? "#FBEDED" : C.vertPale,
          marginBottom: 12,
        },
      ]}
    >
      <Text style={{ fontWeight: "800", color: retard ? "#B03A3A" : C.vertFonce, fontSize: 15.5 }}>
        {retard ? t("pf_retard_t") : t("pf_du_t")}
      </Text>
      <Text style={{ color: C.encre, fontWeight: "800", fontSize: 20, marginTop: 6 }}>
        {Number(montant).toLocaleString("fr-FR")} DZD
      </Text>
      <Text style={{ color: C.vertFonce, fontWeight: "700", marginTop: 8 }}>{t("pf_payer")} →</Text>
    </TouchableOpacity>
  );
}

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

      <RappelPaiement t={t} />

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
