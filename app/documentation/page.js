"use client";
import { useEffect, useRef, useState } from "react";
import { useAsm } from "@/app/providers";
import { supabase, supabaseConfigured, assurerSession } from "@/lib/supabase";
import {
  IcoDocument,
  IcoDocumentLignes,
  IcoDossier,
  IcoPhoto,
  IcoCamera,
  IcoCorbeille,
  IcoOuvrir,
  IcoPlus,
} from "@/app/components/icones";

const MAX_OCTETS = 10 * 1024 * 1024; // 10 Mo
const FORMATS = ["application/pdf", "image/jpeg", "image/png"];

function tailleLisible(o) {
  if (o < 1024) return o + " o";
  if (o < 1024 * 1024) return Math.round(o / 1024) + " Ko";
  return (o / (1024 * 1024)).toFixed(1) + " Mo";
}
function nettoyerNom(nom) {
  return nom.replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

// Rubrique « Mes documents » : dépôt réel des bons CNAS, ordonnances…
// vers Supabase Storage (bucket privé), rattachés au patient (RLS).
export default function Documentation() {
  const { t } = useAsm();
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState(null); // null = chargement
  const [apercus, setApercus] = useState({}); // id -> URL signée
  const [sheet, setSheet] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [aSupprimer, setASupprimer] = useState(null);

  const refFichiers = useRef(null);
  const refPhoto = useRef(null);
  const refCamera = useRef(null);

  useEffect(() => {
    let annule = false;
    if (!supabaseConfigured) {
      setErreur(t("err_config"));
      setDocuments([]);
      return;
    }
    assurerSession()
      .then((u) => {
        if (annule) return;
        setUser(u);
        return charger();
      })
      .catch(() => {
        if (!annule) {
          setErreur(t("err_config"));
          setDocuments([]);
        }
      });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function charger() {
    const { data, error } = await supabase
      .from("document")
      .select("*")
      .order("cree_le", { ascending: false });
    if (error) {
      setErreur(t("err_config"));
      setDocuments([]);
      return;
    }
    setDocuments(data || []);
    // Aperçus (URL signées courtes) pour ouvrir et vignetter les images
    if (data && data.length) {
      const { data: urls } = await supabase.storage
        .from("documents")
        .createSignedUrls(
          data.map((d) => d.chemin),
          3600
        );
      if (urls) {
        const map = {};
        data.forEach((d, i) => {
          if (urls[i] && urls[i].signedUrl) map[d.id] = urls[i].signedUrl;
        });
        setApercus(map);
      }
    }
  }

  function choisir(ref) {
    setSheet(false);
    setErreur("");
    if (ref.current) ref.current.click();
  }

  async function surFichiers(e) {
    const fichiers = Array.from(e.target.files || []);
    e.target.value = ""; // permet de re-sélectionner le même fichier
    for (const f of fichiers) {
      if (!FORMATS.includes(f.type)) {
        setErreur(t("err_format"));
        continue;
      }
      if (f.size > MAX_OCTETS) {
        setErreur(t("err_taille"));
        continue;
      }
      await televerser(f);
    }
  }

  async function televerser(fichier) {
    if (!user) {
      setErreur(t("err_config"));
      return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      const chemin = `${user.id}/${crypto.randomUUID()}-${nettoyerNom(fichier.name)}`;
      const { error: eUp } = await supabase.storage
        .from("documents")
        .upload(chemin, fichier, { contentType: fichier.type, upsert: false });
      if (eUp) throw new Error("Stockage : " + (eUp.message || "erreur inconnue"));
      const { error: eMeta } = await supabase.from("document").insert({
        patient_id: user.id,
        nom: fichier.name.slice(0, 120),
        type: fichier.type,
        taille: fichier.size,
        chemin,
      });
      if (eMeta) throw new Error("Base : " + (eMeta.message || "erreur inconnue"));
      await charger();
    } catch (e) {
      setErreur(e && e.message ? e.message : t("err_upload"));
    } finally {
      setEnvoi(false);
    }
  }

  async function confirmerSuppression() {
    const doc = aSupprimer;
    setASupprimer(null);
    if (!doc) return;
    try {
      await supabase.storage.from("documents").remove([doc.chemin]);
      await supabase.from("document").delete().eq("id", doc.id);
      await charger();
    } catch {
      setErreur(t("err_upload"));
    }
  }

  function ouvrir(doc) {
    const url = apercus[doc.id];
    if (url) window.open(url, "_blank", "noopener");
  }

  const estImage = (type) => type && type.startsWith("image/");

  return (
    <div className="page">
      <div className="contenu-page">
        <h2 className="titre-page">{t("doc_t")}</h2>
        <p className="sous-page">{t("doc_s")}</p>

        {documents === null && <div className="vide">{t("doc_chargement")}</div>}

        {documents !== null &&
          documents.map((d) => (
            <div className="doc-carte" key={d.id}>
              <span className="doc-vignette">
                {estImage(d.type) && apercus[d.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={apercus[d.id]} alt="" />
                ) : (
                  <IcoDocumentLignes />
                )}
              </span>
              <span className="doc-infos">
                <strong>{d.nom}</strong>
                <small>
                  {estImage(d.type) ? "Image" : "PDF"} · {tailleLisible(d.taille)} ·{" "}
                  {new Date(d.cree_le).toLocaleDateString("fr-FR")}
                </small>
              </span>
              <span className="doc-actions">
                <button onClick={() => ouvrir(d)} aria-label={t("doc_ouvrir")} title={t("doc_ouvrir")}>
                  <IcoOuvrir />
                </button>
                <button
                  className="suppr"
                  onClick={() => setASupprimer(d)}
                  aria-label={t("doc_supprimer")}
                  title={t("doc_supprimer")}
                >
                  <IcoCorbeille />
                </button>
              </span>
            </div>
          ))}

        {documents !== null && documents.length === 0 && !erreur && (
          <div className="vide">{t("doc_vide")}</div>
        )}

        {erreur && <p className="erreur">{erreur}</p>}

        <button className="btn-action" onClick={() => setSheet(true)} disabled={envoi}>
          {envoi ? t("doc_envoi") : t("doc_ajouter")}
        </button>

        {/* Sélecteurs natifs cachés */}
        <input
          ref={refFichiers}
          type="file"
          accept="application/pdf,image/*"
          multiple
          hidden
          onChange={surFichiers}
        />
        <input ref={refPhoto} type="file" accept="image/*" multiple hidden onChange={surFichiers} />
        <input
          ref={refCamera}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={surFichiers}
        />
      </div>

      {/* Feuille d'action (glisse du bas) */}
      {sheet && (
        <div className="sheet-fond" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-titre">{t("sheet_titre")}</div>
            <button className="sheet-opt" onClick={() => choisir(refFichiers)}>
              <IcoDossier /> <span>{t("opt_fichiers")}</span>
            </button>
            <button className="sheet-opt" onClick={() => choisir(refPhoto)}>
              <IcoPhoto /> <span>{t("opt_photo")}</span>
            </button>
            <button className="sheet-opt" onClick={() => choisir(refCamera)}>
              <IcoCamera /> <span>{t("opt_camera")}</span>
            </button>
            <button className="sheet-annuler" onClick={() => setSheet(false)}>
              {t("annuler")}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation de suppression */}
      {aSupprimer && (
        <div className="sheet-fond" onClick={() => setASupprimer(null)}>
          <div className="modale" onClick={(e) => e.stopPropagation()}>
            <div className="modale-ico">
              <IcoCorbeille />
            </div>
            <strong>{t("doc_confirmer_suppr")}</strong>
            <p>{t("doc_confirmer_p")}</p>
            <button className="btn-danger" onClick={confirmerSuppression}>
              {t("oui_supprimer")}
            </button>
            <button className="btn-secondaire" onClick={() => setASupprimer(null)}>
              {t("annuler")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
