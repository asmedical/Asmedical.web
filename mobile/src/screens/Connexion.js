// Espace Connexion / Inscription — même logique et même ordre d'éléments
// que le site (app/connexion/page.js). L'écran principal reste volontairement
// minimal ; les méthodes secondaires et l'assistance sont rangées dans deux
// accordéons FERMÉS par défaut.
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Image, TouchableOpacity, Linking, KeyboardAvoidingView, Platform } from "react-native";
import { C, S } from "../theme";
import { Bouton, Chip, proposerAppel, ChampMotDePasse } from "../ui";
import { useLangue, TEL_AFFICHE } from "../i18n";
import {
  envoyerCode,
  verifierCode,
  envoyerCodeEmailCreation,
  verifierCodeEmail,
  connexionIdentifiant,
  enregistrerProfil,
  normaliserTel,
} from "../supabase";
import { API_BASE, apiPost, apiGet } from "../api";

const INDICATIFS = ["+213", "+33", "+216", "+212", "+32", "+41", "+49", "+44", "+1", "+34", "+39"];

const EST_EMAIL = (v) => /\S+@\S+\.\S+/.test((v || "").trim());
const EST_TEL = (v) => {
  const s = (v || "").trim();
  return !s.includes("@") && /^[+\d][\d\s.\-()]*$/.test(s) && s.replace(/\D/g, "").length >= 8;
};

// Ligne d'accordéon : grande zone tactile, libellé toujours visible.
function Accordeon({ titre, ouvert, onPress, children }) {
  return (
    <View style={{ borderWidth: 1, borderColor: C.ligne, borderRadius: 14, marginTop: 12, overflow: "hidden" }}>
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded: ouvert }}
        style={{ flexDirection: "row", alignItems: "center", minHeight: 58, paddingHorizontal: 16, paddingVertical: 14 }}
      >
        <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: C.encre }}>{titre}</Text>
        <Text style={{ fontSize: 16, color: C.gris }}>{ouvert ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {ouvert && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: C.ligne }}>
          {children}
        </View>
      )}
    </View>
  );
}

// Item cliquable dans « Besoin d'aide ? ».
function ItemAide({ titre, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      style={{ flexDirection: "row", alignItems: "center", minHeight: 56, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: C.ligne }}
    >
      <Text style={{ flex: 1, fontSize: 15.5, fontWeight: "700", color: C.encre }}>{titre}</Text>
      <Text style={{ color: C.gris, fontSize: 18 }}>›</Text>
    </TouchableOpacity>
  );
}

