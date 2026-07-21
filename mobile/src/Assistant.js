// Assistant conversationnel ASM (mobile) — même cerveau que le site :
// il appelle /api/assistant (IA Gemini côté serveur, avec repli guidé). Le
// composant ne connaît aucune clé. Bulle flottante + fenêtre de discussion.
import React, { useRef, useState } from "react";
import {
  View, Text, Modal, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { C } from "./theme";
import { useLangue } from "./i18n";
import { apiPost } from "./api";
import { proposerAppel } from "./ui";

// Actions renvoyées par l'IA → écran natif correspondant (celles qui existent).
const CIBLE = { rdv: "Reservation", medicaments: "Reservation", suivi: "Suivi" };

export default function Assistant({ navigate }) {
  const { t, langue } = useLangue();
  const [ouvert, setOuvert] = useState(false);
  const [messages, setMessages] = useState([]);
  const [saisie, setSaisie] = useState("");
  const [charge, setCharge] = useState(false);
  const histoRef = useRef([]);
  const scrollRef = useRef(null);

  const defiler = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

  const ajouter = (m) => {
    setMessages((liste) => [...liste, m]);
    defiler();
  };

  const ouvrir = () => {
    setOuvert(true);
    if (messages.length === 0) {
      setMessages([{ type: "bot", txt: t("assistant_bonjour") }, { type: "rapides" }]);
    }
    defiler();
  };

  const aller = (service) => {
    setOuvert(false);
    navigate("Reservation", service ? { service } : undefined);
  };

  const suivreAction = (action) => {
    if (action === "appeler") return proposerAppel(t);
    const cible = CIBLE[action];
    if (!cible) return;
    setOuvert(false);
    navigate(cible, action === "medicaments" ? { service: "medicaments" } : undefined);
  };

  const demander = async (texte) => {
    const historique = histoRef.current.slice(-8);
    histoRef.current.push({ role: "user", content: texte });
    setCharge(true);
    defiler();
    let rep = null;
    try {
      rep = await apiPost("/api/assistant", { message: texte, historique, langue });
    } catch {}
    setCharge(false);
    if (!rep || !rep.reponse) {
      ajouter({ type: "bot", txt: t("assistant_erreur") });
      ajouter({ type: "rapides" });
      return;
    }
    histoRef.current.push({ role: "assistant", content: rep.reponse });
    ajouter({ type: "bot", txt: rep.reponse });
    // Bouton d'action seulement si l'app native a un écran (ou pour appeler).
    if (rep.action === "appeler" || CIBLE[rep.action]) ajouter({ type: "action", action: rep.action });
    ajouter({ type: "rapides" });
  };

  const RAPIDES = [
    { txt: t("qr_transport"), run: () => aller("transport") },
    { txt: t("qr_domicile"), run: () => aller("domicile") },
    { txt: t("qr_medic"), run: () => aller("medicaments") },
    { txt: t("qr_suivre"), run: () => { setOuvert(false); navigate("Suivi"); } },
    { txt: t("qr_tarifs"), run: () => envoyerTexte(langue === "ar" ? "ما هي الأسعار؟" : "Quels sont vos tarifs ?") },
    { txt: t("qr_humain"), run: () => proposerAppel(t) },
  ];

  const envoyerTexte = (texte) => {
    ajouter({ type: "moi", txt: texte });
    demander(texte);
  };

  const envoyer = () => {
    const texte = saisie.trim();
    if (!texte || charge) return;
    setSaisie("");
    envoyerTexte(texte);
  };

  const libelleAction = (a) =>
    a === "appeler" ? t("act_appeler") : a === "suivi" ? t("act_suivi") : t("act_rdv");

  return (
    <>
      {/* Bulle flottante (au-dessus de la barre d'onglets) */}
      <TouchableOpacity
        onPress={ouvrir}
        activeOpacity={0.85}
        style={{
          position: "absolute", right: 16, bottom: 84, width: 58, height: 58,
          borderRadius: 29, backgroundColor: C.vert, alignItems: "center",
          justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2,
          shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
        }}
        accessibilityLabel={t("assistant_titre")}
      >
        <Text style={{ fontSize: 26 }}>💬</Text>
      </TouchableOpacity>

      <Modal visible={ouvert} animationType="slide" transparent onRequestClose={() => setOuvert(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-end" }}
        >
          <View style={{ height: "82%", backgroundColor: C.blanc, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }}>
            {/* En-tête */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: C.ligne }}>
              <Text style={{ fontSize: 26 }}>🩺</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 16 }}>{t("assistant_titre")}</Text>
                <Text style={{ color: C.vert, fontSize: 12 }}>{t("assistant_ligne")}</Text>
              </View>
              <TouchableOpacity onPress={() => setOuvert(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 22, color: C.gris }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Corps */}
            <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: C.vertPale }} contentContainerStyle={{ padding: 14, gap: 10 }}>
              {messages.map((m, i) =>
                m.type === "rapides" ? (
                  <View key={i} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {RAPIDES.map((r) => (
                      <TouchableOpacity
                        key={r.txt}
                        onPress={r.run}
                        style={{ borderWidth: 1.5, borderColor: C.vert, borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: C.blanc }}
                      >
                        <Text style={{ color: C.vertFonce, fontWeight: "700", fontSize: 13 }}>{r.txt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : m.type === "action" ? (
                  <TouchableOpacity
                    key={i}
                    onPress={() => suivreAction(m.action)}
                    style={{ alignSelf: "flex-start", borderWidth: 1.5, borderColor: C.vert, borderRadius: 99, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: C.blanc }}
                  >
                    <Text style={{ color: C.vertFonce, fontWeight: "800", fontSize: 14 }}>→ {libelleAction(m.action)}</Text>
                  </TouchableOpacity>
                ) : (
                  <View
                    key={i}
                    style={{
                      maxWidth: "85%", alignSelf: m.type === "moi" ? "flex-end" : "flex-start",
                      backgroundColor: m.type === "moi" ? C.vert : C.blanc,
                      borderWidth: m.type === "moi" ? 0 : 1, borderColor: C.ligne,
                      borderRadius: 15, paddingHorizontal: 13, paddingVertical: 10,
                    }}
                  >
                    <Text style={{ color: m.type === "moi" ? C.blanc : C.encre, fontSize: 15, lineHeight: 21 }}>{m.txt}</Text>
                  </View>
                )
              )}
              {charge && (
                <View style={{ alignSelf: "flex-start", backgroundColor: C.blanc, borderWidth: 1, borderColor: C.ligne, borderRadius: 15, paddingHorizontal: 15, paddingVertical: 12 }}>
                  <ActivityIndicator color={C.vert} />
                </View>
              )}
            </ScrollView>

            {/* Saisie */}
            <View style={{ flexDirection: "row", gap: 9, padding: 12, borderTopWidth: 1, borderTopColor: C.ligne, alignItems: "center" }}>
              <TextInput
                style={{ flex: 1, borderWidth: 1.5, borderColor: C.ligne, borderRadius: 99, paddingHorizontal: 15, paddingVertical: 10, fontSize: 15, color: C.encre }}
                placeholder={t("assistant_ph")}
                placeholderTextColor={C.grisClair}
                value={saisie}
                onChangeText={setSaisie}
                onSubmitEditing={envoyer}
                editable={!charge}
                returnKeyType="send"
              />
              <TouchableOpacity onPress={envoyer} disabled={charge} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.vert, alignItems: "center", justifyContent: "center", opacity: charge ? 0.55 : 1 }}>
                <Text style={{ color: C.blanc, fontSize: 20 }}>➤</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
