// Suivi en direct : étapes horodatées, intervenant, VÉHICULE (modèle,
// couleur, plaque) et avis en fin d'intervention — comme sur le site.
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Linking, Image } from "react-native";
import { C, S } from "../theme";
import { Bouton, Charge, SERVICES_LIB } from "../ui";
import { useLangue, TEL_AFFICHE, TEL_LIEN } from "../i18n";
import { apiGet, apiPost } from "../api";

const ETAPES = ["suivi_recue", "suivi_confirmee", "suivi_affectee", "suivi_encours", "suivi_terminee"];
const INDEX = { A_RAPPELER: 0, CONFIRMEE: 1, AFFECTEE: 2, EN_COURS: 3, TERMINEE: 4 };

function etatLive(d) {
  if (d.finLe || d.statut === "TERMINEE") return { cle: "live_terminee", actif: false };
  if (d.debutLe || d.statut === "EN_COURS") return { cle: "live_encours", actif: true };
  if (d.arriveeLe) return { cle: "live_arrive", actif: true };
  if (d.enRouteLe) return { cle: "live_enroute", actif: true };
  if (d.accepteeLe || d.statut === "CONFIRMEE") return { cle: "live_confirmee", actif: false };
  if (d.soignant || d.transporteur || d.statut === "AFFECTEE") return { cle: "live_assignee", actif: false };
  return { cle: "live_recue", actif: false };
}

function BlocAvis({ demande, t, onFait }) {
  const [note, setNote] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [etat, setEtat] = useState(demande.avis ? "fait" : "form");

  if (etat === "fait" || demande.avis) {
    const n = demande.avis?.note ?? note;
    return (
      <View style={S.cartePale}>
        <Text style={{ fontWeight: "800", color: C.vertFonce }}>{t("avis_merci")}</Text>
        <Text style={{ fontSize: 22, color: C.or, marginTop: 4 }}>{"★".repeat(n)}{"☆".repeat(5 - n)}</Text>
      </View>
    );
  }
  return (
    <View style={S.carte}>
      <Text style={{ fontWeight: "800", color: C.encre, marginBottom: 8 }}>{t("avis_titre")}</Text>
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <TouchableOpacity key={i} onPress={() => setNote(i)}>
            <Text style={{ fontSize: 34, color: i <= note ? C.or : C.ligne }}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput style={S.champ} placeholder={t("avis_ph")} placeholderTextColor={C.grisClair} value={commentaire} onChangeText={setCommentaire} />
      <Bouton
        titre={t("avis_envoyer")}
        charge={etat === "envoi"}
        desactive={note < 1}
        onPress={async () => {
          setEtat("envoi");
          try {
            await apiPost("/api/avis", { demandeId: demande.id, note, commentaire: commentaire.trim() });
            setEtat("fait");
            onFait?.();
          } catch {
            setEtat("form");
          }
        }}
      />
    </View>
  );
}

