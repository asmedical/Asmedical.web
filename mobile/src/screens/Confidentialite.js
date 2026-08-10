// Politique de confidentialité — le texte vient du serveur
// (/api/confidentialite), alimenté par la même source que le site.
// Rien n'est recopié ici : un document juridique ne peut pas exister en
// deux versions, et l'application doit toujours afficher la version en
// vigueur, y compris après une modification faite côté site.
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { C, S } from "../theme";
import { Charge } from "../ui";
import { useLangue } from "../i18n";
import { apiGet } from "../api";

export default function Confidentialite() {
  const { t } = useLangue();
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    apiGet("/api/confidentialite")
      .then(setD)
      .catch(() => setErreur(t("err_envoi")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!d && !erreur) return <View style={S.ecran}><Charge /></View>;

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Text style={S.h1}>{t("doc_confidentialite")}</Text>
      {!!d?.maj && <Text style={S.sous}>ASM — Assistance Sociale Médicale · {d.maj}</Text>}
      {!!d?.resumeAr && (
        <Text style={{ color: C.gris, lineHeight: 22, marginBottom: 14, textAlign: "right", writingDirection: "rtl" }}>
          {d.resumeAr}
        </Text>
      )}

      {!!erreur && <Text style={S.erreur}>{erreur}</Text>}

      {(d?.sections || []).map((s) => (
        <View key={s.titre} style={{ marginBottom: 18 }}>
          <Text style={{ fontWeight: "800", color: C.encre, fontSize: 16, marginBottom: 6 }}>{s.titre}</Text>
          {(s.points || []).map((pt, i) => (
            <Text key={i} style={{ color: C.gris, lineHeight: 22, marginBottom: 6 }}>
              {"· "}
              {pt.fort ? <Text style={{ fontWeight: "800", color: C.encre }}>{pt.fort} : </Text> : null}
              {pt.texte}
            </Text>
          ))}
          {(s.paragraphes || []).map((p, i) => (
            <Text key={i} style={{ color: C.gris, lineHeight: 22, marginTop: 4 }}>{p}</Text>
          ))}
        </View>
      ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
