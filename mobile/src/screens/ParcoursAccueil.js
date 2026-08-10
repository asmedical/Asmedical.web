// Point d'entrée du parcours de réservation.
//
// Deux questions avant tout le reste : POUR QUI, puis QUELLE PRESTATION.
//
// « Pour qui » vient en premier parce qu'il change le reste : un
// établissement qui réserve pour un patient rattaché engage sa procuration,
// et c'est le numéro du patient — pas celui du compte — qui doit suivre la
// demande. Poser la question à la fin obligerait à revenir en arrière.
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { C, S } from "../theme";
import { Chip } from "../ui";
import { useLangue } from "../i18n";
import { apiGet } from "../api";
import { useAuth } from "../auth";
import { useParcours } from "../parcours";
import { IcoVehicule, IcoMaison, IcoMedicaments } from "../icones";

const SERVICES = [
  { cle: "transport", Ico: IcoVehicule, titre: "s_transport", detail: "s_transport_d" },
  { cle: "domicile", Ico: IcoMaison, titre: "s_domicile", detail: "s_domicile_d" },
  { cle: "medicaments", Ico: IcoMedicaments, titre: "s_medic", detail: "s_medic_d" },
];

export default function ParcoursAccueil({ navigation }) {
  const { t } = useLangue();
  const auth = useAuth();
  const { demande, maj, reinitialiser } = useParcours();
  const [rattaches, setRattaches] = useState([]);

  const pro = auth?.profil?.role === "pro";

  // Nouvelle demande : on repart d'une feuille blanche. Les réponses d'une
  // demande précédente n'ont rien à faire dans celle-ci.
  useEffect(() => {
    const stop = navigation.addListener("focus", () => reinitialiser());
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  // Personnes pour lesquelles ce compte peut réserver : proches du cercle
  // familial côté patient, patients rattachés côté établissement. Les deux
  // reposent sur une procuration ACCEPTE et non expirée — le serveur la
  // revérifie de toute façon à l'enregistrement.
  useEffect(() => {
    if (!auth?.user) return;
    let annule = false;
    apiGet(pro ? "/api/pro/rattachements" : "/api/proches")
      .then((d) => {
        if (annule) return;
        const liste = d?.rattachements || d?.proches || [];
        // Les deux routes ne disent pas l'expiration de la même façon : le
        // cercle familial renvoie un booléen déjà calculé, l'espace pro la
        // date brute. On refuse dans les deux cas.
        setRattaches(
          liste.filter(
            (x) =>
              x.statut === "ACCEPTE" &&
              !x.expiree &&
              (!x.expiration || new Date(x.expiration).getTime() > Date.now())
          )
        );
      })
      .catch(() => {});
    return () => { annule = true; };
  }, [auth?.user, pro]);

  const choisirPatient = (r) =>
    maj(
      r
        ? { pourPatient: r.patientTel, pourPatientNom: r.patientNom || r.patientTel, telephone: r.patientTel }
        : { pourPatient: "", pourPatientNom: "", telephone: "" }
    );

  function choisir(service) {
    maj({ service });
    navigation.navigate("ParcoursBesoin", { service });
  }

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      {!!demande.pourPatient && (
        <View style={[S.cartePale, { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }]}>
          <Text style={{ flex: 1, color: C.vertFonce, fontWeight: "700" }}>
            👤 {t("pp_bandeau")} {demande.pourPatientNom}
          </Text>
          <TouchableOpacity onPress={() => choisirPatient(null)} accessibilityRole="button">
            <Text style={{ color: C.vertFonce, fontWeight: "800", textDecorationLine: "underline" }}>
              {t("annuler")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Le choix n'apparaît que s'il y a un choix à faire : un compte sans
          aucun rattachement n'a pas besoin de répondre « pour moi ». */}
      {!demande.pourPatient && rattaches.length > 0 && (
        <>
          <Text style={S.label}>{t("pr_pour_qui")}</Text>
          <View style={S.ligneChips}>
            <Chip titre={t("pr_moi")} actif onPress={() => choisirPatient(null)} />
            {rattaches.map((r) => (
              <Chip
                key={r.id}
                titre={r.patientNom || r.patientTel}
                actif={false}
                onPress={() => choisirPatient(r)}
              />
            ))}
          </View>
        </>
      )}

      <Text style={S.h1}>{t("pc_service_q")}</Text>

      {SERVICES.map((s) => (
        <TouchableOpacity
          key={s.cle}
          onPress={() => choisir(s.cle)}
          accessibilityRole="button"
          style={[S.carte, { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 10, minHeight: 76 }]}
        >
          <s.Ico couleur={C.vert} taille={28} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16.5, fontWeight: "800", color: C.encre }}>{t(s.titre)}</Text>
            <Text style={{ fontSize: 14, color: C.gris, marginTop: 2 }}>{t(s.detail)}</Text>
          </View>
        </TouchableOpacity>
      ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