export default function Suivi({ route }) {
  const { t } = useLangue();
  const idVoulu = route.params?.id;
  const [demande, setDemande] = useState(undefined);

  const charger = useCallback(() => {
    apiGet("/api/mes-demandes")
      .then((d) => {
        const liste = d.demandes || [];
        if (!liste.length) return setDemande(null);
        const trouve = idVoulu ? liste.find((x) => String(x.id) === String(idVoulu)) : null;
        const active = liste.find((x) => !["TERMINEE", "ANNULEE"].includes(x.statut));
        setDemande(trouve || active || liste[0]);
      })
      .catch(() => setDemande(null));
  }, [idVoulu]);

  // Rafraîchissement automatique : suivi réellement « en direct ».
  useEffect(() => {
    charger();
    const minuteur = setInterval(charger, 20000);
    return () => clearInterval(minuteur);
  }, [charger]);

  if (demande === undefined) return <View style={S.ecran}><Charge /></View>;
  if (demande === null) return <View style={S.ecran}><Text style={S.vide}>{t("aucune_demande")}</Text></View>;

  const annulee = demande.statut === "ANNULEE";
  const etapeActive = INDEX[demande.statut] ?? 0;
  const live = etatLive(demande);
  const iv = demande.soignant
    ? { nom: `${demande.soignant.prenom} ${demande.soignant.nom}`, tel: demande.soignant.telephone, photo: demande.soignant.photoUrl }
    : demande.transporteur
    ? { nom: demande.transporteur.nom, tel: demande.transporteur.telephone, photo: demande.transporteur.photoUrl }
    : null;
  const veh = demande.transporteur;

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Text style={S.h1}>{t("suivi_t")}</Text>
      <View style={S.carte}>
        <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 16 }}>
          n°{demande.id} · {SERVICES_LIB[demande.service] || demande.service}
        </Text>
        <Text style={{ color: C.gris, marginTop: 3 }}>
          {demande.date ? demande.date.replace("T", " · ") : "—"}
          {demande.destination ? ` · ${demande.destination}` : ""}
        </Text>
      </View>

      {annulee ? (
        <Text style={[S.erreur, { textAlign: "center" }]}>{t("st_annulee")}</Text>
      ) : (
        <>
          <View style={[S.cartePale, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: live.actif ? C.or : C.vert }} />
            <Text style={{ fontWeight: "800", color: C.vertFonce, flex: 1 }}>{t(live.cle)}</Text>
          </View>

          <View style={S.carte}>
            {ETAPES.map((cle, i) => (
              <View key={cle} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 7 }}>
                <View
                  style={{
                    width: 16, height: 16, borderRadius: 8, marginRight: 12,
                    backgroundColor: i < etapeActive ? C.vert : "transparent",
                    borderWidth: 2.5,
                    borderColor: i <= etapeActive ? C.vert : C.ligne,
                  }}
                />
                <Text style={{ fontSize: 15, fontWeight: i === etapeActive ? "800" : "500", color: i <= etapeActive ? C.encre : C.grisClair }}>
                  {t(cle)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {iv ? (
        <View style={[S.carte, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
          {iv.photo ? (
            <Image source={{ uri: iv.photo }} style={{ width: 52, height: 52, borderRadius: 26 }} />
          ) : (
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.vertPale, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 22 }}>👤</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", fontSize: 15.5, color: C.encre }}>{iv.nom}</Text>
            <Text style={{ color: C.gris, fontSize: 13 }}>{t("suivi_intervenant")}</Text>
          </View>
          {!!iv.tel && (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${iv.tel}`)}
              style={{ backgroundColor: C.vert, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10 }}
            >
              <Text style={{ color: C.blanc, fontWeight: "800" }}>{t("appeler")}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        !annulee && <Text style={[S.sous, { textAlign: "center" }]}>{t("suivi_pas_affecte")}</Text>
      )}

      {/* Véhicule : le patient sait quoi attendre. */}
      {veh && (veh.vehicule || veh.vehiculeImmat) && (
        <View style={[S.cartePale, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <Text style={{ fontSize: 28 }}>🚐</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", color: C.encre }}>
              {[veh.vehicule, veh.vehiculeCouleur].filter(Boolean).join(" · ")}
            </Text>
            <Text style={{ color: C.gris, fontSize: 13 }}>{t("suivi_vehicule")}</Text>
          </View>
          {!!veh.vehiculeImmat && (
            <View style={{ borderWidth: 2, borderColor: C.encre, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.blanc }}>
              <Text style={{ fontWeight: "800", letterSpacing: 1, color: C.encre }}>{veh.vehiculeImmat}</Text>
            </View>
          )}
        </View>
      )}

      {(demande.statut === "TERMINEE" || demande.avis) && <BlocAvis demande={demande} t={t} onFait={charger} />}

      <TouchableOpacity onPress={() => Linking.openURL(TEL_LIEN)} style={{ marginTop: 16, alignItems: "center" }}>
        <Text style={{ color: C.gris }}>
          {t("urgence")} <Text style={{ color: C.vertFonce, fontWeight: "800" }}>{TEL_AFFICHE}</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
