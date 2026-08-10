// Étape 3 — date et heure.
//
// Même calendrier que sur le site : le mois entier d'un coup, les jours sans
// aucune place grisés. Les disponibilités viennent de /api/disponibilites,
// calculées par le MÊME moteur que les créneaux — le calendrier ne promet
// donc jamais un jour que la réservation refuserait.
//
// Pour les médicaments, aucune heure précise : le coursier enchaîne des
// tournées, on choisit une fenêtre.
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking } from "react-native";
import { C, S } from "../theme";
import { Bouton, Chip } from "../ui";
import { useLangue, TEL_AFFICHE, TEL_LIEN } from "../i18n";
import { apiGet } from "../api";
import { useParcours, Stepper, validerEtape } from "../parcours";

const JOURS_COURTS = ["j_lun", "j_mar", "j_mer", "j_jeu", "j_ven", "j_sam", "j_dim"];

const isoJour = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function ParcoursCreneau({ route, navigation }) {
  const { t, langue } = useLangue();
  const { structure, demande, maj } = useParcours();
  const service = route?.params?.service || demande.service;

  const aujourdhui = useMemo(() => new Date(), []);
  const [mois, setMois] = useState(() => new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1));
  const [jours, setJours] = useState(null);
  const [creneaux, setCreneaux] = useState(null);
  const [fenetres, setFenetres] = useState(null);
  const [charge, setCharge] = useState(false);
  const [manque, setManque] = useState([]);
  const [erreur, setErreur] = useState("");

  const livraison = service === "medicaments";
  const cleMois = `${mois.getFullYear()}-${String(mois.getMonth() + 1).padStart(2, "0")}`;
  const jourChoisi = demande.jour || "";

  useEffect(() => {
    let annule = false;
    const u = new URLSearchParams({ service, mois: cleMois });
    if (demande.commune) u.set("commune", demande.commune);
    if (demande.typeTrajet) u.set("typeTrajet", demande.typeTrajet);
    setJours(null);
    setErreur("");
    apiGet(`/api/disponibilites?${u}`)
      .then((j) => { if (!annule) setJours(j?.jours || []); })
      .catch(() => { if (!annule) { setJours([]); setErreur(t("err_serveur")); } });
    return () => { annule = true; };
  }, [cleMois, service, demande.commune, demande.typeTrajet]);

  useEffect(() => {
    if (!jourChoisi) return;
    let annule = false;
    const u = new URLSearchParams({ service, jour: jourChoisi });
    if (demande.commune) u.set("commune", demande.commune);
    if (demande.typeTrajet) u.set("typeTrajet", demande.typeTrajet);
    setCharge(true);
    setErreur("");
    apiGet(`/api/creneaux?${u}`)
      .then((j) => {
        if (annule) return;
        setCreneaux(j?.creneaux || null);
        setFenetres(j?.fenetres || null);
      })
      .catch(() => { if (!annule) setErreur(t("err_serveur")); })
      .finally(() => { if (!annule) setCharge(false); });
    return () => { annule = true; };
  }, [jourChoisi, service, demande.commune, demande.typeTrajet]);

  const choisirJour = (iso) => { setManque([]); maj({ jour: iso, iso: "", fenetre: "" }); };

  function continuer() {
    const erreurs = validerEtape(structure, "creneau", { ...demande, service });
    if (erreurs.length) return setManque(erreurs);
    navigation.navigate("ParcoursConfirmation", { service });
  }

  // --- Grille du mois, lundi en première colonne.
  const decalage = (new Date(mois.getFullYear(), mois.getMonth(), 1).getDay() + 6) % 7;
  const nbJours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate();
  const cases = [
    ...Array.from({ length: decalage }, () => null),
    ...Array.from({ length: nbJours }, (_, i) => new Date(mois.getFullYear(), mois.getMonth(), i + 1)),
  ];
  const moisPrecedentPossible =
    mois.getFullYear() > aujourdhui.getFullYear() ||
    (mois.getFullYear() === aujourdhui.getFullYear() && mois.getMonth() > aujourdhui.getMonth());
  const loc = langue === "ar" ? "ar" : "fr-FR";
  const prochainDispo = (jours || []).find((j) => j.dispo && j.date >= isoJour(aujourdhui));

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Text style={S.h1}>{t("pc_calendrier_t")}</Text>
      <Stepper etape="creneau" />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <TouchableOpacity
          onPress={() => setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))}
          disabled={!moisPrecedentPossible}
          accessibilityRole="button"
          style={{
            width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.ligne,
            alignItems: "center", justifyContent: "center", opacity: moisPrecedentPossible ? 1 : 0.35,
          }}
        >
          <Text style={{ fontSize: 22, color: C.encre }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 16.5, fontWeight: "800", color: C.encre, textTransform: "capitalize" }}>
          {mois.toLocaleDateString(loc, { month: "long", year: "numeric" })}
        </Text>
        <TouchableOpacity
          onPress={() => setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))}
          accessibilityRole="button"
          style={{
            width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.ligne,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 22, color: C.encre }}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {JOURS_COURTS.map((j) => (
          <Text
            key={j}
            style={{ width: `${100 / 7}%`, textAlign: "center", fontSize: 12, fontWeight: "700", color: C.gris, paddingBottom: 6 }}
          >
            {t(j).slice(0, 3)}
          </Text>
        ))}
        {cases.map((date, i) => {
          if (!date) return <View key={`v${i}`} style={{ width: `${100 / 7}%`, height: 46 }} />;
          const iso = isoJour(date);
          // Tant que le mois charge, aucun jour n'est présenté comme
          // réservable : mieux vaut une grille neutre qu'une promesse.
          const ouvrable = !!(jours || []).find((x) => x.date === iso)?.dispo;
          const actif = iso === jourChoisi;
          return (
            <View key={iso} style={{ width: `${100 / 7}%`, padding: 2.5 }}>
              <TouchableOpacity
                onPress={() => choisirJour(iso)}
                disabled={!ouvrable}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ouvrable, selected: actif }}
                style={{
                  height: 44, borderRadius: 10, borderWidth: 1,
                  alignItems: "center", justifyContent: "center",
                  borderColor: actif ? C.vert : C.ligne,
                  backgroundColor: actif ? C.vert : ouvrable ? C.blanc : C.vertPale,
                  opacity: ouvrable || actif ? 1 : 0.4,
                }}
              >
                <Text style={{ fontSize: 15.5, fontWeight: "700", color: actif ? C.blanc : ouvrable ? C.encre : C.gris }}>
                  {date.getDate()}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {jours === null && <Text style={S.vide}>{t("pc_chargement")}</Text>}
      {jours !== null && !jours.some((j) => j.dispo) && <Text style={S.vide}>{t("pc_aucun_creneau")}</Text>}
      {!!prochainDispo && !jourChoisi && (
        <TouchableOpacity onPress={() => choisirJour(prochainDispo.date)} style={{ alignItems: "center", marginBottom: 8 }}>
          <Text style={{ color: C.vertFonce, fontWeight: "700", fontSize: 15, textDecorationLine: "underline" }}>
            {t("pc_prochain_jour")}
          </Text>
        </TouchableOpacity>
      )}

      {!!jourChoisi && (
        <View style={{ marginTop: 16 }}>
          <Text style={S.label}>{livraison ? t("pc_fenetres_l") : t("pc_heures_l")}</Text>
          {charge && <Text style={S.vide}>{t("pc_chargement")}</Text>}

          {!charge && livraison && (
            <View style={S.ligneChips}>
              {(fenetres || []).map((f) => {
                const def = (structure.fenetres || []).find((x) => x.cle === f.id);
                const suffixe = f.complet ? ` · ${t("pc_complet")}` : f.presqueComplet ? ` · ${t("pc_bientot_complet")}` : "";
                return (
                  <Chip
                    key={f.id}
                    titre={(def ? t(def.libelle) : f.fr) + suffixe}
                    actif={demande.fenetre === f.id}
                    desactive={f.complet}
                    onPress={() => { setManque([]); maj({ fenetre: f.id, fenetreFr: f.fr }); }}
                  />
                );
              })}
            </View>
          )}

          {!charge && !livraison && (
            <View style={S.ligneChips}>
              {(creneaux || []).filter((c) => c.dispo).map((c) => (
                <Chip
                  key={c.iso}
                  titre={c.heure + (c.restant === 1 ? ` · ${t("pc_bientot_complet")}` : "")}
                  actif={demande.iso === c.iso}
                  onPress={() => { setManque([]); maj({ iso: c.iso, heure: c.heure }); }}
                />
              ))}
            </View>
          )}

          {/* Journée vide : un appel obtient une réponse tout de suite, là où
              un formulaire de plus ne ferait que reporter le problème. */}
          {!charge && !livraison && (creneaux || []).every((c) => !c.dispo) && (
            <>
              <Text style={S.vide}>{t("pc_aucun_creneau")}</Text>
              <TouchableOpacity
                onPress={() => Linking.openURL(TEL_LIEN).catch(() => {})}
                accessibilityRole="button"
                style={{ minHeight: 54, borderRadius: 14, backgroundColor: C.vert, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: C.blanc, fontWeight: "800", fontSize: 15.5 }}>
                  {t("pc_urgent_asm")} · {TEL_AFFICHE}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {!!erreur && <Text style={S.erreur}>{erreur}</Text>}
      {manque.map((cle) => <Text style={S.erreur} key={cle}>{t(cle)}</Text>)}
      <View style={{ height: 14 }} />
      <Bouton titre={t("pc_suivant")} onPress={continuer} />
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
