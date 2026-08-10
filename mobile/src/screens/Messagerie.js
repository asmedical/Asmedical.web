// Messagerie — MÊME structure que le site (app/components/messagerie-partagee.js) :
// deux onglets, « Conversation » ouverte par défaut et champ de saisie
// toujours visible, « Notifications » pour les messages officiels ASM.
// Écrire à l'équipe ne doit demander aucune recherche.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { C, S } from "../theme";
import { useLangue, TEL_AFFICHE } from "../i18n";
import { proposerAppel } from "../ui";
import { apiGet, apiPost } from "../api";

function heure(d) {
  try {
    return new Date(d).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function Messagerie() {
  const { t } = useLangue();
  const [vue, setVue] = useState("chat"); // chat | notifs

  const [messages, setMessages] = useState(null); // null = chargement
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const [notifs, setNotifs] = useState(null);
  const [ouverte, setOuverte] = useState(null);

  const liste = useRef(null);

  const charger = useCallback(async () => {
    try {
      const d = await apiGet("/api/messages");
      setMessages(d.messages || []);
    } catch {
      setMessages((m) => m || []); // on n'efface jamais un fil déjà affiché
    }
  }, []);

  const chargerNotifs = useCallback(async () => {
    try {
      const d = await apiGet("/api/notifications");
      setNotifs(d.notifications || []);
    } catch {
      setNotifs((n) => n || []);
    }
  }, []);

  useEffect(() => {
    charger();
    chargerNotifs();
    const minuteur = setInterval(charger, 12000);
    return () => clearInterval(minuteur);
  }, [charger, chargerNotifs]);

  // Un envoi qui échoue DOIT se voir : l'ancienne version avalait l'erreur
  // en silence, le message disparaissait de l'écran sans jamais partir.
  async function envoyer() {
    const propre = texte.trim();
    if (!propre || envoi) return;
    setEnvoi(true);
    setErreur("");
    try {
      await apiPost("/api/messages", { texte: propre });
      setTexte("");
      await charger();
    } catch (e) {
      setErreur(e?.data?.erreur || t("msg_err_envoi"));
    }
    setEnvoi(false);
  }

  async function ouvrirNotif(n) {
    setOuverte(ouverte === n.id ? null : n.id);
    if (n.statut === "NON_LU") {
      try {
        await apiPost("/api/notifications", { id: n.id });
        setNotifs((liste2) => (liste2 || []).map((x) => (x.id === n.id ? { ...x, statut: "LU" } : x)));
      } catch {}
    }
  }

  const nonLues = (notifs || []).filter((n) => n.statut === "NON_LU").length;

  const Onglets = () => (
    <View>
      <Text style={[S.h1, { paddingHorizontal: 14, marginBottom: 2 }]}>{t("mamsg_t")}</Text>
      <Text style={[S.sous, { paddingHorizontal: 14 }]}>{t("mamsg_s")}</Text>
      <View style={{ flexDirection: "row", backgroundColor: C.vertPale, borderRadius: 14, padding: 4, margin: 14, marginBottom: 8 }}>
      {[
        ["chat", t("msg_onglet_chat"), 0],
        ["notifs", t("msg_onglet_notifs"), nonLues],
      ].map(([cle, libelle, badge]) => (
        <TouchableOpacity
          key={cle}
          accessibilityRole="tab"
          accessibilityState={{ selected: vue === cle }}
          onPress={() => { setVue(cle); if (cle === "notifs") chargerNotifs(); }}
          style={{ flex: 1, paddingVertical: 11, borderRadius: 11, alignItems: "center", backgroundColor: vue === cle ? C.blanc : "transparent" }}
        >
          <Text style={{ fontWeight: "800", fontSize: 14.5, color: vue === cle ? C.vertFonce : C.gris }}>
            {libelle}{badge > 0 ? ` (${badge})` : ""}
          </Text>
        </TouchableOpacity>
      ))}
      </View>
    </View>
  );

  if (vue === "notifs") {
    return (
      <View style={S.ecran}>
        <Onglets />
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4 }}>
          {notifs === null && <ActivityIndicator color={C.vert} />}
          {notifs !== null && notifs.length === 0 && <Text style={S.vide}>{t("aucune_notif")}</Text>}
          {(notifs || []).map((n) => (
            <TouchableOpacity
              key={n.id}
              onPress={() => ouvrirNotif(n)}
              accessibilityRole="button"
              style={[S.carte, { marginBottom: 8 }, n.statut === "NON_LU" && { borderColor: C.vert, backgroundColor: C.vertPale }]}
            >
              <Text style={{ fontWeight: "800", color: C.encre }}>{n.titre}</Text>
              <Text style={{ color: C.grisClair, fontSize: 12, marginTop: 4 }}>
                {n.auteur ? `${n.auteur} · ` : ""}{heure(n.creeLe)}
              </Text>
              {ouverte === n.id && !!n.corps && (
                <Text style={{ color: C.gris, marginTop: 8, lineHeight: 20 }}>{n.corps}</Text>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => proposerAppel(t)} style={{ marginTop: 22, alignItems: "center" }}>
            <Text style={{ color: C.gris }}>
              {t("msg_urgence")} <Text style={{ color: C.vertFonce, fontWeight: "800" }}>{TEL_AFFICHE}</Text>
            </Text>
          </TouchableOpacity>
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={S.ecran}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <Onglets />
      <FlatList
        ref={liste}
        data={messages || []}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 10, flexGrow: 1 }}
        onContentSizeChange={() => liste.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          messages === null ? (
            <ActivityIndicator color={C.vert} />
          ) : (
            <Text style={[S.vide, { marginTop: 30 }]}>{t("msg_bienvenue")}</Text>
          )
        }
        renderItem={({ item: m }) => (
          <View
            style={{
              alignSelf: m.deEquipe ? "flex-start" : "flex-end",
              backgroundColor: m.deEquipe ? C.vertPale : C.vert,
              borderRadius: 16,
              padding: 12,
              marginBottom: 8,
              maxWidth: "82%",
            }}
          >
            {m.deEquipe && (
              <Text style={{ fontSize: 12, fontWeight: "800", color: C.vertFonce, marginBottom: 2 }}>
                {m.auteur || t("equipe")}
              </Text>
            )}
            <Text style={{ color: m.deEquipe ? C.encre : C.blanc, fontSize: 15, lineHeight: 21 }}>{m.texte}</Text>
            <Text style={{ color: m.deEquipe ? C.grisClair : "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 4 }}>
              {heure(m.creeLe)}
            </Text>
          </View>
        )}
      />

      {!!erreur && (
        <Text style={[S.erreur, { paddingHorizontal: 16, marginBottom: 0 }]}>{erreur}</Text>
      )}

      <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderColor: C.ligne, backgroundColor: C.blanc }}>
        <TextInput
          style={[S.champ, { flex: 1, marginBottom: 0 }]}
          placeholder={t("msg_ph")}
          placeholderTextColor={C.grisClair}
          value={texte}
          onChangeText={setTexte}
          maxLength={1000}
          multiline
        />
        <TouchableOpacity
          onPress={envoyer}
          disabled={!texte.trim() || envoi}
          accessibilityRole="button"
          accessibilityLabel={t("msg_envoyer")}
          style={{
            backgroundColor: C.vert, borderRadius: 14, width: 56, alignItems: "center",
            justifyContent: "center", opacity: !texte.trim() || envoi ? 0.5 : 1,
          }}
        >
          {envoi ? (
            <ActivityIndicator color={C.blanc} />
          ) : (
            <Text style={{ color: C.blanc, fontWeight: "800", fontSize: 20 }}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
