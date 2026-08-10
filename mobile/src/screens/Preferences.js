// Mes préférences — écran natif, mêmes champs et même API que le site
// (app/compte/preferences/page.js, /api/preferences). Plus de renvoi vers
// le navigateur : ce sont des informations qu'on modifie depuis son
// téléphone, souvent juste avant une intervention.
import React, { useCallback, useState } from "react";
import { View, Text, TextInput, ScrollView, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, S } from "../theme";
import { Bouton, Chip, Charge } from "../ui";
import { useLangue } from "../i18n";
import { apiGet, apiPost } from "../api";

const GENRES = [
  { valeur: "", cle: "genre_indif" },
  { valeur: "femme", cle: "genre_femme" },
  { valeur: "homme", cle: "genre_homme" },
];

const VIDE = {
  prefGenre: "",
  soignantFavoriId: "",
  allergies: "",
  etage: "",
  codePorte: "",
  consignes: "",
};

export default function Preferences() {
  const { t } = useLangue();
  const [donnees, setDonnees] = useState(null); // null = chargement
  const [f, setF] = useState(VIDE);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(() => {
    apiGet("/api/preferences")
      .then((d) => {
        setDonnees(d || { preferences: null, soignantsConnus: [] });
        const p = d?.preferences || {};
        setF({
          prefGenre: p.prefGenre || "",
          soignantFavoriId: p.soignantFavoriId ? String(p.soignantFavoriId) : "",
          allergies: p.allergies || "",
          etage: p.etage || "",
          codePorte: p.codePorte || "",
          consignes: p.consignes || "",
        });
      })
      .catch(() => setDonnees({ preferences: null, soignantsConnus: [] }));
  }, []);

  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  async function enregistrer() {
    if (occupe) return;
    setOccupe(true);
    setErreur("");
    try {
      await apiPost("/api/preferences", {
        ...f,
        soignantFavoriId: f.soignantFavoriId ? Number(f.soignantFavoriId) : null,
      });
      Alert.alert("ASM", t("ps_ok"));
    } catch (e) {
      setErreur(e?.data?.erreur || t("pr_err"));
    }
    setOccupe(false);
  }

  if (donnees === null) return <View style={S.ecran}><Charge /></View>;

  const soignants = donnees.soignantsConnus || [];

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
      <Text style={S.h1}>{t("ps_t")}</Text>
      <Text style={S.sous}>{t("ps_s")}</Text>

      <Text style={S.h2}>{t("ps_intervenant_t")}</Text>
      <Text style={S.label}>{t("genre_l")}</Text>
      <View style={S.ligneChips}>
        {GENRES.map((g) => (
          <Chip
            key={g.cle}
            titre={t(g.cle)}
            actif={f.prefGenre === g.valeur}
            onPress={() => setF({ ...f, prefGenre: g.valeur })}
          />
        ))}
      </View>

      {/* Intervenant déjà venu : on ne propose que des personnes réellement
          intervenues chez ce patient — la liste vient du serveur. */}
      {soignants.length > 0 && (
        <>
          <Text style={S.label}>{t("ps_favori_l")}</Text>
          <View style={S.ligneChips}>
            <Chip
              titre={t("ps_favori_aucun")}
              actif={!f.soignantFavoriId}
              onPress={() => setF({ ...f, soignantFavoriId: "" })}
            />
            {soignants.map((sc) => (
              <Chip
                key={sc.id}
                titre={sc.nom}
                actif={String(f.soignantFavoriId) === String(sc.id)}
                onPress={() => setF({ ...f, soignantFavoriId: String(sc.id) })}
              />
            ))}
          </View>
          <Text style={{ color: C.gris, fontSize: 13, marginTop: 6 }}>{t("ps_favori_aide")}</Text>
        </>
      )}

      <Text style={S.h2}>{t("ps_consignes_t")}</Text>
      <Text style={{ color: C.gris, fontSize: 13.5, marginBottom: 4 }}>{t("ps_consignes_aide")}</Text>

      <Text style={S.label}>{t("ps_allergies_l")}</Text>
      <TextInput style={S.champ} placeholder={t("ps_allergies_ph")} placeholderTextColor={C.grisClair}
                 value={f.allergies} onChangeText={(v) => setF({ ...f, allergies: v })} />

      <Text style={S.label}>{t("ps_etage_l")}</Text>
      <TextInput style={S.champ} placeholder={t("ps_etage_ph")} placeholderTextColor={C.grisClair}
                 value={f.etage} onChangeText={(v) => setF({ ...f, etage: v })} />

      <Text style={S.label}>{t("ps_code_l")}</Text>
      <TextInput style={S.champ} placeholder={t("ps_code_ph")} placeholderTextColor={C.grisClair}
                 value={f.codePorte} onChangeText={(v) => setF({ ...f, codePorte: v })} />

      <Text style={S.label}>{t("ps_autres_l")}</Text>
      <TextInput
        style={[S.champ, { height: 96, textAlignVertical: "top", paddingTop: 12 }]}
        placeholder={t("ps_autres_ph")}
        placeholderTextColor={C.grisClair}
        value={f.consignes}
        onChangeText={(v) => setF({ ...f, consignes: v })}
        multiline
      />

      {!!erreur && <Text style={S.erreur}>{erreur}</Text>}
      <Bouton titre={t("ps_enregistrer")} onPress={enregistrer} charge={occupe} />
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
