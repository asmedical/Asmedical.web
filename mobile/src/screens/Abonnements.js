// Abonnements ASM — écran natif, mêmes plans et même API que le site
// (/api/plans). Souscrire crée une souscription en attente de paiement :
// l'abonnement ne s'active qu'une fois la facture réglée, comme sur le site.
import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, S } from "../theme";
import { Bouton, Charge } from "../ui";
import { useLangue } from "../i18n";
import { apiGet, apiPost } from "../api";

const DA = (n) => `${Number(n || 0).toLocaleString("fr-FR")} DZD`;
const LIB_SERVICE = { transport: "s_transport", domicile: "s_domicile", medicaments: "s_medic" };

export default function Abonnements({ navigation }) {
  const { t } = useLangue();
  const [donnees, setDonnees] = useState(null);
  const [occupe, setOccupe] = useState(0);
  const [message, setMessage] = useState("");

  const charger = useCallback(() => {
    apiGet("/api/plans")
      .then((d) => setDonnees(d || { plans: [] }))
      .catch(() => setDonnees({ plans: [] }));
  }, []);

  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  async function souscrire(plan) {
    if (occupe) return;
    setOccupe(plan.id);
    setMessage("");
    try {
      await apiPost("/api/plans", { planId: plan.id });
      setMessage(t("abo_souscrit_ok"));
      charger();
    } catch (e) {
      setMessage(e?.data?.erreur || t("abo_err"));
    }
    setOccupe(0);
  }

  if (donnees === null) return <View style={S.ecran}><Charge /></View>;

  const plans = donnees.plans || [];
  const mienne = donnees.mienne;

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Text style={S.h1}>{t("abo_t2")}</Text>
      <Text style={S.sous}>{t("abo_s2")}</Text>

      {/* Abonnement en cours — et, s'il attend un paiement, l'accès direct
          aux factures : c'est l'action qui débloque la situation. */}
      {!!mienne && (
        <View style={[S.carte, { backgroundColor: C.vertPale, borderColor: C.vert }]}>
          <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 15.5 }}>
            {t("abo_actif_t")} : {mienne.plan}
          </Text>
          {mienne.enAttentePaiement ? (
            <>
              <Text style={{ color: C.encre, marginTop: 6 }}>{t("abo_attente_paiement")}</Text>
              <View style={{ height: 10 }} />
              <Bouton titre={t("abo_payer_facture")} onPress={() => navigation.navigate("Paiements")} />
            </>
          ) : (
            !!mienne.fin && (
              <Text style={{ color: C.gris, marginTop: 6 }}>
                {t("aut_expire")} {mienne.fin}
              </Text>
            )
          )}
        </View>
      )}

      {plans.length === 0 && <Text style={S.vide}>{t("cloche_vide")}</Text>}

      {plans.map((p) => (
        <View
          key={p.id}
          style={[S.carte, { marginBottom: 10 }, p.populaire && { borderColor: C.vert, borderWidth: 2 }]}
        >
          {p.populaire && (
            <Text style={{ color: C.vertFonce, fontWeight: "800", fontSize: 12, marginBottom: 4 }}>
              {t("abo_populaire")}
            </Text>
          )}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text style={{ fontWeight: "800", color: C.encre, fontSize: 16, flex: 1, paddingRight: 10 }}>
              {p.nom}
            </Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 16 }}>{DA(p.prix)}</Text>
              <Text style={{ color: C.gris, fontSize: 12 }}>
                {p.frequence === "annuel" ? t("abo_prix_an") : t("abo_prix_mois")}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            <Text style={{ color: C.gris, lineHeight: 21 }}>
              · {p.quantiteIncluse ? `${p.quantiteIncluse} ${t("abo_inclus")}` : t("abo_illimite")}
            </Text>
            <Text style={{ color: C.gris, lineHeight: 21 }}>
              · {p.service ? t(LIB_SERVICE[p.service] || "s_transport") : t("abo_tous_services")}
            </Text>
            {p.reductionPct > 0 && (
              <Text style={{ color: C.gris, lineHeight: 21 }}>· −{p.reductionPct} % {t("abo_reduc")}</Text>
            )}
          </View>

          <View style={{ height: 10 }} />
          <TouchableOpacity
            accessibilityRole="button"
            disabled={mienne?.planId === p.id || !!occupe}
            onPress={() => souscrire(p)}
            style={{
              minHeight: 50, borderRadius: 12, alignItems: "center", justifyContent: "center",
              backgroundColor: mienne?.planId === p.id ? C.vertPale : C.vert,
              opacity: occupe === p.id ? 0.5 : 1,
            }}
          >
            <Text
              style={{
                fontWeight: "800", fontSize: 15.5,
                color: mienne?.planId === p.id ? C.vertFonce : C.blanc,
              }}
            >
              {mienne?.planId === p.id ? "✓" : t("abo_souscrire")}
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      {!!message && (
        <Text style={{ color: C.vertFonce, fontWeight: "700", marginTop: 10, textAlign: "center" }}>
          {message}
        </Text>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
