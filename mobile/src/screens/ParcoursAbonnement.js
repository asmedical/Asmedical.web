// Besoin régulier (dialyse, chimiothérapie) → parcours abonnement.
//
// Aucun créneau n'est affiché : un patient dialysé vient trois fois par
// semaine, aux mêmes heures, pendant des mois. Cela se cale avec la
// régulation — proposer des créneaux temps réel ici reviendrait à promettre
// ce qu'on ne peut pas tenir. La demande part en confirmation humaine, avec
// rappel sous 30 minutes.
import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { C, S } from "../theme";
import { Bouton, Chip } from "../ui";
import { useLangue } from "../i18n";
import { apiPost } from "../api";
import { useParcours } from "../parcours";

const JOURS = ["j_dim", "j_lun", "j_mar", "j_mer", "j_jeu", "j_ven", "j_sam"];
const HEURES = Array.from({ length: 12 }, (_, i) => `${String(7 + i).padStart(2, "0")}:00`);

// Demain par défaut, jamais aujourd'hui : /api/abonnements crée la première
// prestation à « début + heure ». Un abonnement demandé à 18 h avec un début
// au jour même produisait un rendez-vous à 8 h... déjà passé.
const isoJour = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const PROCHAINS = Array.from({ length: 14 }, (_, i) => isoJour(new Date(Date.now() + (i + 1) * 86400000)));

// Classe de véhicule déduite du besoin — sans elle, la régulation ignore
// qu'il faut un véhicule médicalisé.
const VEHICULES = { chauffeur_medical: "medicalise", accompagnement: "accompagne", dialyse: "accompagne", chimiotherapie: "accompagne" };

export default function ParcoursAbonnement({ route }) {
  const { t } = useLangue();
  const { demande } = useParcours();
  const type = route?.params?.type || demande.type;

  const [jours, setJours] = useState([]);
  const [heure, setHeure] = useState("08:00");
  const [centre, setCentre] = useState("");
  const [domicile, setDomicile] = useState("");
  const [telephone, setTelephone] = useState("");
  const [debut, setDebut] = useState(PROCHAINS[0]);
  const [etat, setEtat] = useState("saisie"); // saisie | envoi | ok
  const [erreur, setErreur] = useState("");

  const basculer = (i) =>
    setJours((l) => (l.includes(i) ? l.filter((x) => x !== i) : [...l, i].sort()));

  async function envoyer() {
    if (etat === "envoi") return;
    setErreur("");
    if (!jours.length) return setErreur(t("err_jours"));
    if (!centre.trim()) return setErreur(t("err_centre"));
    if (telephone.replace(/\D/g, "").length < 9) return setErreur(t("err_tel_format"));

    setEtat("envoi");
    try {
      await apiPost("/api/abonnements", {
        telephone, jours, heure, centre, domicile, retour: true, debut,
        typeTrajet: VEHICULES[type] || "simple",
        nom: demande.pourPatientNom || undefined,
        notes: type ? `Type : ${type}` : "",
      });
      setEtat("ok");
    } catch (e) {
      setErreur(e?.data?.erreur || t("err_serveur"));
      setEtat("saisie");
    }
  }

  if (etat === "ok") {
    return (
      <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
        <Text style={S.h1}>{t("pc_succes_t")}</Text>
        <View style={[S.carte, { backgroundColor: C.vertPale, borderColor: C.vert }]}>
          <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 16 }}>{t("pc_recurrent_t")}</Text>
          <Text style={{ color: C.encre, marginTop: 6, lineHeight: 21 }}>{t("pc_succes_p")}</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={S.ecran} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
        <Text style={S.h1}>{t("pc_recurrent_t")}</Text>
        <Text style={S.sous}>{t("pc_recurrent_p")}</Text>

        <Text style={S.label}>{t("abo_jours_l")}</Text>
        <View style={S.ligneChips}>
          {JOURS.map((cle, i) => (
            <Chip key={cle} titre={t(cle)} actif={jours.includes(i)} onPress={() => basculer(i)} />
          ))}
        </View>

        <Text style={S.label}>{t("abo_heure_l")}</Text>
        <View style={S.ligneChips}>
          {HEURES.map((h) => (
            <Chip key={h} titre={h} actif={heure === h} onPress={() => setHeure(h)} />
          ))}
        </View>

        <Text style={S.label}>{t("abo_debut_l")}</Text>
        <View style={S.ligneChips}>
          {PROCHAINS.map((j) => (
            <Chip
              key={j}
              titre={j.slice(8) + "/" + j.slice(5, 7)}
              actif={debut === j}
              onPress={() => setDebut(j)}
            />
          ))}
        </View>

        <Text style={S.label}>{t("abo_centre_l")}</Text>
        <TextInput style={S.champ} value={centre} onChangeText={setCentre}
                   placeholder={t("dest_ph")} placeholderTextColor={C.grisClair} />

        <Text style={S.label}>{t("depart_l")}</Text>
        <TextInput style={S.champ} value={domicile} onChangeText={setDomicile}
                   placeholder={t("depart_ph")} placeholderTextColor={C.grisClair} />

        <Text style={S.label}>{t("tel_l")}</Text>
        <TextInput style={S.champ} value={telephone} onChangeText={setTelephone}
                   keyboardType="phone-pad" placeholder={t("tel_ph")} placeholderTextColor={C.grisClair} />

        {!!erreur && <Text style={S.erreur}>{erreur}</Text>}
        <Bouton titre={t("pc_recurrent_b")} onPress={envoyer} charge={etat === "envoi"} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
