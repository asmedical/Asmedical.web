// Espace employé (terrain) — planning des interventions et fiche mission.
// Mêmes routes et mêmes règles que le site : /api/employe/moi pour le
// planning et la disponibilité, /api/employe/intervention pour l'avancement.
// Le serveur revérifie le rôle à chaque appel (403 si ce n'est pas un
// employé) : l'application ne fait qu'afficher, elle n'autorise rien.
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, RefreshControl, Linking } from "react-native";
import { C, S } from "../theme";
import { Bouton, Chip, Charge, proposerAppel } from "../ui";
import { useLangue, TEL_AFFICHE } from "../i18n";
import { apiGet, apiPatch } from "../api";

const DISPOS = ["DISPONIBLE", "OCCUPE", "ABSENT"];

// Actions proposées selon l'avancement réel de l'intervention.
function actionsPossibles(d) {
  const s = d.statut;
  if (s === "TERMINEE" || s === "ANNULEE" || s === "ABSENT") return [];
  if (s === "AFFECTEE") return ["accepter", "en_route"];
  if (s === "EN_COURS") return ["terminer", "probleme"];
  return ["en_route", "arrivee", "commencer", "probleme", "absent"];
}

function dateLisible(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function Employe() {
  const { t } = useLangue();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [rafraichit, setRafraichit] = useState(false);
  const [ouverte, setOuverte] = useState(null); // id de la fiche dépliée
  const [texte, setTexte] = useState(""); // compte rendu / problème
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState("");

  const charger = useCallback(async () => {
    try {
      const d = await apiGet("/api/employe/moi");
      setData(d);
      setErreur("");
    } catch (e) {
      setErreur(e?.data?.erreur || t("err_envoi"));
    }
  }, [t]);

  useEffect(() => { charger(); }, [charger]);

  async function majDispo(dispo) {
    try {
      await apiPatch("/api/employe/moi", { dispo });
      setData((d) => (d ? { ...d, intervenant: { ...d.intervenant, dispo } } : d));
    } catch {}
  }

  async function agir(id, action) {
    if (occupe) return;
    setOccupe(true);
    setMessage("");
    try {
      const corps = { id, action };
      if (action === "terminer" && texte.trim()) corps.compteRendu = texte.trim();
      if (action === "probleme") corps.problemeTexte = texte.trim();
      await apiPatch("/api/employe/intervention", corps);
      setTexte("");
      setMessage(t("emp_maj_ok"));
      await charger();
    } catch (e) {
      setErreur(e?.data?.erreur || t("err_envoi"));
    }
    setOccupe(false);
  }

  if (!data && !erreur) return <View style={S.ecran}><Charge /></View>;

  const interventions = data?.interventions || [];
  const maintenant = Date.now();
  const avenir = interventions.filter((d) => !["TERMINEE", "ANNULEE"].includes(d.statut));
  const passees = interventions.filter((d) => ["TERMINEE", "ANNULEE"].includes(d.statut)).slice(-10).reverse();

  const Carte = ({ d }) => {
    const ouvert = ouverte === d.id;
    return (
      <View style={[S.carte, { marginBottom: 10 }]}>
        <TouchableOpacity onPress={() => { setOuverte(ouvert ? null : d.id); setTexte(""); setMessage(""); }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 15.5, flex: 1 }}>
              {dateLisible(d.date)}
            </Text>
            {d.prioritaire && (
              <Text style={{ color: "#A33B3B", fontWeight: "800", fontSize: 11 }}>{t("emp_prioritaire")}</Text>
            )}
          </View>
          <Text style={{ color: C.encre, marginTop: 4 }}>
            {t("emp_patient")} : <Text style={{ fontWeight: "700" }}>{d.nom || d.telephone}</Text>
          </Text>
          {!!d.depart && <Text style={{ color: C.gris, fontSize: 13.5, marginTop: 2 }}>{t("emp_depart")} : {d.depart}</Text>}
          {!!d.destination && <Text style={{ color: C.gris, fontSize: 13.5 }}>{t("emp_dest")} : {d.destination}</Text>}
          {!!d.fenetre && <Text style={{ color: C.gris, fontSize: 13.5 }}>{d.fenetre}</Text>}
        </TouchableOpacity>

        {ouvert && (
          <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: C.ligne, paddingTop: 12 }}>
            {!!d.telephone && (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${d.telephone}`).catch(() => {})}>
                <Text style={{ color: C.vert, fontWeight: "800", marginBottom: 10 }}>📞 {d.telephone}</Text>
              </TouchableOpacity>
            )}

            {actionsPossibles(d).includes("terminer") && (
              <>
                <Text style={S.label}>{t("emp_cr_l")}</Text>
                <TextInput
                  style={[S.champ, { minHeight: 64, textAlignVertical: "top" }]}
                  multiline value={texte} onChangeText={setTexte}
                  placeholder={t("emp_cr_ph")} placeholderTextColor={C.grisClair}
                />
              </>
            )}
            {actionsPossibles(d).includes("probleme") && (
              <>
                <Text style={S.label}>{t("emp_pb_l")}</Text>
                <TextInput
                  style={[S.champ, { minHeight: 64, textAlignVertical: "top" }]}
                  multiline value={texte} onChangeText={setTexte}
                  placeholder={t("emp_pb_ph")} placeholderTextColor={C.grisClair}
                />
              </>
            )}

            {actionsPossibles(d).map((a) => (
              <View key={a} style={{ marginBottom: 8 }}>
                <Bouton titre={t(`emp_${a}`)} onPress={() => agir(d.id, a)} charge={occupe} />
              </View>
            ))}

            {!!message && <Text style={{ color: C.vertFonce, fontWeight: "700", marginTop: 6 }}>{message}</Text>}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={S.ecran}
      contentContainerStyle={S.contenu}
      refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={async () => { setRafraichit(true); await charger(); setRafraichit(false); }} />}
    >
      <Text style={S.h1}>{t("emp_t")}</Text>
      {!!data?.prenom && <Text style={S.sous}>{t("emp_bonjour")} {data.prenom}</Text>}

      {!!erreur && <Text style={S.erreur}>{erreur}</Text>}

      {data?.intervenant && (
        <>
          <Text style={S.label}>{t("emp_dispo_l")}</Text>
          <View style={S.ligneChips}>
            {DISPOS.map((v) => (
              <Chip key={v} titre={t(`emp_dispo_${v}`)} actif={data.intervenant.dispo === v} onPress={() => majDispo(v)} />
            ))}
          </View>
        </>
      )}

      <Text style={[S.label, { marginTop: 16, fontSize: 15 }]}>{t("emp_avenir")}</Text>
      {avenir.length === 0 && <Text style={S.vide}>{t("emp_aucune")}</Text>}
      {avenir.map((d) => <Carte key={d.id} d={d} />)}

      {passees.length > 0 && (
        <>
          <Text style={[S.label, { marginTop: 16, fontSize: 15 }]}>{t("emp_historique")}</Text>
          {passees.map((d) => <Carte key={d.id} d={d} />)}
        </>
      )}

      <TouchableOpacity onPress={() => proposerAppel(t)} style={{ marginTop: 26, alignItems: "center" }}>
        <Text style={{ color: C.gris }}>
          {t("urgence")} <Text style={{ color: C.vertFonce, fontWeight: "800" }}>{TEL_AFFICHE}</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
