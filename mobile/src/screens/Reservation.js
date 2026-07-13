// Réservation — mêmes règles que le site : créneaux calculés en temps réel
// depuis les plannings des intervenants, fenêtres de livraison à capacité.
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView } from "react-native";
import { C, S } from "../theme";
import { Bouton, Chip, Charge, SERVICES_LIB } from "../ui";
import { useLangue } from "../i18n";
import { apiGet, apiPost } from "../api";
import { useAuth } from "../auth";

const FENETRES = [
  { id: "asap", fr: "au plus tôt" },
  { id: "matin", fr: "matin (8h–12h)" },
  { id: "midi", fr: "midi (12h–15h)" },
  { id: "soir", fr: "après-midi (15h–19h)" },
];

function joursProchains(n = 10) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push({
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      lib: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
    });
  }
  return out;
}

export default function Reservation({ route, navigation }) {
  const service = route.params?.service || "transport";
  const { t } = useLangue();
  const { profil, user } = useAuth();
  const livraison = service === "medicaments";

  const jours = useMemo(() => joursProchains(), []);
  const [jour, setJour] = useState(jours[0].iso);
  const [depart, setDepart] = useState("");
  const [destination, setDestination] = useState("");
  const [commune, setCommune] = useState(profil?.commune || "");
  const [typeTrajet, setTypeTrajet] = useState("aller_retour");
  const [notes, setNotes] = useState("");
  const [creneaux, setCreneaux] = useState(null);
  const [heure, setHeure] = useState("");
  const [fenetres, setFenetres] = useState(null);
  const [fenetre, setFenetre] = useState("asap");
  const [estimation, setEstimation] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState(null);

  // Créneaux / fenêtres réels pour le jour choisi.
  useEffect(() => {
    let annule = false;
    setHeure("");
    if (livraison) {
      apiGet(`/api/creneaux?service=medicaments&jour=${jour}`)
        .then((d) => !annule && setFenetres(d.fenetres || []))
        .catch(() => !annule && setFenetres([]));
    } else {
      setCreneaux(null);
      const u = new URLSearchParams({ service, jour, duree: "60" });
      if (commune.trim()) u.set("commune", commune.trim());
      if (service === "transport") u.set("typeTrajet", typeTrajet);
      apiGet(`/api/creneaux?${u.toString()}`)
        .then((d) => !annule && setCreneaux(d.creneaux || []))
        .catch(() => !annule && setCreneaux([]));
    }
    return () => { annule = true; };
  }, [service, jour, commune, typeTrajet, livraison]);

  // Prix estimé (mêmes règles que la facturation, remise du client incluse).
  useEffect(() => {
    let annule = false;
    setEstimation(null);
    if (livraison ? !fenetre : !heure) return;
    const u = new URLSearchParams({ service, duree: "60" });
    u.set("date", `${jour}T${livraison ? "09:00" : heure}`);
    if (service === "transport") u.set("typeTrajet", typeTrajet);
    apiGet(`/api/finances/estimation?${u.toString()}`)
      .then((d) => !annule && d?.disponible && setEstimation(d))
      .catch(() => {});
    return () => { annule = true; };
  }, [service, jour, heure, fenetre, typeTrajet, livraison]);

  async function confirmer() {
    setErreur("");
    if (!livraison && !heure) return;
    setOccupe(true);
    try {
      const corps = {
        service,
        nom: [profil?.prenom, profil?.nom].filter(Boolean).join(" ") || undefined,
        telephone: profil?.telephone || user?.phone || "",
        commune: commune.trim() || undefined,
        notes: notes.trim() || undefined,
        espace: "patient",
      };
      if (livraison) {
        corps.date = `${jour}T09:00`;
        corps.fenetre = FENETRES.find((f) => f.id === fenetre)?.fr;
      } else {
        corps.date = `${jour}T${heure}`;
        corps.depart = depart.trim() || undefined;
        corps.destination = destination.trim() || undefined;
        if (service === "transport") corps.typeTrajet = typeTrajet;
      }
      const d = await apiPost("/api/demandes", corps);
      setFait(d.id || d.demande?.id || true);
    } catch (e) {
      if (e?.data?.erreur === "creneau_pris") setErreur(t("err_creneau_pris"));
      else if (e?.data?.erreur === "fenetre_pleine") setErreur(t("err_fenetre"));
      else setErreur(t("err_envoi"));
    }
    setOccupe(false);
  }

  if (fait) {
    return (
      <View style={[S.ecran, { justifyContent: "center", padding: 24 }]}>
        <Text style={{ fontSize: 56, textAlign: "center", marginBottom: 10 }}>✅</Text>
        <Text style={[S.h1, { textAlign: "center" }]}>{t("rdv_ok_t")}</Text>
        <Text style={[S.sous, { textAlign: "center" }]}>{t("rdv_ok_p")}</Text>
        <Bouton titre={t("suivi_t")} onPress={() => navigation.replace("Suivi", { id: typeof fait === "number" ? fait : undefined })} />
      </View>
    );
  }

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
      <Text style={S.h1}>{SERVICES_LIB[service]}</Text>

      {!livraison && (
        <>
          {service === "transport" && (
            <>
              <Text style={S.label}>{t("depart_l")}</Text>
              <TextInput style={S.champ} value={depart} onChangeText={setDepart} placeholder="Ex. domicile — Alger-Centre" placeholderTextColor={C.grisClair} />
              <Text style={S.label}>{t("dest_l")}</Text>
              <TextInput style={S.champ} value={destination} onChangeText={setDestination} placeholder="Ex. CHU Mustapha" placeholderTextColor={C.grisClair} />
              <View style={S.ligneChips}>
                <Chip titre={t("aller_simple")} actif={typeTrajet === "aller_simple"} onPress={() => setTypeTrajet("aller_simple")} />
                <Chip titre={t("aller_retour")} actif={typeTrajet === "aller_retour"} onPress={() => setTypeTrajet("aller_retour")} />
              </View>
            </>
          )}
          <Text style={S.label}>{t("commune_l")}</Text>
          <TextInput style={S.champ} value={commune} onChangeText={setCommune} placeholder="Ex. Alger-Centre" placeholderTextColor={C.grisClair} />
        </>
      )}

      <Text style={S.label}>{t("jour_l")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {jours.map((jv) => (
          <Chip key={jv.iso} titre={jv.lib} actif={jour === jv.iso} onPress={() => setJour(jv.iso)} />
        ))}
      </ScrollView>

      {livraison ? (
        <>
          <Text style={S.label}>{t("fenetre_l")}</Text>
          {fenetres === null && <Charge />}
          <View style={S.ligneChips}>
            {FENETRES.map((f) => {
              const info = fenetres?.find((x) => x.id === f.id);
              const complet = !!info?.complet;
              const lib = f.fr + (complet ? ` — ${t("complet")}` : info?.presqueComplet ? ` — ${t("presque")}` : "");
              return <Chip key={f.id} titre={lib} actif={fenetre === f.id} desactive={complet} onPress={() => setFenetre(f.id)} />;
            })}
          </View>
        </>
      ) : (
        <>
          <Text style={S.label}>{t("creneau_l")}</Text>
          {creneaux === null && <Charge />}
          {creneaux?.length === 0 && <Text style={S.vide}>{t("aucun_creneau")}</Text>}
          <View style={S.ligneChips}>
            {(creneaux || []).filter((c) => c.dispo).map((c) => (
              <Chip key={c.heure} titre={c.heure} actif={heure === c.heure} onPress={() => setHeure(c.heure)} />
            ))}
          </View>
        </>
      )}

      <Text style={S.label}>{t("notes_l")}</Text>
      <TextInput
        style={[S.champ, { minHeight: 70, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Ex. fauteuil roulant, 2e étage sans ascenseur…"
        placeholderTextColor={C.grisClair}
      />

      {estimation && (
        <View style={[S.cartePale, { borderColor: C.vert }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 15 }}>{t("est_t")}</Text>
            <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 17 }}>
              {estimation.total.toLocaleString("fr-FR")} {estimation.devise}
            </Text>
          </View>
          {estimation.lignes.map((l, i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
              <Text style={{ color: C.encre, fontSize: 13, flex: 1 }}>{l.libelle}{l.quantite > 1 ? ` × ${l.quantite}` : ""}</Text>
              <Text style={{ color: C.encre, fontSize: 13 }}>{l.montant.toLocaleString("fr-FR")}</Text>
            </View>
          ))}
          {estimation.remiseTotal > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
              <Text style={{ color: C.vertFonce, fontWeight: "800", fontSize: 13 }}>{estimation.remiseDetail || t("est_remise")}</Text>
              <Text style={{ color: C.vertFonce, fontWeight: "800", fontSize: 13 }}>-{estimation.remiseTotal.toLocaleString("fr-FR")}</Text>
            </View>
          )}
          <Text style={{ color: C.gris, fontSize: 11.5, marginTop: 6, lineHeight: 16 }}>{t("est_note")}</Text>
        </View>
      )}

      {!!erreur && <Text style={S.erreur}>{erreur}</Text>}
      <Bouton
        titre={t("confirmer_b")}
        onPress={confirmer}
        charge={occupe}
        desactive={!livraison && !heure}
      />
    </ScrollView>
  );
}
