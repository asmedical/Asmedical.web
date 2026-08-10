// Problème de connexion ? — écran natif, même parcours que le site
// (app/aide-connexion/page.js) : mot de passe oublié (code par e-mail),
// identifiant oublié (→ code SMS), code non reçu (astuces), appeler.
//
// C'est l'écran qu'on atteint quand plus rien ne marche : il ne doit pas
// exiger d'ouvrir un navigateur, où l'utilisateur devrait de toute façon
// se connecter — ce qu'il n'arrive justement pas à faire.
import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { C, S } from "../theme";
import { Bouton, ChampMotDePasse, proposerAppel } from "../ui";
import { useLangue, TEL_AFFICHE } from "../i18n";
import { envoyerCodeEmail, verifierCodeEmail, changerMotDePasse } from "../supabase";

function Option({ titre, detail, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      style={[S.carte, { marginBottom: 10, minHeight: 66, justifyContent: "center" }]}
    >
      <Text style={{ fontWeight: "800", color: C.encre, fontSize: 15.5 }}>{titre}</Text>
      {!!detail && <Text style={{ color: C.gris, marginTop: 3, lineHeight: 20 }}>{detail}</Text>}
    </TouchableOpacity>
  );
}

export default function AideConnexion({ route, navigation }) {
  const { t } = useLangue();
  const sujet = route?.params?.sujet;
  const [vue, setVue] = useState(sujet === "mdp" || sujet === "code_sms" ? sujet : "menu");
  const [etape, setEtape] = useState("email"); // email | code | nouveau | ok
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mdp1, setMdp1] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  async function envoyer() {
    setErreur("");
    if (!/\S+@\S+\.\S+/.test(email.trim())) return setErreur(t("err_email"));
    setOccupe(true);
    try {
      await envoyerCodeEmail(email.trim());
      setEtape("code");
    } catch (e) {
      // Un envoi qui échoue et un compte inexistant n'appellent pas la même
      // réaction : réessayer, ou vérifier l'adresse.
      const m = (e?.message || "").toLowerCase();
      const echecEnvoi = e?.status >= 500 || m.includes("send") || m.includes("mail") || m.includes("smtp");
      setErreur(echecEnvoi ? t("err_envoi_email") : t("err_email_introuvable"));
    }
    setOccupe(false);
  }

  async function verifier() {
    setErreur("");
    setOccupe(true);
    try {
      await verifierCodeEmail(email.trim(), code.trim());
      setEtape("nouveau");
    } catch {
      setErreur(t("err_code_email"));
    }
    setOccupe(false);
  }

  async function enregistrer() {
    setErreur("");
    if (mdp1.length < 6) return setErreur(t("err_mdp"));
    if (mdp1 !== mdp2) return setErreur(t("err_mdp_conf"));
    setOccupe(true);
    try {
      await changerMotDePasse(mdp1);
      setEtape("ok");
    } catch (e) {
      const m = (e?.message || "").toLowerCase();
      if (m.includes("different")) setErreur(t("err_mdp_different"));
      else if (m.includes("session") || m.includes("expired") || m.includes("jwt")) setErreur(t("err_mdp_expire"));
      else setErreur(t("err_mdp_maj"));
    }
    setOccupe(false);
  }

  const Appeler = () => (
    <TouchableOpacity onPress={() => proposerAppel(t)} style={[S.carte, { marginBottom: 10 }]}>
      <Text style={{ fontWeight: "800", color: C.encre, fontSize: 15.5 }}>{t("aide_agent_t")}</Text>
      <Text style={{ color: C.vertFonce, fontWeight: "800", marginTop: 3 }}>{TEL_AFFICHE}</Text>
    </TouchableOpacity>
  );

  const Retour = () => (
    <TouchableOpacity onPress={() => { setVue("menu"); setErreur(""); }} style={{ marginBottom: 12 }}>
      <Text style={{ color: C.vert, fontWeight: "700" }}>← {t("retour")}</Text>
    </TouchableOpacity>
  );

  // ---------------------------------------------------- Mot de passe oublié
  if (vue === "mdp") {
    return (
      <KeyboardAvoidingView style={S.ecran} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
          <Retour />
          <Text style={S.h1}>{t("mdp_oub_t")}</Text>

          {etape === "email" && (
            <>
              <Text style={S.sous}>{t("mdp_oub_email")}</Text>
              <Text style={S.label}>{t("email_l")}</Text>
              <TextInput style={S.champ} autoCapitalize="none" autoCorrect={false}
                         keyboardType="email-address" placeholder={t("email_ph")}
                         placeholderTextColor={C.grisClair} value={email} onChangeText={setEmail} />
              <Bouton titre={t("mdp_oub_envoyer")} onPress={envoyer} charge={occupe} />
            </>
          )}

          {etape === "code" && (
            <>
              <Text style={S.sous}>{t("mdp_oub_code")}</Text>
              <Text style={S.label}>{t("code_l")}</Text>
              <TextInput
                style={[S.champ, { textAlign: "center", fontSize: 24, letterSpacing: 8, fontWeight: "800" }]}
                keyboardType="number-pad" maxLength={8} value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, ""))} autoFocus
              />
              <Bouton titre={t("otp_valider")} onPress={verifier} charge={occupe} desactive={code.length < 4} />
              <TouchableOpacity onPress={envoyer} style={{ alignItems: "center", marginTop: 14 }}>
                <Text style={{ color: C.vert, fontWeight: "700" }}>{t("otp_renvoyer")}</Text>
              </TouchableOpacity>
            </>
          )}

          {etape === "nouveau" && (
            <>
              <Text style={S.sous}>{t("mdp_oub_nouveau")}</Text>
              <Text style={S.label}>{t("mdp_nouveau_l")}</Text>
              <ChampMotDePasse value={mdp1} onChangeText={setMdp1} placeholder={t("mdp2_ph")} />
              <Text style={S.label}>{t("mdp_conf_l")}</Text>
              <ChampMotDePasse value={mdp2} onChangeText={setMdp2} placeholder={t("mdp2_ph")} />
              <Bouton titre={t("mdp_oub_valider")} onPress={enregistrer} charge={occupe} />
            </>
          )}

          {etape === "ok" && (
            <View style={[S.carte, { backgroundColor: C.vertPale, borderColor: C.vert }]}>
              <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 16 }}>{t("mdp_oub_ok_t")}</Text>
              <Text style={{ color: C.encre, marginTop: 6, lineHeight: 21 }}>{t("mdp_oub_ok_p")}</Text>
            </View>
          )}

          {!!erreur && <Text style={S.erreur}>{erreur}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ------------------------------------------------- Code SMS non reçu
  if (vue === "code_sms") {
    return (
      <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
        <Retour />
        <Text style={S.h1}>{t("aide_code_t")}</Text>
        <Text style={S.sous}>{t("aide_code_d")}</Text>
        {["aide_code_astuce1", "aide_code_astuce2", "aide_code_astuce3"].map((cle) => (
          <Text key={cle} style={{ color: C.gris, lineHeight: 22, marginBottom: 8 }}>· {t(cle)}</Text>
        ))}
        <View style={{ height: 8 }} />
        <Bouton
          titre={t("aide_email_b")}
          onPress={() => navigation.navigate("Connexion", { methode: "email" })}
        />
        <View style={{ height: 16 }} />
        <Appeler />
      </ScrollView>
    );
  }

  // ------------------------------------------------------------- Menu
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Text style={S.h1}>{t("aide_t")}</Text>
      <Text style={S.sous}>{t("aide_s")}</Text>

      <Option titre={t("aide_mdp_t")} detail={t("aide_mdp_d")} onPress={() => { setVue("mdp"); setEtape("email"); }} />
      <Option
        titre={t("aide_id_t")}
        detail={t("aide_id_d")}
        onPress={() => navigation.navigate("Connexion", { methode: "sms" })}
      />
      <Option titre={t("aide_code_t")} detail={t("aide_code_d")} onPress={() => setVue("code_sms")} />
      <Appeler />
    </ScrollView>
  );
}
