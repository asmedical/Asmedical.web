// Profil : informations du compte, langue, notifications, déconnexion.
import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, S } from "../theme";
import { Bouton, Chip, Charge } from "../ui";
import { useLangue } from "../i18n";
import { useAuth } from "../auth";
import { useVerrou, typeBiometrie } from "../verrou";
import { deconnexion } from "../supabase";
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
  const { profil, user } = useAuth();
  const [notifs, setNotifs] = useState(null);
  const [suppEnCours, setSuppEnCours] = useState(false);
  const verrou = useVerrou();
  const [bio, setBio] = useState(null); // "faceid" | "empreinte" | null

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
        <Ligne label="Nom" valeur={[profil?.prenom, profil?.nom].filter(Boolean).join(" ")} />
        <Ligne label={t("tel_l")} valeur={profil?.telephone || user?.phone} />
        <Ligne label="Email" valeur={profil?.email || user?.email} />
        <Ligne label={t("commune_l")} valeur={profil?.commune} />
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