export default function Connexion() {
  const { t } = useLangue();

  const [onglet, setOnglet] = useState("connexion"); // connexion | inscription
  const [vue, setVue] = useState("principal"); // principal | sms
  const [etape, setEtape] = useState("tel"); // tel | code (dans la vue sms)

  // Accordéons fermés par défaut : l'écran initial reste minimal.
  const [accOptions, setAccOptions] = useState(false);
  const [accAide, setAccAide] = useState(false);

  const [indicatif, setIndicatif] = useState("+213");
  const [tel, setTel] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [code, setCode] = useState("");
  const [canal, setCanal] = useState("sms");
  const [waActif, setWaActif] = useState(false);
  const [viaEmail, setViaEmail] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  // Inscription : le strict minimum.
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [contact, setContact] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    apiGet("/api/otp-canal").then((d) => setWaActif(!!d?.whatsapp)).catch(() => {});
  }, []);

  // Nom / prénom saisis à l'inscription : enregistrés dès l'ouverture de la
  // session. Jamais bloquant — un échec ne doit pas empêcher d'entrer.
  async function enregistrerIdentite() {
    if (!prenom.trim() && !nom.trim()) return;
    try {
      await enregistrerProfil({
        role: "patient",
        prenom: prenom.trim(),
        nom: nom.trim(),
        telephone: phoneE164 && !phoneE164.includes("@") ? phoneE164 : null,
        email: phoneE164 && phoneE164.includes("@") ? phoneE164 : null,
      });
    } catch {}
  }

  async function demanderCode() {
    if (occupe) return;
    setErreur("");
    if (viaEmail) {
      const em = emailOtp.trim();
      if (!EST_EMAIL(em)) return setErreur(t("err_email"));
      setOccupe(true);
      try {
        await envoyerCodeEmailCreation(em);
        setPhoneE164(em);
        setEtape("code");
      } catch {
        setErreur(t("err_envoi_email"));
      }
      setOccupe(false);
      return;
    }
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
    if (occupe) return;
    setErreur("");
    setOccupe(true);
    try {
      if (viaEmail) await verifierCodeEmail(phoneE164, code.trim());
      else await verifierCode(phoneE164, code.trim());
      await enregistrerIdentite();
      // La session déclenche la navigation (App.js écoute l'état d'auth).
    } catch {
      setErreur(t("err_code"));
      setOccupe(false);
    }
  }

  async function validerIdentifiant() {
    if (occupe) return;
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

  // Inscription : nom + prénom + (email OU téléphone), sans que l'utilisateur
  // ait à comprendre la différence — on détecte et on emprunte le bon parcours.
  async function creerCompte() {
    if (occupe) return;
    setErreur("");
    if (!prenom.trim() || !nom.trim()) return setErreur(t("err_nom_prenom"));
    const c = contact.trim();
    if (EST_EMAIL(c)) {
      setOccupe(true);
      try {
        await envoyerCodeEmailCreation(c);
        setViaEmail(true);
        setEmailOtp(c);
        setPhoneE164(c);
        setVue("sms");
        setEtape("code");
      } catch {
        setErreur(t("err_envoi_email"));
      }
      setOccupe(false);
      return;
    }
    if (EST_TEL(c)) {
      const p = normaliserTel(c, indicatif);
      if (p.replace(/\D/g, "").length < 10) return setErreur(t("err_tel_format"));
      setOccupe(true);
      try {
        if (waActif) {
          try { await apiPost("/api/otp-canal", { phone: p, canal }); } catch {}
        }
        await envoyerCode(p);
        setViaEmail(false);
        setPhoneE164(p);
        setVue("sms");
        setEtape("code");
      } catch {
        setErreur(t("err_sms"));
      }
      setOccupe(false);
      return;
    }
    setErreur(t("err_contact"));
  }

  const ouvrirSms = () => { setVue("sms"); setEtape("tel"); setViaEmail(false); setErreur(""); };
  // Les parcours « mot de passe oublié » et « code SMS non reçu » vivent sur
  // le site : on y renvoie plutôt que de dupliquer la logique dans l'app.
  const ouvrirAideWeb = (sujet) => Linking.openURL(`${API_BASE}/aide-connexion?sujet=${sujet}`).catch(() => {});

  const Entete = () => (
    <View style={{ alignItems: "center", marginBottom: 20 }}>
      <Image
        source={require("../../assets/icon.png")}
        style={{ width: 78, height: 78, borderRadius: 39, marginBottom: 12 }}
      />
      <Text style={{ fontSize: 27, fontWeight: "800", color: C.vertFonce }}>{t("auth_bienvenue")}</Text>
      <Text style={{ fontSize: 15.5, color: C.gris, marginTop: 6, textAlign: "center" }}>
        {onglet === "inscription" ? t("auth_sous_inscription") : t("auth_sous_connexion")}
      </Text>
    </View>
  );

  // ---------------------------------------------- Parcours SMS / e-mail
  if (vue === "sms") {
    return (
      <KeyboardAvoidingView style={S.ecran} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[S.contenu, { paddingTop: 60 }]} keyboardShouldPersistTaps="handled">
          <Entete />
          {etape === "tel" ? (
            <>
              <Text style={S.sous}>{t("autre_methode_s")}</Text>
              {viaEmail ? (
                <>
                  <Text style={S.label}>{t("email_l")}</Text>
                  <TextInput
                    style={S.champ}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder={t("email_ph")}
                    placeholderTextColor={C.grisClair}
                    value={emailOtp}
                    onChangeText={setEmailOtp}
                  />
                </>
              ) : (
                <>
                  <Text style={S.label}>{t("tel_l")}</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={[S.champ, { width: 96, alignItems: "center", justifyContent: "center" }]}
                      accessibilityLabel={t("tel_l")}
                      onPress={() => {
                        const i = INDICATIFS.indexOf(indicatif);
                        setIndicatif(INDICATIFS[(i + 1) % INDICATIFS.length]);
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: "700", color: C.encre }}>{indicatif}</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={[S.champ, { flex: 1 }]}
                      placeholder={t("tel_ph")}
                      placeholderTextColor={C.grisClair}
                      keyboardType="phone-pad"
                      value={tel}
                      onChangeText={setTel}
                    />
                  </View>
                </>
              )}
              {!viaEmail && waActif && (
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
              <TouchableOpacity onPress={() => { setViaEmail(!viaEmail); setErreur(""); }} style={{ alignItems: "center", marginTop: 16 }}>
                <Text style={{ color: C.vert, fontWeight: "700", textAlign: "center" }}>
                  {viaEmail ? t("otp_par_tel") : t("otp_par_email")}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
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

          <TouchableOpacity
            onPress={() => { setVue("principal"); setEtape("tel"); setCode(""); setErreur(""); }}
            style={{ alignItems: "center", marginTop: 20 }}
          >
            <Text style={{ color: C.vert, fontWeight: "700" }}>{t("auth_retour_connexion")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ------------------------------------------------ Écran principal (épuré)
  return (
    <KeyboardAvoidingView style={S.ecran} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[S.contenu, { paddingTop: 60 }]} keyboardShouldPersistTaps="handled">
        <Entete />

        {/* Deux onglets très visibles */}
        <View style={{ flexDirection: "row", backgroundColor: C.vertPale, borderRadius: 14, padding: 4, marginBottom: 18 }}>
          {[["connexion", t("onglet_connexion")], ["inscription", t("onglet_inscription")]].map(([m, lib]) => (
            <TouchableOpacity
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: onglet === m }}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: "center", backgroundColor: onglet === m ? C.blanc : "transparent" }}
              onPress={() => { setOnglet(m); setErreur(""); }}
            >
              <Text style={{ fontWeight: "800", fontSize: 14.5, color: onglet === m ? C.vertFonce : C.gris }}>{lib}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {onglet === "connexion" ? (
          <>
            <Text style={S.label}>{t("auth_contact_l")}</Text>
            <TextInput
              style={S.champ}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t("auth_contact_ph")}
              placeholderTextColor={C.grisClair}
              value={identifiant}
              onChangeText={setIdentifiant}
            />
            <Text style={S.label}>{t("mdp2_l")}</Text>
            <ChampMotDePasse value={motDePasse} onChangeText={setMotDePasse} placeholder={t("mdp_ph")} />
            <Bouton titre={t("connexion_b")} onPress={validerIdentifiant} charge={occupe} />
          </>
        ) : (
          <>
            <Text style={S.label}>{t("nom2_l")}</Text>
            <TextInput style={S.champ} placeholder={t("nom2_ph")} placeholderTextColor={C.grisClair}
                       value={nom} onChangeText={setNom} />
            <Text style={S.label}>{t("prenom_l")}</Text>
            <TextInput style={S.champ} placeholder={t("prenom_ph")} placeholderTextColor={C.grisClair}
                       value={prenom} onChangeText={setPrenom} />
            <Text style={S.label}>{t("auth_contact_l")}</Text>
            <TextInput
              style={S.champ}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t("auth_contact_ph")}
              placeholderTextColor={C.grisClair}
              value={contact}
              onChangeText={setContact}
            />
            <Bouton titre={t("auth_creer_compte")} onPress={creerCompte} charge={occupe} />
          </>
        )}

        {!!erreur && <Text style={S.erreur}>{erreur}</Text>}

        {/* Accordéon 1 : autres options. Google/Facebook/Apple ne sont pas
            encore branchés dans l'application native : on n'affiche donc
            aucun bouton qui mènerait à une impasse. */}
        <Accordeon titre={t("auth_autres_options")} ouvert={accOptions} onPress={() => setAccOptions(!accOptions)}>
          <View style={{ marginTop: 12 }}>
            <TouchableOpacity
              onPress={ouvrirSms}
              accessibilityRole="button"
              style={{ minHeight: 58, borderWidth: 1.5, borderColor: C.ligne, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontSize: 15.5, fontWeight: "700", color: C.encre }}>{t("auth_sms_rapide")}</Text>
            </TouchableOpacity>
          </View>
        </Accordeon>

        {/* Accordéon 2 : besoin d'aide ? */}
        <Accordeon titre={t("aide_lien")} ouvert={accAide} onPress={() => setAccAide(!accAide)}>
          <ItemAide titre={t("aide_mdp_t")} onPress={() => ouvrirAideWeb("mdp")} />
          <ItemAide titre={t("aide_id_t")} onPress={ouvrirSms} />
          <ItemAide titre={t("aide_code_t")} onPress={() => ouvrirAideWeb("code_sms")} />
          <TouchableOpacity onPress={() => proposerAppel(t)} style={{ paddingTop: 15 }} accessibilityRole="button">
            <Text style={{ fontSize: 15.5, fontWeight: "700", color: C.encre }}>{t("auth_conseiller")}</Text>
            <Text style={{ color: C.vert, fontWeight: "800", marginTop: 4 }}>{TEL_AFFICHE}</Text>
          </TouchableOpacity>
        </Accordeon>

        <TouchableOpacity onPress={() => proposerAppel(t)} style={{ marginTop: 26, alignItems: "center" }}>
          <Text style={{ color: C.gris }}>
            {t("urgence")} <Text style={{ color: C.vertFonce, fontWeight: "800" }}>{TEL_AFFICHE}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
