// Réservation — mêmes règles que le site : créneaux calculés en temps réel
// depuis les plannings des intervenants, fenêtres de livraison à capacité.
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView } from "react-native";
import { C, S } from "../theme";
import { Bouton, Chip, Charge, SERVICES_LIB } from "../ui";
import { useLangue } from "../i18n";
import { apiGet, apiPost } from "../api";
import { useAuth } from "../auth";
import ChampAdresse from "../ChampAdresse";

const FENETRES = [
  { id: "asap", fr: "au plus tôt" },
  { id: "matin", fr: "matin (8h–12h)" },
  { id: "midi", fr: "midi (12h–15h)" },
  { id: "soir", fr: "après-midi (15h–19h)" },
];

// Besoins particuliers — MÊME liste que le site (les clés brutes servent
// aussi au calcul des suppléments côté serveur).
const BESOINS = [
  "b_fauteuil", "b_oxygene", "b_marche", "b_alite", "b_accompagnateur",
  "b_infirmier", "b_age", "b_dialyse", "b_chimio", "b_postop", "b_enfant",
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
  // Espace d'origine : « pro » quand un établissement réserve au nom d'un
  // patient (le serveur applique alors sa propre logique de facturation).
  const espace = route.params?.espace === "pro" ? "pro" : "patient";
  const { t } = useLangue();
  const { profil, user } = useAuth();
  const livraison = service === "medicaments";

  const jours = useMemo(() => joursProchains(), []);
  const [jour, setJour] = useState(jours[0].iso);
  const [depart, setDepart] = useState("");
  const [destination, setDestination] = useState("");
  const [departLieu, setDepartLieu] = useState(null); // coordonnées choisies
  const [destLieu, setDestLieu] = useState(null);
  const [commune, setCommune] = useState(profil?.commune || "");
  const [typeTrajet, setTypeTrajet] = useState("aller_retour");
  const [notes, setNotes] = useState("");
  const [creneaux, setCreneaux] = useState(null);
  const [heure, setHeure] = useState("");
  const [fenetres, setFenetres] = useState(null);
  const [fenetre, setFenetre] = useState("asap");
  // Livraison : pharmacie souhaitée (facultatif — sinon la plus proche),
  // comme sur le site. Le patient garde le choix de SA pharmacie.
  const [pharmacie, setPharmacie] = useState("");
  // Transport urgent : pas de créneau à choisir, la demande passe en priorité.
  const [urgent, setUrgent] = useState(false);
  // Aide à domicile : préférence homme / femme pour l'intervenant.
  const [prefGenre, setPrefGenre] = useState("");
  // Précisions transmises à l'équipe (besoins, accès, proche à prévenir).
  const [besoins, setBesoins] = useState([]);
  const [acces, setAcces] = useState("");
  const [prevenirNom, setPrevenirNom] = useState("");
  const [prevenirTel, setPrevenirTel] = useState("");
  // Code promo / parrainage — validé CÔTÉ SERVEUR uniquement.
  const [codePromo, setCodePromo] = useState("");
  const [promoEtat, setPromoEtat] = useState(null); // {ok:true} | {erreur:"..."}
  // Réservation pour un proche autorisé, et packs forfaitaires.
  const [proches, setProches] = useState([]);
  const [pourPatient, setPourPatient] = useState(null);
  const [packs, setPacks] = useState([]);
  const [pack, setPack] = useState(null);
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

  // Proches autorisés du compte : on ne garde QUE les autorisations acceptées
  // et non expirées — même filtre que le site. Réserver au nom de quelqu'un
  // exige une autorisation valide, jamais une simple relation déclarée.
  useEffect(() => {
    apiGet("/api/proches")
      .then((d) => setProches((d?.proches || []).filter((p) => p.statut === "ACCEPTE" && !p.expiree)))
      .catch(() => {});
  }, []);

  // Packs forfaitaires proposés pour ce service.
  useEffect(() => {
    apiGet(`/api/packs?service=${encodeURIComponent(service)}`)
      .then((d) => setPacks(d?.packs || []))
      .catch(() => {});
  }, [service]);

  // Vérification du code promo : le serveur seul décide de sa validité.
  async function verifierPromo() {
    const code = codePromo.trim();
    if (!code) return;
    setPromoEtat(null);
    try {
      const d = await apiPost("/api/promo", {
        code,
        service,
        telephone: pourPatient?.tel || profil?.telephone || user?.phone || "",
      });
      setPromoEtat(d?.ok ? { ok: true } : { erreur: t("promo_invalide") });
    } catch (e) {
      const cle = { expire: "promo_expire", epuise: "promo_epuise" }[e?.data?.erreur];
      setPromoEtat({ erreur: t(cle || "promo_invalide") });
    }
  }

  // Précisions structurées — même format JSON que le site.
  function detailsStructures() {
    const d = {
      besoins: besoins.map((cle) => t(cle)),
      besoinsCles: besoins.length ? besoins : undefined,
      acces: acces.trim() || undefined,
      prevenirNom: prevenirNom.trim() || undefined,
      prevenirTel: prevenirTel.trim() || undefined,
    };
    const rempli = d.besoins.length || d.acces || d.prevenirNom || d.prevenirTel;
    return rempli ? JSON.stringify(d) : undefined;
  }

  // Prix estimé (mêmes règles que la facturation, remise du client incluse).
  useEffect(() => {
    let annule = false;
    setEstimation(null);
    if (livraison ? !fenetre : !urgent && !heure) return;
    const u = new URLSearchParams({ service, duree: "60" });
    u.set("date", `${jour}T${livraison ? "09:00" : heure || "09:00"}`);
    if (service === "transport") u.set("typeTrajet", typeTrajet);
    if (urgent) u.set("prioritaire", "1");
    if (pack?.id) u.set("pack", String(pack.id));
    if (besoins.length) u.set("besoins", besoins.join(","));
    apiGet(`/api/finances/estimation?${u.toString()}`)
      .then((d) => !annule && d?.disponible && setEstimation(d))
      .catch(() => {});
    return () => { annule = true; };
  }, [service, jour, heure, fenetre, typeTrajet, livraison, urgent, pack, besoins]);

  async function confirmer() {
    setErreur("");
    if (!livraison && !urgent && !heure) return;
    setOccupe(true);
    try {
      const corps = {
        service,
        // Réservation au nom d'un proche : c'est SON identité qui compte.
        nom: pourPatient
          ? pourPatient.nom
          : [profil?.prenom, profil?.nom].filter(Boolean).join(" ") || undefined,
        telephone: pourPatient?.tel || profil?.telephone || user?.phone || "",
        pourPatient: pourPatient?.tel || undefined,
        commune: commune.trim() || undefined,
        notes: notes.trim() || undefined,
        espace,
        sousMode: urgent ? "urgent" : livraison ? "fenetre" : "ponctuel",
        prefGenre: prefGenre || undefined,
        packId: pack?.id || undefined,
        codePromo: codePromo.trim() || undefined,
        details: detailsStructures(),
      };
      if (livraison) {
        corps.date = `${jour}T09:00`;
        corps.fenetre = FENETRES.find((f) => f.id === fenetre)?.fr;
        corps.pharmacie = pharmacie.trim() || undefined;
      } else {
        // Urgence : pas de créneau — le site envoie cette valeur littérale,
        // l'équipe rappelle immédiatement. On ne diverge pas.
        corps.date = urgent ? "au plus tôt" : `${jour}T${heure}`;
        corps.depart = depart.trim() || undefined;
        corps.destination = destination.trim() || undefined;
        // Coordonnées choisies (Google Places) → le serveur calcule distance,
        // itinéraire et prix au km, comme sur le site.
        if (departLieu?.lat != null) { corps.departLat = departLieu.lat; corps.departLng = departLieu.lng; }
        if (destLieu?.lat != null) { corps.destLat = destLieu.lat; corps.destLng = destLieu.lng; }
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

      {/* Bandeau : réservation au nom d'un proche */}
      {pourPatient && (
        <View style={[S.cartePale, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }]}>
          <Text style={{ flex: 1, color: C.encre, fontWeight: "700" }}>
            👤 {t("pp_bandeau")} {pourPatient.nom}
          </Text>
          <Text onPress={() => setPourPatient(null)} style={{ color: C.vert, fontWeight: "800" }}>{t("annuler")}</Text>
        </View>
      )}

      {/* Bandeau : pack forfaitaire choisi */}
      {pack && (
        <View style={[S.cartePale, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }]}>
          <Text style={{ flex: 1, color: C.encre, fontWeight: "700" }}>
            🎁 {t("pk_bandeau")} {pack.nom} — {pack.prix} DZD
          </Text>
          <Text onPress={() => setPack(null)} style={{ color: C.vert, fontWeight: "800" }}>{t("annuler")}</Text>
        </View>
      )}

      {/* Pour qui ? — uniquement les proches dûment autorisés */}
      {!pourPatient && proches.length > 0 && (
        <>
          <Text style={S.label}>{t("pr_pour_qui")}</Text>
          <View style={S.ligneChips}>
            <Chip titre={t("pr_moi")} actif onPress={() => setPourPatient(null)} />
            {proches.map((p) => (
              <Chip
                key={p.id}
                titre={`👤 ${p.patientNom || p.patientTel}`}
                actif={false}
                onPress={() => setPourPatient({ tel: p.patientTel, nom: p.patientNom || p.patientTel })}
              />
            ))}
          </View>
        </>
      )}

      {/* Packs forfaitaires proposés pour ce service */}
      {!pack && packs.length > 0 && (
        <>
          <Text style={S.label}>{t("pk_bandeau")}</Text>
          <View style={S.ligneChips}>
            {packs.map((p) => (
              <Chip key={p.id} titre={`${p.nom} — ${p.prix} DZD`} actif={false} onPress={() => setPack(p)} />
            ))}
          </View>
        </>
      )}

      {!livraison && (
        <>
          {service === "transport" && (
            <>
              <ChampAdresse
                label={t("depart_l")}
                valeur={depart}
                onChange={setDepart}
                onLieu={setDepartLieu}
                placeholder="Ex. domicile — Alger-Centre"
              />
              <ChampAdresse
                label={t("dest_l")}
                valeur={destination}
                onChange={setDestination}
                onLieu={setDestLieu}
                placeholder="Ex. CHU Mustapha"
              />
              <View style={S.ligneChips}>
                <Chip titre={t("aller_simple")} actif={typeTrajet === "aller_simple"} onPress={() => setTypeTrajet("aller_simple")} />
                <Chip titre={t("aller_retour")} actif={typeTrajet === "aller_retour"} onPress={() => setTypeTrajet("aller_retour")} />
              </View>
              {/* Urgence : la demande passe en priorité, sans créneau. */}
              <Text style={S.label}>{t("mode_l")}</Text>
              <View style={S.ligneChips}>
                <Chip titre={t("mode_ponctuel")} actif={!urgent} onPress={() => setUrgent(false)} />
                <Chip titre={t("mode_urgent")} actif={urgent} onPress={() => setUrgent(true)} />
              </View>
              {urgent && <Text style={S.sous}>{t("urgent_info")}</Text>}
            </>
          )}

          {/* Aide à domicile : préférence d'intervenant(e) */}
          {service === "domicile" && (
            <>
              <Text style={S.label}>{t("genre_l")}</Text>
              <View style={S.ligneChips}>
                <Chip titre={t("genre_indif")} actif={prefGenre === ""} onPress={() => setPrefGenre("")} />
                <Chip titre={t("genre_femme")} actif={prefGenre === "femme"} onPress={() => setPrefGenre("femme")} />
                <Chip titre={t("genre_homme")} actif={prefGenre === "homme"} onPress={() => setPrefGenre("homme")} />
              </View>
              <Text style={S.sous}>{t("genre_aide")}</Text>
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
          <Text style={S.label}>{t("pharmacie_l")}</Text>
          <TextInput
            style={S.champ}
            placeholder={t("pharmacie_ph")}
            placeholderTextColor={C.grisClair}
            value={pharmacie}
            onChangeText={setPharmacie}
          />
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
      ) : urgent ? null : (
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

      {/* ---- Précisions pour l'équipe (facultatif) ---- */}
      <Text style={[S.label, { marginTop: 14, fontSize: 15 }]}>{t("precisions_t")}</Text>
      <Text style={S.sous}>{t("precisions_s")}</Text>

      <Text style={S.label}>{t("besoins_t")}</Text>
      <View style={S.ligneChips}>
        {BESOINS.map((cle) => (
          <Chip
            key={cle}
            titre={t(cle)}
            actif={besoins.includes(cle)}
            onPress={() =>
              setBesoins((l) => (l.includes(cle) ? l.filter((x) => x !== cle) : [...l, cle]))
            }
          />
        ))}
      </View>

      <Text style={S.label}>{t("acces_l")}</Text>
      <TextInput style={S.champ} value={acces} onChangeText={setAcces}
                 placeholder={t("acces_ph")} placeholderTextColor={C.grisClair} />

      <Text style={S.label}>{t("prevenir_t")}</Text>
      <TextInput style={S.champ} value={prevenirNom} onChangeText={setPrevenirNom}
                 accessibilityLabel={t("prevenir_nom_l")}
                 placeholder={t("prevenir_nom_ph")} placeholderTextColor={C.grisClair} />
      <TextInput style={S.champ} value={prevenirTel} onChangeText={setPrevenirTel}
                 accessibilityLabel={t("prevenir_tel_l")} keyboardType="phone-pad"
                 placeholder={t("prevenir_tel_ph")} placeholderTextColor={C.grisClair} />

      {/* ---- Code promo / parrainage ---- */}
      <Text style={S.label}>{t("promo_l")}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          style={[S.champ, { flex: 1 }]}
          value={codePromo}
          autoCapitalize="characters"
          onChangeText={(v) => { setCodePromo(v.toUpperCase()); setPromoEtat(null); }}
          placeholder={t("promo_ph")}
          placeholderTextColor={C.grisClair}
        />
        <Chip titre={t("promo_verifier")} actif={false} onPress={verifierPromo} />
      </View>
      {promoEtat?.ok && <Text style={{ color: C.vertFonce, fontWeight: "700", marginBottom: 8 }}>{t("promo_ok")}</Text>}
      {promoEtat?.erreur && <Text style={S.erreur}>{promoEtat.erreur}</Text>}

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
        desactive={!livraison && !urgent && !heure}
      />
    </ScrollView>
  );
}
