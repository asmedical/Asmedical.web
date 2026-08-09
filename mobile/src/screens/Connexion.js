// Connexion : code SMS / WhatsApp ou identifiant + mot de passe.
// Mêmes comptes que le site (Supabase partagé).
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Image, TouchableOpacity, Linking, KeyboardAvoidingView, Platform } from "react-native";
import { C, S } from "../theme";
import { Bouton, Chip, proposerAppel, ChampMotDePasse } from "../ui";
import { useLangue, TEL_AFFICHE, TEL_LIEN } from "../i18n";
import { envoyerCode, verifierCode, connexionIdentifiant, normaliserTel } from "../supabase";
import { API_BASE, apiPost, apiGet } from "../api";

const INDICATIFS = ["+213", "+33", "+216", "+212", "+32", "+41", "+49", "+44", "+1", "+34", "+39"];

export default function Connexion() {
  const { t } = useLangue();
  // Écran par défaut : le plus simple possible (téléphone ou e-mail + mot de
  // passe), comme sur le site. La connexion rapide par SMS / WhatsApp est
  // rangée derrière « Autre méthode de connexion ».
  const [mode, setMode] = useState("mdp"); // mdp | sms
  const [etape, setEtape] = useState("tel"); // tel | code
  const [indicatif, setIndicatif] = useState("+213");
  const [tel, setTel] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [code, setCode] = useState("");
  const [canal, setCanal] = useState("sms");
  const [waActif, setWaActif] = useState(false);
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    apiGet("/api/otp-canal").then((d) => setWaActif(!!d?.whatsapp)).catch(() => {});
  }, []);

  async function demanderCode() {
    setErreur("");
    const p = normaliserTel(tel, indicatif);
    if (p.replace(/\D/g, "").length < 10) return setErreur(t("err_tel_format"));
    setOccupe(true);
    try {
      if (waActif) {
        try { await apiPost("/api/otp-canal", { phone: p, canal }); } catch {}
      }
      await envoyerCode(p);
      setPhoneE164(p);
      setEtape("code");
    } catch {
      setErreur(t("err_sms"));
    }
    setOccupe(false);
  }

  async function validerCode() {
    setErreur("");
    setOccupe(true);
    try {
      await verifierCode(phoneE164, code.trim());
      // La session déclenche la navigation (App.js écoute l'état d'auth).
    } catch {
      setErreur(t("err_code"));
      setOccupe(false);
    }
  }

  async function validerIdentifiant() {
    setErreur("");
    if (!identifiant.trim() || !motDePasse) return setErreur(t("err_champs"));
    setOccupe(true);
    try {
      await connexionIdentifiant(identifiant, motDePasse);
    } catch {
      setErreur(t("err_identifiant"));
      setOccupe(false);
    }
  }

  return (
    <KeyboardAvoidingView style={S.ecran} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[S.contenu, { paddingTop: 60 }]} keyboardShouldPersistTaps="handled">
        <Image source={require("../../assets/icon.png")} style={{ width: 72, height: 72, borderRadius: 20, alignSelf: "center", marginBottom: 16 }} />
        <Text style={[S.h1, { textAlign: "center" }]}>{t("connexion_t")}</Text>

        <View style={{ height: 14 }} />

        {/* ---- Écran par défaut : téléphone ou e-mail + mot de passe ---- */}
        {mode === "mdp" && (
          <>
            <Text style={S.label}>{t("id_tel_email_l")}</Text>
            <TextInput
              style={S.champ}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t("id_tel_email_ph")}
              placeholderTextColor={C.grisClair}
              value={identifiant}
              onChangeText={setIdentifiant}
            />
            <Text style={S.label}>{t("mdp2_l")}</Text>
            <ChampMotDePasse value={motDePasse} onChangeText={setMotDePasse} placeholder={t("mdp_ph")} />
            <Bouton titre={t("connexion_b")} onPress={validerIdentifiant} charge={occupe} />

            {/* Deux liens seulement : aide + autre méthode. */}
            <View style={{ flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 20, marginTop: 20 }}>
              <TouchableOpacity onPress={() => proposerAppel(t)}>
                <Text style={{ color: C.gris, fontWeight: "700", textDecorationLine: "underline" }}>{t("aide_lien")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setMode("sms"); setEtape("tel"); setErreur(""); }}>
                <Text style={{ color: C.gris, fontWeight: "700", textDecorationLine: "underline" }}>{t("autre_methode")}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {mode === "sms" && etape === "tel" && (
          <>
            <Text style={S.sous}>{t("autre_methode_s")}</Text>
            <Text style={S.label}>{t("tel_l")}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ width: 92 }}>
                <ScrollView horizontal={false} style={{ maxHeight: 50 }}>
                  <TouchableOpacity
                    style={[S.champ, { alignItems: "center" }]}
                    onPress={() => {
                      const i = INDICATIFS.indexOf(indicatif);
                      setIndicatif(INDICATIFS[(i + 1) % INDICATIFS.length]);
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "700", color: C.encre }}>{indicatif}</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
              <TextInput
                style={[S.champ, { flex: 1 }]}
                placeholder={t("tel_ph")}
                placeholderTextColor={C.grisClair}
                keyboardType="phone-pad"
                value={tel}
                onChangeText={setTel}
              />
            </View>
            {waActif && (
              <>
                <Text style={S.label}>{t("canal_l")}</Text>
                <View style={S.ligneChips}>
                  <Chip titre="SMS" actif={canal === "sms"} onPress={() => setCanal("sms")} />
                  <Chip titre="WhatsApp" actif={canal === "whatsapp"} onPress={() => setCanal("whatsapp")} />
                </View>
                <View style={{ height: 8 }} />
              </>
            )}
            <Bouton titre={t("otp_envoyer")} onPress={demanderCode} charge={occupe} />
            <TouchableOpacity
              onPress={() => { setMode("mdp"); setEtape("tel"); setErreur(""); }}
              style={{ alignItems: "center", marginTop: 18 }}
            >
              <Text style={{ color: C.vert, fontWeight: "700" }}>{t("retour_mdp")}</Text>
            </TouchableOpacity>
          </>
        )}

        {mode === "sms" && etape === "code" && (
          <>
            <Text style={S.sous}>
              {t("otp_envoye_a")} <Text style={{ fontWeight: "800", color: C.encre }}>{phoneE164}</Text>
            </Text>
            <TextInput
              style={[S.champ, { textAlign: "center", fontSize: 24, letterSpacing: 8, fontWeight: "800" }]}
              keyboardType="number-pad"
              maxLength={8}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
              autoFocus
            />
            <Bouton titre={t("otp_valider")} onPress={validerCode} charge={occupe} desactive={code.length < 4} />
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 14 }}>
              <TouchableOpacity onPress={() => { setEtape("tel"); setCode(""); setErreur(""); }}>
                <Text style={{ color: C.vert, fontWeight: "700" }}>{t("otp_changer")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={demanderCode}>
                <Text style={{ color: C.vert, fontWeight: "700" }}>{t("otp_renvoyer")}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {!!erreur && <Text style={S.erreur}>{erreur}</Text>}

        <TouchableOpacity onPress={() => proposerAppel(t)} style={{ marginTop: 28, alignItems: "center" }}>
          <Text style={{ color: C.gris }}>
            {t("urgence")} <Text style={{ color: C.vertFonce, fontWeight: "800" }}>{TEL_AFFICHE}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
