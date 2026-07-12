// Messagerie patient ↔ équipe ASM (mêmes messages que sur le site).
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { C, S } from "../theme";
import { useLangue } from "../i18n";
import { apiGet, apiPost } from "../api";

export default function Messagerie() {
  const { t } = useLangue();
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const liste = useRef(null);

  const charger = useCallback(() => {
    apiGet("/api/messages").then((d) => setMessages(d.messages || [])).catch(() => {});
  }, []);

  useEffect(() => {
    charger();
    const minuteur = setInterval(charger, 12000);
    return () => clearInterval(minuteur);
  }, [charger]);

  async function envoyer() {
    const propre = texte.trim();
    if (!propre || envoi) return;
    setEnvoi(true);
    try {
      await apiPost("/api/messages", { texte: propre });
      setTexte("");
      charger();
    } catch {}
    setEnvoi(false);
  }

  return (
    <KeyboardAvoidingView style={S.ecran} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={liste}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 10 }}
        onContentSizeChange={() => liste.current?.scrollToEnd({ animated: false })}
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
            {m.deEquipe && !!m.auteur && (
              <Text style={{ fontSize: 12, fontWeight: "800", color: C.vertFonce, marginBottom: 2 }}>{m.auteur}</Text>
            )}
            <Text style={{ color: m.deEquipe ? C.encre : C.blanc, fontSize: 15, lineHeight: 21 }}>{m.texte}</Text>
          </View>
        )}
      />
      <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderColor: C.ligne, backgroundColor: C.blanc }}>
        <TextInput
          style={[S.champ, { flex: 1, marginBottom: 0 }]}
          placeholder={t("msg_ph")}
          placeholderTextColor={C.grisClair}
          value={texte}
          onChangeText={setTexte}
          multiline
        />
        <TouchableOpacity
          onPress={envoyer}
          disabled={!texte.trim() || envoi}
          style={{ backgroundColor: C.vert, borderRadius: 14, paddingHorizontal: 18, justifyContent: "center", opacity: !texte.trim() || envoi ? 0.5 : 1 }}
        >
          <Text style={{ color: C.blanc, fontWeight: "800" }}>{t("msg_envoyer")}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
