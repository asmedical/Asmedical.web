// Mes proches — écran natif, même API que le site (/api/proches).
// Deux façons d'obtenir un accès, comme sur le site : saisir le code que le
// patient a reçu, ou lui envoyer une demande qu'il accepte. Le fil de
// discussion par demande reste sur le site : il mérite son propre écran, et
// n'a pas sa place dans une liste.
import React, { useCallback, useState } from "react";
import { View, Text, TextInput, ScrollView, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, S } from "../theme";
import { Bouton, Chip, Charge, SERVICES_LIB } from "../ui";
import { useLangue } from "../i18n";
import { apiGet, apiPost } from "../api";

const STATUTS = {
  ACCEPTE: { cle: "pr_st_ok", couleur: "#0E6B3F" },
  EN_ATTENTE: { cle: "pr_st_attente", couleur: "#8A7A2E" },
  REFUSE: { cle: "pr_st_refuse", couleur: "#B03A3A" },
  REVOQUE: { cle: "pr_st_revoque", couleur: "#B03A3A" },
};

export default function Proches() {
  const { t } = useLangue();
  const [proches, setProches] = useState(null);
  const [mode, setMode] = useState("code"); // code | invitation
  const [code, setCode] = useState("");
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState("");

  const charger = useCallback(() => {
    apiGet("/api/proches")
      .then((d) => setProches(d?.proches || []))
      .catch(() => setProches([]));
  }, []);

  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  async function ajouter() {
    if (occupe) return;
    setOccupe(true);
    setMessage("");
    try {
      if (mode === "code") {
        const c = code.trim().toUpperCase();
        if (!c) throw new Error(t("pr_err_code"));
        await apiPost("/api/proches", { mode: "code", code: c });
        setCode("");
        setMessage(t("pr_code_ok"));
      } else {
        if (!nom.trim() || !tel.trim()) throw new Error(t("err_champs"));
        await apiPost("/api/proches", { mode: "invitation", nom: nom.trim(), telephone: tel.trim() });
        setNom("");
        setTel("");
        setMessage(t("pr_invit_ok"));
      }
      charger();
    } catch (e) {
      // Le serveur nomme précisément le refus : code faux, code expiré,
      // déjà rattaché, numéro invalide. On le traduit plutôt que de servir
      // un « une erreur est survenue » qui n'aide personne.
      const ERREURS = {
        code_invalide: t("pr_err_code"),
        code_expire: t("pr_err_code_expire"),
        deja_rattache: t("pr_err_deja"),
        telephone_invalide: t("err_tel_format"),
      };
      const cle = e?.data?.erreur;
      setMessage(ERREURS[cle] || e?.message || t("pr_err"));
    }
    setOccupe(false);
  }

  function retirer(lien) {
    Alert.alert("ASM", t("pr_retirer_conf"), [
      { text: t("annuler"), style: "cancel" },
      {
        text: t("pr_retirer_b"),
        style: "destructive",
        onPress: async () => {
          try {
            await apiPost("/api/proches", { action: "retirer", id: lien.id });
            charger();
          } catch {
            setMessage(t("pr_err"));
          }
        },
      },
    ]);
  }

  if (proches === null) return <View style={S.ecran}><Charge /></View>;

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
      <Text style={S.h1}>{t("pr_t")}</Text>
      <Text style={S.sous}>{t("pr_s")}</Text>

      <Text style={S.h2}>{t("pr_ajouter_t")}</Text>
      <View style={S.ligneChips}>
        <Chip titre={t("pr_mode_code")} actif={mode === "code"} onPress={() => { setMode("code"); setMessage(""); }} />
        <Chip titre={t("pr_mode_invit")} actif={mode === "invitation"} onPress={() => { setMode("invitation"); setMessage(""); }} />
      </View>

      {mode === "code" ? (
        <>
          <Text style={{ color: C.gris, fontSize: 13.5, marginTop: 8 }}>{t("pr_code_aide")}</Text>
          <TextInput
            style={S.champ}
            placeholder="ASM-XXXX00"
            placeholderTextColor={C.grisClair}
            autoCapitalize="characters"
            autoCorrect={false}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
          />
        </>
      ) : (
        <>
          <Text style={{ color: C.gris, fontSize: 13.5, marginTop: 8 }}>{t("pr_invit_aide")}</Text>
          <Text style={S.label}>{t("pr_nom_l")}</Text>
          <TextInput style={S.champ} placeholder={t("pr_nom_ph")} placeholderTextColor={C.grisClair}
                     value={nom} onChangeText={setNom} />
          <Text style={S.label}>{t("tel_l")}</Text>
          <TextInput style={S.champ} placeholder="0550 12 34 56" placeholderTextColor={C.grisClair}
                     keyboardType="phone-pad" value={tel} onChangeText={setTel} />
        </>
      )}

      <Bouton titre={t("pr_ajouter_b")} onPress={ajouter} charge={occupe} />
      {!!message && <Text style={{ color: C.vertFonce, fontWeight: "700", marginTop: 10 }}>{message}</Text>}

      <Text style={S.h2}>{t("pr_t")}</Text>
      {proches.length === 0 && <Text style={S.vide}>{t("pr_vide")}</Text>}

      {proches.map((p) => {
        const st = STATUTS[p.statut] || { cle: null, couleur: C.gris };
        return (
          <View key={p.id} style={[S.carte, { marginBottom: 10 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: C.encre, fontSize: 15.5 }}>
                  {p.patientNom || p.patientTel}
                </Text>
                <Text style={{ color: C.gris, fontSize: 13, marginTop: 2 }}>
                  {p.patientTel}
                  {p.expiration ? ` · ${t("pr_jusquau")} ${p.expiration}` : ""}
                </Text>
              </View>
              <Text style={{ fontWeight: "800", fontSize: 13, color: st.couleur }}>
                {st.cle ? t(st.cle) : p.statut}
              </Text>
            </View>

            {p.statut === "EN_ATTENTE" && (
              <Text style={{ color: C.gris, fontSize: 13, marginTop: 8 }}>{t("pr_attente_aide")}</Text>
            )}

            {/* Les prestations déjà réalisées pour ce proche : de quoi savoir
                ce qui s'est passé sans appeler. */}
            {p.statut === "ACCEPTE" && !p.expiree && (p.demandes || []).length > 0 && (
              <View style={{ borderTopWidth: 1, borderTopColor: C.ligne, marginTop: 10, paddingTop: 8 }}>
                {p.demandes.map((dm) => (
                  <View key={dm.id} style={{ paddingVertical: 6 }}>
                    <Text style={{ color: C.encre, fontWeight: "700", fontSize: 14 }}>
                      {SERVICES_LIB[dm.service] || dm.service} · {String(dm.date || "").slice(0, 10)}
                      {dm.date ? ` · ${String(dm.date).slice(11, 16)}` : ""}
                    </Text>
                    {!!dm.compteRendu && (
                      <Text style={{ color: C.gris, fontSize: 13, marginTop: 2 }}>
                        {t("pr_cr")} : {dm.compteRendu}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {["ACCEPTE", "EN_ATTENTE"].includes(p.statut) && (
              <View style={{ marginTop: 10 }}>
                <Bouton
                  secondaire
                  titre={p.statut === "EN_ATTENTE" ? t("pr_annuler_b") : t("pr_retirer_b")}
                  onPress={() => retirer(p)}
                />
              </View>
            )}
          </View>
        );
      })}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
