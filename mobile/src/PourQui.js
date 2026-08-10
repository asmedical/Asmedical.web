// « Pour qui est cette réservation ? »
//
// Un compte peut réserver pour quelqu'un d'autre : un proche du cercle
// familial, ou un patient rattaché quand c'est un établissement. La question
// se pose AVANT tout le reste, parce qu'elle change la suite — c'est le
// numéro du patient, pas celui du compte, qui doit suivre la demande.
//
// Même bloc que sur le site (app/components/pourqui.js), mêmes règles.
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { C, S } from "./theme";
import { Chip } from "./ui";
import { useLangue } from "./i18n";
import { apiGet } from "./api";
import { useAuth } from "./auth";
import { useParcours } from "./parcours";

export default function PourQui() {
  const { t } = useLangue();
  const auth = useAuth();
  const { demande, maj } = useParcours();
  const [rattaches, setRattaches] = useState([]);

  const pro = auth?.profil?.role === "pro";

  useEffect(() => {
    if (!auth?.user) return;
    let annule = false;
    apiGet(pro ? "/api/pro/rattachements" : "/api/proches")
      .then((d) => {
        if (annule) return;
        const liste = d?.rattachements || d?.proches || [];
        // Les deux routes ne disent pas l'expiration de la même façon : le
        // cercle familial renvoie un booléen déjà calculé, l'espace pro la
        // date brute. On refuse dans les deux cas — le serveur revalide de
        // toute façon la procuration à l'enregistrement.
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

  const choisir = (r) =>
    maj(
      r
        ? { pourPatient: r.patientTel, pourPatientNom: r.patientNom || r.patientTel, telephone: r.patientTel }
        : { pourPatient: "", pourPatientNom: "", telephone: "" }
    );

  if (!demande.pourPatient && rattaches.length === 0) return null;

  if (demande.pourPatient) {
    return (
      <View style={[S.cartePale, { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }]}>
        <Text style={{ flex: 1, color: C.vertFonce, fontWeight: "700" }}>
          👤 {t("pp_bandeau")} {demande.pourPatientNom}
        </Text>
        <TouchableOpacity onPress={() => choisir(null)} accessibilityRole="button">
          <Text style={{ color: C.vertFonce, fontWeight: "800", textDecorationLine: "underline" }}>
            {t("annuler")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Le choix n'apparaît que s'il y a un choix à faire : un compte sans aucun
  // rattachement n'a pas à répondre « pour moi ».
  return (
    <>
      <Text style={S.label}>{t("pr_pour_qui")}</Text>
      <View style={S.ligneChips}>
        <Chip titre={t("pr_moi")} actif onPress={() => choisir(null)} />
        {rattaches.map((r) => (
          <Chip
            key={r.id}
            titre={r.patientNom || r.patientTel}
            actif={false}
            onPress={() => choisir(r)}
          />
        ))}
      </View>
    </>
  );
}
