// Demander un devis — écran natif, même formulaire et même API que le site
// (/api/devis). Un établissement ou une famille doit pouvoir décrire son
// besoin depuis son téléphone, sans passer par le navigateur.
import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { C, S } from "../theme";
import { Bouton, Chip } from "../ui";
import { useLangue } from "../i18n";
import { apiPost } from "../api";

const SERVICES = [
  { valeur: "", cle: "dv_service_tous" },
  { valeur: "transport", cle: "s_transport" },
  { valeur: "domicile", cle: "s_domicile" },
  { valeur: "medicaments", cle: "s_medic" },
];

export default function Devis() {
  const { t } = useLangue();
  const [f, setF] = useState({ nom: "", telephone: "", email: "", service: "", besoin: "" });
  const [etat, setEtat] = useState("saisie"); // saisie | envoi | ok
  const [numero, setNumero] = useState("");
  const [erreur, setErreur] = useState("");

  async function envoyer() {
    if (etat === "envoi") return;
    setErreur("");
    if (!f.nom.trim() || !f.telephone.trim() || !f.besoin.trim()) return setErreur(t("err_champs"));
    setEtat("envoi");
    try {
      const d = await apiPost("/api/devis", f);
      setNumero(d?.numero || "");
      setEtat("ok");
    } catch (e) {
      // Le serveur distingue « besoin trop court » du reste : autant le dire.
      setErreur(e?.data?.erreur === "besoin_trop_court" ? t("dv_err_besoin") : t("dv_err"));
      setEtat("saisie");
    }
  }

  if (etat === "ok") {
    return (
      <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
        <Text style={S.h1}>{t("dv_t")}</Text>
        <View style={[S.carte, { backgroundColor: C.vertPale, borderColor: C.vert }]}>
          <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 16 }}>
            {t("dv_ok_t")}{numero ? ` (${numero})` : ""}
          </Text>
          <Text style={{ color: C.encre, marginTop: 6, lineHeight: 21 }}>{t("dv_ok_p")}</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={S.ecran} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
        <Text style={S.h1}>{t("dv_t")}</Text>
        <Text style={S.sous}>{t("dv_s")}</Text>

        <Text style={S.label}>{t("pr_nom_l")} *</Text>
        <TextInput style={S.champ} placeholder={t("pr_nom_ph")} placeholderTextColor={C.grisClair}
                   value={f.nom} onChangeText={(v) => setF({ ...f, nom: v })} />

        <Text style={S.label}>{t("tel_l")} *</Text>
        <TextInput style={S.champ} placeholder={t("tel_ph")} placeholderTextColor={C.grisClair}
                   keyboardType="phone-pad" value={f.telephone} onChangeText={(v) => setF({ ...f, telephone: v })} />

        <Text style={S.label}>{t("email_l")}</Text>
        <TextInput style={S.champ} placeholder={t("email_ph")} placeholderTextColor={C.grisClair}
                   autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
                   value={f.email} onChangeText={(v) => setF({ ...f, email: v })} />

        <Text style={S.label}>{t("dv_service_l")}</Text>
        <View style={S.ligneChips}>
          {SERVICES.map((sv) => (
            <Chip key={sv.cle} titre={t(sv.cle)} actif={f.service === sv.valeur}
                  onPress={() => setF({ ...f, service: sv.valeur })} />
          ))}
        </View>

        <Text style={S.label}>{t("dv_besoin_l")} *</Text>
        <TextInput
          style={[S.champ, { height: 120, textAlignVertical: "top", paddingTop: 12 }]}
          placeholder={t("dv_besoin_ph")}
          placeholderTextColor={C.grisClair}
          value={f.besoin}
          onChangeText={(v) => setF({ ...f, besoin: v })}
          multiline
        />

        {!!erreur && <Text style={S.erreur}>{erreur}</Text>}
        <Bouton titre={t("dv_envoyer")} onPress={envoyer} charge={etat === "envoi"} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
