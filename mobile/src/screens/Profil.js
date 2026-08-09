// Profil : informations du compte, langue, notifications, déconnexion.
import React, { useCallback, useState } from "react";
import { View, Text, TextInput, ScrollView, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, S } from "../theme";
import { Bouton, Chip, Charge, ChampMotDePasse } from "../ui";
import { useLangue } from "../i18n";
import { useAuth } from "../auth";
import { useVerrou, typeBiometrie } from "../verrou";
import { deconnexion, definirEmailMotDePasse } from "../supabase";
import { apiGet, apiPost } from "../api";

function Ligne({ label, valeur }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 1, borderColor: C.ligne }}>
      <Text style={{ color: C.gris, fontSize: 14.5 }}>{label}</Text>
      <Text style={{ color: C.encre, fontWeight: "700", fontSize: 14.5, flexShrink: 1, textAlign: "right" }}>{valeur || "—"}</Text>
    </View>
  );
}

export default function Profil() {
  const { t, langue, setLangue } = useLangue();
  const { profil, user, rafraichirProfil } = useAuth();
  const [notifs, setNotifs] = useState(null);
  const [suppEnCours, setSuppEnCours] = useState(false);
  const verrou = useVerrou();
  const [bio, setBio] = useState(null); // "faceid" | "empreinte" | null

  const estPro = profil?.role === "pro";
  // Un compte ouvert par code (SMS ou e-mail) n'a pas de mot de passe : on
  // propose de lui en donner un, sinon il ne pourrait pas se connecter par
  // mot de passe sur le site.
  const [mdpEmail, setMdpEmail] = useState("");
  const [mdpNouveau, setMdpNouveau] = useState("");
  const [mdpOccupe, setMdpOccupe] = useState(false);
  const [mdpErreur, setMdpErreur] = useState("");

  async function enregistrerMotDePasse() {
    setMdpErreur("");
    const em = (mdpEmail || profil?.email || user?.email || "").trim();
    if (!/\S+@\S+\.\S+/.test(em)) return setMdpErreur(t("err_email"));
    if (mdpNouveau.length < 6) return setMdpErreur(t("err_mdp"));
    setMdpOccupe(true);
    try {
      await definirEmailMotDePasse(em, mdpNouveau);
      await rafraichirProfil();
      setMdpNouveau("");
      Alert.alert("ASM", t("mdpdef_ok"));
    } catch (e) {
      setMdpErreur(e?.code === "email_exists" ? t("err_email_pris") : t("mdpdef_err"));
    }
    setMdpOccupe(false);
  }

  useFocusEffect(useCallback(() => { typeBiometrie().then(setBio); }, []));
  const bioLib = bio === "faceid" ? "Face ID" : t("bio_empreinte");

  async function basculerBio() {
    const r = verrou.actif
      ? await verrou.desactiver(t("bio_invite"), t("annuler"))
      : await verrou.activer(t("bio_invite"), t("annuler"));
    if (r.erreur === "non_configure") Alert.alert("ASM", t("bio_non_configure"));
    else if (r.erreur === "materiel") Alert.alert("ASM", t("bio_indisponible"));
    else if (r.ok && !verrou.actif) Alert.alert("ASM", t("bio_active_ok").replace("{type}", bioLib));
  }

  // Suppression de compte : initiée DANS l'app (exigence App Store 5.1.1),
  // vérifiée par l'équipe puis validée par le super admin — comme sur le site.
  function demanderSuppression() {
    Alert.alert("ASM", t("supp_conf"), [
      { text: t("annuler"), style: "cancel" },
      {
        text: t("supp_btn"),
        style: "destructive",
        onPress: async () => {
          setSuppEnCours(true);
          try {
            await apiPost("/api/suppression-compte", {
              nom: [profil?.prenom, profil?.nom].filter(Boolean).join(" ") || "Client ASM (application)",
              telephone: profil?.telephone || user?.phone || "",
              email: profil?.email || user?.email || "",
              motif: "Demande envoyée depuis l'application mobile.",
            });
            Alert.alert("ASM", t("supp_ok"));
          } catch {
            Alert.alert("ASM", t("supp_err"));
          }
          setSuppEnCours(false);
        },
      },
    ]);
  }

  const charger = useCallback(() => {
    apiGet("/api/notifications").then((d) => setNotifs(d.notifications || [])).catch(() => setNotifs([]));
  }, []);
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Text style={S.h1}>{t("profil_t")}</Text>

      <View style={S.carte}>
        {estPro ? (
          <>
            <Ligne label={t("etab_l")} valeur={profil?.etablissement} />
            <Ligne label={t("type_l")} valeur={profil?.type_etab} />
            <Ligne label={t("contact_l")} valeur={profil?.contact} />
          </>
        ) : (
          <Ligne label="Nom" valeur={[profil?.prenom, profil?.nom].filter(Boolean).join(" ")} />
        )}
        <Ligne label={t("tel_l")} valeur={profil?.telephone || user?.phone} />
        <Ligne label="Email" valeur={profil?.email || user?.email} />
        <Ligne label={t("commune_l")} valeur={profil?.commune} />
      </View>

      {/* Mot de passe : proposé tant que le compte n'en a pas (créé par code). */}
      <Text style={S.h2}>{t("mdpdef_t")}</Text>
      <View style={S.carte}>
        <Text style={{ color: C.gris, lineHeight: 20 }}>{t("mdpdef_p")}</Text>
        <Text style={S.label}>{t("email_l")}</Text>
        <TextInput
          style={S.champ}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder={t("email_ph")}
          placeholderTextColor={C.grisClair}
          value={mdpEmail || profil?.email || user?.email || ""}
          onChangeText={setMdpEmail}
        />
        <Text style={S.label}>{t("mdp2_l")}</Text>
        <ChampMotDePasse value={mdpNouveau} onChangeText={setMdpNouveau} placeholder={t("mdp_ph")} />
        {!!mdpErreur && <Text style={S.erreur}>{mdpErreur}</Text>}
        <Bouton titre={t("mdpdef_b")} onPress={enregistrerMotDePasse} charge={mdpOccupe} />
      </View>

      <Text style={S.h2}>{t("langue_l")}</Text>
      <View style={S.ligneChips}>
        <Chip titre="Français" actif={langue === "fr"} onPress={() => setLangue("fr")} />
        <Chip titre="العربية" actif={langue === "ar"} onPress={() => setLangue("ar")} />
      </View>

      {/* Verrouillage biométrique — seulement si l'appareil le permet */}
      {bio && verrou && verrou.actif !== null && (
        <>
          <Text style={S.h2}>{t("bio_t")}</Text>
          <View style={S.carte}>
            <Text style={{ color: C.gris, lineHeight: 20 }}>{t("bio_p").replace("{type}", bioLib)}</Text>
            <View style={{ height: 10 }} />
            <Bouton
              secondaire={verrou.actif}
              titre={(verrou.actif ? t("bio_desactiver") : t("bio_activer")).replace("{type}", bioLib)}
              onPress={basculerBio}
            />
          </View>
        </>
      )}

      <Text style={S.h2}>{t("notif_t")}</Text>
      {notifs === null && <Charge />}
      {notifs?.length === 0 && <Text style={S.vide}>{t("aucune_notif")}</Text>}
      {(notifs || []).slice(0, 20).map((n) => (
        <View key={n.id} style={[S.carte, n.statut === "NON_LU" && { borderColor: C.vert, backgroundColor: C.vertPale }]}>
          <Text style={{ fontWeight: "800", color: C.encre }}>{n.titre}</Text>
          {!!n.corps && <Text style={{ color: C.gris, marginTop: 3, lineHeight: 20 }}>{n.corps}</Text>}
          <Text style={{ color: C.grisClair, fontSize: 12, marginTop: 5 }}>
            {n.auteur} · {new Date(n.creeLe).toLocaleString("fr-FR")}
          </Text>
        </View>
      ))}

      <View style={{ height: 16 }} />
      <Bouton
        secondaire
        titre={t("deconnexion")}
        onPress={() =>
          Alert.alert("ASM", t("deco_conf"), [
            { text: t("annuler"), style: "cancel" },
            { text: t("deconnexion"), style: "destructive", onPress: () => deconnexion() },
          ])
        }
      />

      <Text style={S.h2}>{t("supp_t")}</Text>
      <View style={[S.carte, { borderColor: "#E3B7B7" }]}>
        <Text style={{ color: C.gris, lineHeight: 20 }}>{t("supp_p")}</Text>
        <View style={{ height: 10 }} />
        <Bouton secondaire charge={suppEnCours} titre={t("supp_btn")} onPress={demanderSuppression} />
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
