// Politique de confidentialité — le texte vient du serveur
// (/api/confidentialite), alimenté par la même source que le site.
// Rien n'est recopié ici : un document juridique ne peut pas exister en
// deux versions, et l'application doit toujours afficher la version en
// vigueur, y compris après une modification faite côté site.
//
// Le document est demandé DANS LA LANGUE DE L'INTERFACE. Servir neuf
// sections en français à quelqu'un qui a choisi l'arabe revient à ne rien
// lui donner — c'est précisément le document qu'il faut pouvoir lire.
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { C, S } from "../theme";
import { Charge } from "../ui";
import { useLangue } from "../i18n";
import { apiGet } from "../api";

export default function Confidentialite() {
  const { t, langue } = useLangue();
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");

  const rtl = langue === "ar";
  // Le texte arabe s'aligne à droite ; le reste garde l'alignement naturel.
  const sens = rtl ? { textAlign: "right", writingDirection: "rtl" } : null;

  useEffect(() => {
    let annule = false;
    setD(null);
    setErreur("");
    apiGet(`/api/confidentialite?langue=${langue}`)
      .then((r) => { if (!annule) setD(r); })
      .catch(() => { if (!annule) setErreur(t("err_envoi")); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langue]);

  if (!d && !erreur) return <View style={S.ecran}><Charge /></View>;

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Text style={[S.h1, sens]}>{d?.titre || t("doc_confidentialite")}</Text>
      {!!d?.maj && (
        <Text style={[S.sous, sens]}>ASM — Assistance Sociale Médicale · {d.maj}</Text>
      )}

      {/* Résumé arabe : il n'accompagne que la version française. */}
      {!!d?.resumeAr && (
        <Text style={{ color: C.gris, lineHeight: 22, marginBottom: 14, textAlign: "right", writingDirection: "rtl" }}>
          {d.resumeAr}
        </Text>
      )}

      {/* Sur une traduction, dire laquelle fait foi. */}
      {!!d?.primaute && (
        <Text style={[{ color: C.gris, fontSize: 13, lineHeight: 20, marginBottom: 14 }, sens]}>
          {d.primaute}
        </Text>
      )}

      {!!erreur && <Text style={S.erreur}>{erreur}</Text>}

      {(d?.sections || []).map((s) => (
        <View key={s.titre} style={{ marginBottom: 18 }}>
          <Text style={[{ fontWeight: "800", color: C.encre, fontSize: 16, marginBottom: 6 }, sens]}>
            {s.titre}
          </Text>
          {(s.points || []).map((pt, i) => (
            <Text key={i} style={[{ color: C.gris, lineHeight: 22, marginBottom: 6 }, sens]}>
              {"· "}
              {pt.fort ? <Text style={{ fontWeight: "800", color: C.encre }}>{pt.fort} : </Text> : null}
              {pt.texte}
            </Text>
          ))}
          {(s.paragraphes || []).map((p, i) => (
            <Text key={i} style={[{ color: C.gris, lineHeight: 22, marginTop: 4 }, sens]}>{p}</Text>
          ))}
        </View>
      ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
