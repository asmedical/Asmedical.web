// Étape 4 — récapitulatif et confirmation.
//
// Tout ce qui a été saisi est relu ici, avec un « Modifier » par bloc : on ne
// fait jamais recommencer le parcours pour corriger une adresse. Le code
// promo reste replié — déplié en permanence, il laisse croire qu'il manque
// quelque chose pour réserver.
//
// La demande part vers /api/demandes sous forme d'ÉTAT du parcours
// (parcours: true) : c'est le serveur qui l'assemble, avec exactement le même
// code que pour le site.
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { C, S } from "../theme";
import { Bouton, Chip } from "../ui";
import { useLangue, TEL_AFFICHE } from "../i18n";
import { apiPost } from "../api";
import { useParcours, Stepper, validerEtape, libelleType } from "../parcours";
import { useAuth } from "../auth";
import Estimation from "../Estimation";

export default function ParcoursConfirmation({ route, navigation }) {
  const { t, langue } = useLangue();
  const { structure, demande, maj, reinitialiser } = useParcours();
  const auth = useAuth();
  const service = route?.params?.service || demande.service;

  const [promoOuvert, setPromoOuvert] = useState(false);
  const [promoEtat, setPromoEtat] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [manque, setManque] = useState([]);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState(null);

  const livraison = service === "medicaments";
  const espace = auth?.profil?.role === "pro" ? "pro" : "patient";
  const moyens = (structure.paiements || []).filter(
    (p) => p.actif && (!p.proSeulement || espace === "pro")
  );

  // Téléphone du compte : le patient ne le retape pas, et l'équipe ne se
  // retrouve pas avec deux numéros pour la même personne.
  useEffect(() => {
    const tel = auth?.profil?.telephone || auth?.user?.phone || "";
    if (tel && !demande.telephone) maj({ telephone: tel });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.profil?.telephone, auth?.user?.phone]);

  // Moyen par défaut proposé, jamais imposé en silence.
  useEffect(() => {
    if (!demande.paiement) {
      const def = moyens.find((p) => p.defaut);
      if (def) maj({ paiement: def.cle });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moyens.length]);

  async function verifierPromo() {
    if (!demande.codePromo?.trim()) return;
    setPromoEtat(null);
    try {
      await apiPost("/api/promo", { code: demande.codePromo, service, telephone: demande.telephone });
      setPromoEtat("ok");
    } catch {
      setPromoEtat("invalide");
    }
  }

  async function confirmer() {
    if (envoi) return;
    setErreur("");
    const erreurs = validerEtape(structure, "confirmation", { ...demande, service });
    if (erreurs.length) return setManque(erreurs);
    if (!demande.telephone || demande.telephone.replace(/\D/g, "").length < 9) {
      return setErreur(t("err_tel_format"));
    }

    setEnvoi(true);
    try {
      const d = await apiPost("/api/demandes", { ...demande, service, espace, parcours: true });
      reinitialiser();
      setFait(d?.id || true);
    } catch (e) {
      const code = e?.data?.erreur;
      // Créneau pris entre l'affichage et la confirmation : on renvoie
      // choisir une autre heure plutôt que d'afficher une erreur sèche.
      if (code === "creneau_pris" || code === "fenetre_pleine") {
        maj({ iso: "", fenetre: "" });
        setErreur(t("pc_conflit"));
        navigation.navigate("ParcoursCreneau", { service });
      } else {
        setErreur(`${t("err_serveur")} ${TEL_AFFICHE}`);
      }
    } finally {
      setEnvoi(false);
    }
  }

  if (fait) {
    return (
      <View style={[S.ecran, { justifyContent: "center", padding: 24 }]}>
        <Text style={{ fontSize: 56, textAlign: "center", marginBottom: 10 }}>✅</Text>
        <Text style={[S.h1, { textAlign: "center" }]}>{t("pc_succes_t")}</Text>
        <Text style={[S.sous, { textAlign: "center" }]}>{t("pc_succes_p")}</Text>
        {typeof fait === "number" && (
          <Text style={{ textAlign: "center", fontWeight: "800", color: C.encre, marginBottom: 16 }}>
            {t("pc_succes_numero")} : {fait}
          </Text>
        )}
        <Bouton
          titre={t("suivi_t")}
          onPress={() => navigation.replace("Suivi", { id: typeof fait === "number" ? fait : undefined })}
        />
      </View>
    );
  }

  const Bloc = ({ titre, valeur, vers }) =>
    valeur ? (
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        gap: 12, paddingVertical: 13, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: C.ligne,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.gris, fontSize: 12.5, fontWeight: "700", marginBottom: 2 }}>{titre}</Text>
          <Text style={{ fontSize: 15.5, fontWeight: "700", color: C.encre, lineHeight: 21 }}>{valeur}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate(vers, { service })} accessibilityRole="button">
          <Text style={{ color: C.vertFonce, fontWeight: "700", fontSize: 14, textDecorationLine: "underline" }}>
            {t("pc_modifier")}
          </Text>
        </TouchableOpacity>
      </View>
    ) : null;

  const typeChoisi = (structure.types?.[service] || []).find((x) => x.cle === demande.type);
  const fenetreLib = (structure.fenetres || []).find((f) => f.cle === demande.fenetre)?.libelle;
  const quand = livraison
    ? [demande.jour, fenetreLib && t(fenetreLib)].filter(Boolean).join(" · ")
    : [demande.jour, demande.heure].filter(Boolean).join(" · ");
  const lieux = service === "transport"
    ? [demande.depart, demande.destination].filter(Boolean).join(" → ")
    : demande.depart;
  const besoinsLib = (demande.besoins || [])
    .map((c) => {
      const b = (structure.besoins || []).find((x) => x.cle === c);
      return b ? t(b.libelle) : c;
    })
    .join(", ");

  return (
    <KeyboardAvoidingView style={S.ecran} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
        <Text style={S.h1}>{t("pc_recap_t")}</Text>
        <Stepper etape="confirmation" />

        {/* Rappel de qui est concerné : sur un compte qui réserve pour
            plusieurs personnes, confirmer sans le voir est trop facile. */}
        {!!demande.pourPatientNom && (
          <View style={[S.cartePale, { marginBottom: 12 }]}>
            <Text style={{ color: C.vertFonce, fontWeight: "700" }}>
              👤 {t("pp_bandeau")} {demande.pourPatientNom}
            </Text>
          </View>
        )}
        {!!demande.packNom && (
          <View style={[S.cartePale, { marginBottom: 12 }]}>
            <Text style={{ color: C.vertFonce, fontWeight: "700" }}>
              🎁 {t("pk_bandeau")} {demande.packNom} — {demande.packPrix} DZD
            </Text>
          </View>
        )}

        <View style={{ borderWidth: 1, borderColor: C.ligne, borderRadius: 14, overflow: "hidden", marginBottom: 18 }}>
          <Bloc titre={t("pc_recap_service")} valeur={libelleType(typeChoisi, t, langue)} vers="ParcoursBesoin" />
          <Bloc titre={t("pc_recap_trajet")} valeur={lieux} vers="ParcoursLieux" />
          <Bloc titre={t("pc_commune_l")} valeur={demande.commune} vers="ParcoursLieux" />
          <Bloc titre={t("pc_recap_quand")} valeur={quand} vers="ParcoursCreneau" />
          <Bloc titre={t("pc_recap_besoins")} valeur={besoinsLib} vers="ParcoursLieux" />
        </View>

        {/* Prix estimé aux tarifs en vigueur, remise du compte comprise. Il
            apparaît AVANT le bouton de confirmation : personne ne devrait
            valider une prestation sans savoir ce qu'elle coûte. */}
        <Estimation
          service={service}
          jour={demande.jour}
          heure={demande.heure}
          duree={demande.duree}
          typeTrajet={demande.typeTrajet}
          packId={demande.packId}
          km={demande.km}
          besoins={demande.besoins}
          allerRetour={demande.allerRetour}
        />

        <Text style={S.label}>{t("tel_l")}</Text>
        <TextInput
          style={S.champ}
          value={demande.telephone || ""}
          onChangeText={(v) => { setErreur(""); maj({ telephone: v }); }}
          keyboardType="phone-pad"
          placeholder={t("tel_ph")}
          placeholderTextColor={C.grisClair}
        />

        {!promoOuvert ? (
          <TouchableOpacity onPress={() => setPromoOuvert(true)} style={{ marginBottom: 14 }}>
            <Text style={{ color: C.vertFonce, fontWeight: "700", fontSize: 15, textDecorationLine: "underline" }}>
              {t("pc_promo_lien")}
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={S.label}>{t("pc_promo_l")}</Text>
            <TextInput
              style={S.champ}
              value={demande.codePromo || ""}
              onChangeText={(v) => { setPromoEtat(null); maj({ codePromo: v }); }}
              autoCapitalize="characters"
              onBlur={verifierPromo}
            />
            {promoEtat === "ok" && <Text style={{ color: C.vertFonce, fontSize: 14, marginBottom: 10 }}>{t("promo_ok")}</Text>}
            {promoEtat && promoEtat !== "ok" && <Text style={S.erreur}>{t("promo_invalide")}</Text>}
          </>
        )}

        <Text style={S.label}>{t("pc_paiement_l")}</Text>
        <View style={S.ligneChips}>
          {moyens.map((p) => (
            <Chip
              key={p.cle}
              titre={t(p.libelle)}
              actif={demande.paiement === p.cle}
              onPress={() => { setManque([]); maj({ paiement: p.cle }); }}
            />
          ))}
        </View>

        {!!erreur && <Text style={S.erreur}>{erreur}</Text>}
        {manque.map((cle) => <Text style={S.erreur} key={cle}>{t(cle)}</Text>)}
        <View style={{ height: 8 }} />
        <Bouton titre={t("pc_confirmer")} onPress={confirmer} charge={envoi} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
