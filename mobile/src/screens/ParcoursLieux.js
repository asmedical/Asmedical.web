// Étape 2 — lieux et précisions.
//
// Même contenu, mêmes règles et mêmes messages d'erreur que sur le site :
// la structure (communes, besoins) vient de /api/parcours, la validation de
// validerEtape(). Seule la forme change — ici la commune se choisit dans une
// feuille avec recherche, faute de liste déroulante native lisible.
//
// Trois redondances de l'ancien formulaire disparaissent : le type de trajet
// (déduit du besoin choisi à l'étape 1), la commune en texte libre, et les
// besoins particuliers répétés à plusieurs endroits.
import React, { useMemo, useState } from "react";
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Modal,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { C, S } from "../theme";
import { Bouton, Chip, Charge } from "../ui";
import { useLangue } from "../i18n";
import { useParcours, Stepper, validerEtape } from "../parcours";

const HEURES_RETOUR = Array.from({ length: 13 }, (_, i) => `${String(8 + i).padStart(2, "0")}:00`);

// Classe de véhicule déduite du besoin — copie de vehiculePour() côté site.
// Elle décide quels véhicules peuvent prendre la course : la calculer ici
// évite de reposer à l'utilisateur une question à laquelle il a répondu.
const VEHICULES = {
  chauffeur_medical: "medicalise",
  accompagnement: "accompagne",
  dialyse: "accompagne",
  chimiotherapie: "accompagne",
};
const vehiculePour = (service, type) =>
  service === "transport" ? VEHICULES[type] || "simple" : undefined;

