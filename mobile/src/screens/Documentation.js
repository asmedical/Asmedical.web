// « Mes documents » — MÊME fonction que sur le site (app/documentation/page.js) :
// dépôt réel des bons CNAS, ordonnances… dans le bucket privé « documents »
// de Supabase, rattaché au patient par les règles RLS. Même table, mêmes
// limites, mêmes formats : un document déposé ici apparaît sur le site, et
// inversement.
import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Image, Modal, Alert, Linking, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { C, S } from "../theme";
import { Bouton, Charge } from "../ui";
import { useLangue } from "../i18n";
import { useAuth } from "../auth";
import { supabase } from "../supabase";
import { IcoDocumentLignes } from "../icones";

const MAX_OCTETS = 10 * 1024 * 1024; // 10 Mo — même plafond que le site
const FORMATS = ["application/pdf", "image/jpeg", "image/png"];

function tailleLisible(o) {
  if (!o) return "";
  if (o < 1024) return o + " o";
  if (o < 1024 * 1024) return Math.round(o / 1024) + " Ko";
  return (o / (1024 * 1024)).toFixed(1) + " Mo";
}

function nettoyerNom(nom) {
  return (nom || "document").replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

// crypto.randomUUID n'existe pas dans le moteur JS des téléphones : on
// fabrique un identifiant unique simple, le chemin étant déjà préfixé par
// l'identifiant du compte.
function identifiantUnique() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

// Le sélecteur ne renvoie pas toujours le type MIME : on le déduit alors du
// nom de fichier, sinon un PDF parfaitement valable serait refusé.
function typeFichier(nom, type) {
  if (FORMATS.includes(type)) return type;
  const n = (nom || "").toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  return type || "";
}

export default function Documentation() {
  const { t } = useLangue();
  const { user } = useAuth();

  const [documents, setDocuments] = useState(null); // null = chargement
  const [apercus, setApercus] = useState({}); // id -> URL signée
  const [feuille, setFeuille] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [rafraichit, setRafraichit] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const charger = useCallback(async () => {
    if (!supabase) {
      setErreur(t("err_app_config"));
      setDocuments([]);
      return;
    }
    const { data, error } = await supabase
      .from("document")
      .select("*")
      .order("cree_le", { ascending: false });
    if (error) {
      setErreur(t("err_upload"));
      setDocuments([]);
      return;
    }
    setDocuments(data || []);
    if (data && data.length) {
      const { data: urls } = await supabase.storage
        .from("documents")
        .createSignedUrls(data.map((d) => d.chemin), 3600);
      if (urls) {
        const map = {};
        data.forEach((d, i) => {
          if (urls[i] && urls[i].signedUrl) map[d.id] = urls[i].signedUrl;
        });
        setApercus(map);
      }
    }
  }, [t]);

  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  async function televerser({ uri, nom, type, taille }) {
    if (!user) return setErreur(t("err_app_config"));
    const mime = typeFichier(nom, type);
    if (!FORMATS.includes(mime)) return setErreur(t("err_format"));
    if (taille && taille > MAX_OCTETS) return setErreur(t("err_taille"));

    setEnvoi(true);
    setErreur("");
    setSucces("");
    try {
      const base64 = await new File(uri).base64();
      // Le sélecteur ne donne pas toujours la taille : on la recalcule à
      // partir du contenu pour ne pas laisser passer un fichier trop lourd.
      const octets = taille || Math.floor((base64.length * 3) / 4);
      if (octets > MAX_OCTETS) throw new Error(t("err_taille"));

      const chemin = `${user.id}/${identifiantUnique()}-${nettoyerNom(nom)}`;
      const { error: eUp } = await supabase.storage
        .from("documents")
        .upload(chemin, decode(base64), { contentType: mime, upsert: false });
      if (eUp) throw new Error(eUp.message || t("err_upload"));

      const { error: eMeta } = await supabase.from("document").insert({
        patient_id: user.id,
        nom: (nom || "document").slice(0, 120),
        type: mime,
        taille: octets,
        chemin,
      });
      if (eMeta) throw new Error(eMeta.message || t("err_upload"));

      try { await charger(); } catch {}
      setSucces(t("doc_envoye"));
      setTimeout(() => setSucces(""), 4000);
    } catch (e) {
      setErreur(e?.message || t("err_upload"));
    }
    setEnvoi(false);
  }

  // --- Les trois sources, comme sur le site : fichiers, photothèque, caméra.
  async function depuisFichiers() {
    setFeuille(false);
    const r = await DocumentPicker.getDocumentAsync({
      type: FORMATS,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (r.canceled) return;
    const a = r.assets?.[0];
    if (a) await televerser({ uri: a.uri, nom: a.name, type: a.mimeType, taille: a.size });
  }

  async function depuisPhototheque() {
    setFeuille(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setErreur(t("err_permission"));
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (r.canceled) return;
    const a = r.assets?.[0];
    if (a) {
      await televerser({
        uri: a.uri,
        nom: a.fileName || `photo-${identifiantUnique()}.jpg`,
        type: a.mimeType || "image/jpeg",
        taille: a.fileSize,
      });
    }
  }

  async function depuisCamera() {
    setFeuille(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setErreur(t("err_permission"));
    const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (r.canceled) return;
    const a = r.assets?.[0];
    if (a) {
      await televerser({
        uri: a.uri,
        nom: a.fileName || `photo-${identifiantUnique()}.jpg`,
        type: a.mimeType || "image/jpeg",
        taille: a.fileSize,
      });
    }
  }

  function ouvrir(d) {
    const url = apercus[d.id];
    if (url) Linking.openURL(url).catch(() => setErreur(t("err_upload")));
  }

  function demanderSuppression(d) {
    Alert.alert(t("doc_confirmer_suppr"), t("doc_confirmer_p"), [
      { text: t("annuler"), style: "cancel" },
      {
        text: t("oui_supprimer"),
        style: "destructive",
        onPress: async () => {
          try {
            await supabase.storage.from("documents").remove([d.chemin]);
            await supabase.from("document").delete().eq("id", d.id);
            await charger();
          } catch {
            setErreur(t("err_upload"));
          }
        },
      },
    ]);
  }

  const estImage = (type) => !!type && type.startsWith("image/");

  return (
    <View style={S.ecran}>
      <ScrollView
        contentContainerStyle={S.contenu}
        refreshControl={
          <RefreshControl
            refreshing={rafraichit}
            onRefresh={async () => { setRafraichit(true); await charger(); setRafraichit(false); }}
          />
        }
      >
        <Text style={S.h1}>{t("doc_t")}</Text>
        <Text style={S.sous}>{t("doc_s")}</Text>

        {documents === null && <Charge />}

        {(documents || []).map((d) => (
          <View
            key={d.id}
            style={[S.carte, { flexDirection: "row", alignItems: "center", marginBottom: 10 }]}
          >
            <View
              style={{
                width: 46, height: 46, borderRadius: 10, backgroundColor: C.vertPale,
                alignItems: "center", justifyContent: "center", overflow: "hidden", marginRight: 12,
              }}
            >
              {estImage(d.type) && apercus[d.id] ? (
                <Image source={{ uri: apercus[d.id] }} style={{ width: 46, height: 46 }} />
              ) : (
                <IcoDocumentLignes couleur={C.vertFonce} taille={22} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.encre, fontWeight: "700", fontSize: 15 }} numberOfLines={1}>
                {d.nom}
              </Text>
              <Text style={{ color: C.gris, fontSize: 12.5, marginTop: 2 }}>
                {estImage(d.type) ? "Image" : "PDF"}
                {d.taille ? ` · ${tailleLisible(d.taille)}` : ""}
                {d.cree_le ? ` · ${new Date(d.cree_le).toLocaleDateString("fr-FR")}` : ""}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => ouvrir(d)}
              accessibilityLabel={t("doc_ouvrir")}
              style={{ paddingHorizontal: 10, paddingVertical: 12 }}
            >
              <Text style={{ color: C.vert, fontWeight: "800" }}>{t("doc_ouvrir")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => demanderSuppression(d)}
              accessibilityLabel={t("doc_supprimer")}
              style={{ paddingHorizontal: 8, paddingVertical: 12 }}
            >
              <Text style={{ color: "#B03A3A", fontSize: 18 }}>🗑</Text>
            </TouchableOpacity>
          </View>
        ))}

        {documents !== null && documents.length === 0 && !erreur && (
          <Text style={S.vide}>{t("doc_vide")}</Text>
        )}

        {!!erreur && <Text style={S.erreur}>{erreur}</Text>}
        {!!succes && (
          <Text style={{ color: C.vertFonce, fontWeight: "800", marginTop: 10, textAlign: "center" }}>
            {succes}
          </Text>
        )}

        <View style={{ height: 14 }} />
        <Bouton
          titre={envoi ? t("doc_envoi") : t("doc_ajouter")}
          onPress={() => { setErreur(""); setFeuille(true); }}
          charge={envoi}
        />
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Feuille d'action — mêmes trois options que sur le site */}
      <Modal visible={feuille} transparent animationType="slide" onRequestClose={() => setFeuille(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setFeuille(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={{ backgroundColor: C.blanc, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 30 }}
          >
            <Text style={{ fontSize: 16, fontWeight: "800", color: C.encre, textAlign: "center", marginBottom: 14 }}>
              {t("sheet_titre")}
            </Text>
            {[
              [t("opt_fichiers"), depuisFichiers],
              [t("opt_photo"), depuisPhototheque],
              [t("opt_camera"), depuisCamera],
            ].map(([libelle, action]) => (
              <TouchableOpacity
                key={libelle}
                onPress={action}
                accessibilityRole="button"
                style={{ minHeight: 58, borderWidth: 1.5, borderColor: C.ligne, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 }}
              >
                <Text style={{ fontSize: 15.5, fontWeight: "700", color: C.encre }}>{libelle}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setFeuille(false)} style={{ minHeight: 52, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 15.5, fontWeight: "700", color: C.gris }}>{t("annuler")}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