function ChoixCommune({ communes, valeur, onChoisir, t }) {
  const [ouvert, setOuvert] = useState(false);
  const [filtre, setFiltre] = useState("");

  // 57 communes : sans recherche, il faut faire défiler longtemps.
  const liste = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    return f ? communes.filter((c) => c.toLowerCase().includes(f)) : communes;
  }, [communes, filtre]);

  return (
    <>
      {/* Même dessin que S.champ, sans les propriétés de texte : une View ne
          les accepte pas. La hauteur minimale aligne le bouton sur les
          champs de saisie voisins. */}
      <TouchableOpacity
        onPress={() => { setFiltre(""); setOuvert(true); }}
        accessibilityRole="button"
        style={{
          borderWidth: 1.5, borderColor: C.ligne, borderRadius: 12, backgroundColor: C.blanc,
          paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
          minHeight: 48, justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 16, color: valeur ? C.encre : C.grisClair }}>
          {valeur || t("pc_commune_ph")}
        </Text>
      </TouchableOpacity>

      <Modal visible={ouvert} animationType="slide" transparent onRequestClose={() => setOuvert(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-end" }}>
          <View style={{ height: "78%", backgroundColor: C.blanc, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: C.ligne }}>
              <Text style={{ flex: 1, fontWeight: "800", color: C.vertFonce, fontSize: 16 }}>{t("pc_commune_l")}</Text>
              <TouchableOpacity onPress={() => setOuvert(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 22, color: C.gris }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 12 }}>
              <TextInput
                style={S.champ}
                value={filtre}
                onChangeText={setFiltre}
                placeholder={t("pc_commune_ph")}
                placeholderTextColor={C.grisClair}
                autoCorrect={false}
              />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {liste.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => { onChoisir(c); setOuvert(false); }}
                  accessibilityRole="button"
                  style={{
                    paddingVertical: 15, paddingHorizontal: 18,
                    borderBottomWidth: 1, borderBottomColor: C.ligne,
                    backgroundColor: c === valeur ? C.vertPale : C.blanc,
                  }}
                >
                  <Text style={{ fontSize: 16, color: C.encre, fontWeight: c === valeur ? "800" : "500" }}>{c}</Text>
                </TouchableOpacity>
              ))}
              {liste.length === 0 && <Text style={S.vide}>{t("pc_commune_ph")}</Text>}
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function ParcoursLieux({ route, navigation }) {
  const { t } = useLangue();
  const { structure, pret, demande, maj } = useParcours();
  const service = route?.params?.service || demande.service;
  const [manque, setManque] = useState([]);

  if (!pret) return <View style={S.ecran}><Charge /></View>;

  const transport = service === "transport";
  const livraison = service === "medicaments";
  const besoins = demande.besoins || [];

  const champ = (nom) => (v) => { setManque([]); maj({ [nom]: v }); };

  const basculerBesoin = (cle) =>
    maj({ besoins: besoins.includes(cle) ? besoins.filter((x) => x !== cle) : [...besoins, cle] });

  function continuer() {
    const suivant = { ...demande, service };
    const erreurs = validerEtape(structure, "lieux", suivant);
    if (erreurs.length) return setManque(erreurs);
    maj({ service, typeTrajet: vehiculePour(service, demande.type) });
    navigation.navigate("ParcoursCreneau", { service });
  }

  return (
    <KeyboardAvoidingView style={S.ecran} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
        <Text style={S.h1}>{t("pc_lieux_q")}</Text>
        <Stepper etape="lieux" />

        <Text style={S.label}>{transport ? t("pc_depart_l") : livraison ? t("pc_adresse_l") : t("pc_domicile_l")}</Text>
        <TextInput
          style={S.champ}
          value={demande.depart || ""}
          onChangeText={champ("depart")}
          placeholder={transport ? t("depart_ph") : t("pc_adresse_ph")}
          placeholderTextColor={C.grisClair}
        />

        {transport && (
          <>
            <Text style={S.label}>{t("pc_destination_l")}</Text>
            <TextInput
              style={S.champ}
              value={demande.destination || ""}
              onChangeText={champ("destination")}
              placeholder={t("dest_ph")}
              placeholderTextColor={C.grisClair}
            />
          </>
        )}

        {livraison && (
          <>
            <Text style={S.label}>{t("pharmacie_l")}</Text>
            <TextInput
              style={S.champ}
              value={demande.pharmacie || ""}
              onChangeText={champ("pharmacie")}
              placeholder={t("pharmacie_ph")}
              placeholderTextColor={C.grisClair}
            />
          </>
        )}

        <Text style={S.label}>{t("pc_commune_l")}</Text>
        <ChoixCommune
          communes={structure.communes || []}
          valeur={demande.commune}
          onChoisir={champ("commune")}
          t={t}
        />

        {transport && (
          <>
            <Text style={S.label}>{t("pc_trajet_l")}</Text>
            <View style={S.ligneChips}>
              <Chip
                titre={t("pc_trajet_simple")}
                actif={!demande.allerRetour}
                onPress={() => { setManque([]); maj({ allerRetour: false, retourHeure: "" }); }}
              />
              <Chip
                titre={t("pc_trajet_ar")}
                actif={!!demande.allerRetour}
                onPress={() => { setManque([]); maj({ allerRetour: true }); }}
              />
            </View>

            {/* Un aller-retour sans heure laisse le véhicule immobilisé sans
                limite. « À la sortie des soins » est une réponse valable. */}
            {!!demande.allerRetour && (
              <>
                <Text style={S.label}>{t("pc_retour_heure_l")}</Text>
                <View style={S.ligneChips}>
                  <Chip
                    titre={t("pc_retour_sortie")}
                    actif={demande.retourHeure === "sortie"}
                    onPress={() => { setManque([]); maj({ retourHeure: "sortie" }); }}
                  />
                  {HEURES_RETOUR.map((h) => (
                    <Chip
                      key={h}
                      titre={h}
                      actif={demande.retourHeure === h}
                      onPress={() => { setManque([]); maj({ retourHeure: h }); }}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}

        <Text style={[S.h1, { fontSize: 17, marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: C.ligne }]}>
          {t("pc_precisions_t")}
        </Text>

        {/* Préférence d'intervenant(e) : un souhait, jamais une condition.
            S'il ne peut pas être respecté, la demande passe quand même. */}
        {!transport && !livraison && (
          <>
            <Text style={S.label}>{t("genre_l")}</Text>
            <View style={S.ligneChips}>
              {[["", "genre_indif"], ["femme", "genre_femme"], ["homme", "genre_homme"]].map(([v, cle]) => (
                <Chip
                  key={cle}
                  titre={t(cle)}
                  actif={(demande.prefGenre || "") === v}
                  onPress={() => maj({ prefGenre: v })}
                />
              ))}
            </View>
            <Text style={{ color: C.gris, fontSize: 13, marginBottom: 12, lineHeight: 18 }}>{t("genre_aide")}</Text>
          </>
        )}

        <Text style={S.label}>{t("pc_besoins_l")}</Text>
        <View style={S.ligneChips}>
          {(structure.besoins || []).map((b) => (
            <Chip
              key={b.cle}
              titre={t(b.libelle)}
              actif={besoins.includes(b.cle)}
              onPress={() => basculerBesoin(b.cle)}
            />
          ))}
        </View>

        {/* Étage et ascenseur séparés : « 3e sans ascenseur » en texte libre
            n'était pas exploitable pour décider s'il faut deux porteurs. */}
        <Text style={S.label}>{t("pc_acces_l")}</Text>
        <TextInput
          style={S.champ}
          value={demande.etage || ""}
          onChangeText={champ("etage")}
          keyboardType="number-pad"
          placeholder={t("pc_etage_l")}
          placeholderTextColor={C.grisClair}
        />
        <View style={[S.ligneChips, { alignItems: "center" }]}>
          <Text style={[S.label, { marginBottom: 0, marginRight: 8 }]}>{t("pc_ascenseur_l")}</Text>
          <Chip titre={t("pc_oui")} actif={demande.ascenseur === true} onPress={() => maj({ ascenseur: true })} />
          <Chip titre={t("pc_non")} actif={demande.ascenseur === false} onPress={() => maj({ ascenseur: false })} />
        </View>

        <Text style={[S.label, { marginTop: 14 }]}>{t("pc_code_porte_l")}</Text>
        <TextInput style={S.champ} value={demande.code || ""} onChangeText={champ("code")} />

        <Text style={S.label}>{t("pc_prevenir_l")}</Text>
        <TextInput
          style={S.champ}
          value={demande.prevenirNom || ""}
          onChangeText={champ("prevenirNom")}
          placeholder={t("pc_prevenir_nom")}
          placeholderTextColor={C.grisClair}
        />
        <TextInput
          style={S.champ}
          value={demande.prevenirTel || ""}
          onChangeText={champ("prevenirTel")}
          keyboardType="phone-pad"
          placeholder={t("pc_prevenir_tel")}
          placeholderTextColor={C.grisClair}
        />

        {/* Un seul champ libre dans tout le parcours. */}
        <Text style={S.label}>{t("pc_precision_l")}</Text>
        <TextInput
          style={[S.champ, { height: 96, textAlignVertical: "top", paddingTop: 12 }]}
          value={demande.notes || ""}
          onChangeText={champ("notes")}
          multiline
        />

        {manque.map((cle) => <Text style={S.erreur} key={cle}>{t(cle)}</Text>)}
        <Bouton titre={t("pc_suivant")} onPress={continuer} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
