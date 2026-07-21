"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";
import ChoixAppel from "@/app/components/appel";
import { chargerMesDemandes, supabase } from "@/lib/supabase";
import { IcoPersonne, IcoTelephone } from "@/app/components/icones";

// Bloc d'avis : le patient note son intervention terminée (une seule fois).
function BlocAvis({ demande, t }) {
  const [note, setNote] = useState(0);
  const [survol, setSurvol] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [etat, setEtat] = useState(demande.avis ? "fait" : "form"); // form | envoi | fait | erreur
  const avis = demande.avis;

  async function envoyer() {
    if (note < 1) return;
    setEtat("envoi");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/avis", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ demandeId: demande.id, note, commentaire: commentaire.trim() }),
      });
      if (!r.ok) throw new Error();
      setEtat("fait");
    } catch {
      setEtat("erreur");
    }
  }

  if (etat === "fait" || avis) {
    const n = avis?.note ?? note;
    return (
      <div className="avis-bloc">
        <strong>{t("avis_merci")}</strong>
        <div className="avis-etoiles lecture" aria-label={`${n}/5`}>
          {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= n ? "on" : ""}>★</span>)}
        </div>
        {avis?.commentaire && <p className="avis-comment">« {avis.commentaire} »</p>}
      </div>
    );
  }

  return (
    <div className="avis-bloc">
      <strong>{t("avis_titre")}</strong>
      <div className="avis-etoiles" role="radiogroup" aria-label={t("avis_titre")}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            className={(survol || note) >= i ? "on" : ""}
            onMouseEnter={() => setSurvol(i)}
            onMouseLeave={() => setSurvol(0)}
            onClick={() => setNote(i)}
            aria-label={`${i} / 5`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className="avis-comment-input"
        rows={2}
        placeholder={t("avis_ph")}
        value={commentaire}
        onChange={(e) => setCommentaire(e.target.value)}
        maxLength={600}
      />
      {etat === "erreur" && <p className="erreur">{t("avis_err")}</p>}
      <button className="btn-action" onClick={envoyer} disabled={note < 1 || etat === "envoi"}>
        {etat === "envoi" ? t("envoi") : t("avis_envoyer")}
      </button>
    </div>
  );
}

// Étapes réelles du suivi (mappées sur le statut de la demande).
const ETAPES = [
  { statut: "A_RAPPELER", cle: "suivi_recue" },
  { statut: "CONFIRMEE", cle: "suivi_confirmee" },
  { statut: "AFFECTEE", cle: "suivi_affectee" },
  { statut: "EN_COURS", cle: "suivi_encours" },
  { statut: "TERMINEE", cle: "suivi_terminee" },
];
const INDEX = { A_RAPPELER: 0, CONFIRMEE: 1, AFFECTEE: 2, EN_COURS: 3, TERMINEE: 4 };

// État « en direct » déduit du terrain (horodatages posés par l'intervenant).
// Retourne { cle, actif } — actif = étape en mouvement (halo pulsé).
function etatLive(d) {
  if (d.finLe || d.statut === "TERMINEE") return { cle: "live_terminee", actif: false };
  if (d.debutLe || d.statut === "EN_COURS") return { cle: "live_encours", actif: true };
  if (d.arriveeLe) return { cle: "live_arrive", actif: true };
  if (d.enRouteLe) return { cle: "live_enroute", actif: true };
  if (d.accepteeLe || d.statut === "CONFIRMEE") return { cle: "live_confirmee", actif: false };
  if (d.soignant || d.transporteur || d.chauffeur || d.statut === "AFFECTEE") return { cle: "live_assignee", actif: false };
  return { cle: "live_recue", actif: false };
}

function SuiviContenu() {
  const { t, connecte, compteType } = useAsm();
  const params = useSearchParams();
  const idVoulu = params.get("id");
  const retourVers = connecte && compteType === "pro" ? "/pro" : "/tableau";

  const [demande, setDemande] = useState(undefined); // undefined = chargement

  useEffect(() => {
    let annule = false;
    const recharger = () =>
      chargerMesDemandes()
        .then((liste) => {
          if (annule) return;
          if (!liste.length) return setDemande(null);
          const trouve = idVoulu ? liste.find((d) => String(d.id) === String(idVoulu)) : null;
          const active = liste.find((d) => !["TERMINEE", "ANNULEE"].includes(d.statut));
          setDemande(trouve || active || liste[0]);
        })
        .catch(() => !annule && setDemande(null));
    recharger();
    // Rafraîchissement automatique pour un suivi vraiment « en direct ».
    const minuteur = setInterval(recharger, 30000);
    return () => {
      annule = true;
      clearInterval(minuteur);
    };
  }, [idVoulu]);

  return (
    <div className="page">
      <div className="contenu-page">
        <Link className="btn-retour" href={retourVers}>
          {t("retour")}
        </Link>
        <h2 className="titre-page">{t("suivi_t")}</h2>
        <p className="sous-page">{t("suivi_s")}</p>

        {demande === undefined && <p className="sous-page">{t("compte_charge")}</p>}

        {demande === null && (
          <div className="etat-vide">
            <p>{t("suivi_aucune")}</p>
            <Link className="btn-action" style={{ marginTop: 14 }} href="/accueil">
              {t("nouvelle")}
            </Link>
          </div>
        )}

        {demande && <FicheSuivi demande={demande} t={t} />}
      </div>
    </div>
  );
}

// Signalement d'un problème sur la prestation — note interne + alerte équipe.
function BlocSignalement({ demande, t }) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [etat, setEtat] = useState(""); // "" | envoi | ok | erreur
  if (etat === "ok") return <p className="suivi-info" style={{ color: "var(--vert-fonce)", fontWeight: 700 }}>{t("sig_ok")}</p>;
  if (!ouvert) {
    return (
      <p className="lien-bas" style={{ textAlign: "start", marginTop: 10 }}>
        <a onClick={() => setOuvert(true)}>⚠ {t("sig_b")}</a>
      </p>
    );
  }
  async function envoyer() {
    setEtat("envoi");
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/signalement", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ demandeId: demande.id, texte: texte.trim() }),
      });
      if (!r.ok) throw new Error();
      setEtat("ok");
    } catch {
      setEtat("erreur");
    }
  }
  return (
    <div className="champ" style={{ marginTop: 10 }}>
      <label>{t("sig_l")}</label>
      <textarea rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={t("sig_ph")} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn-action" style={{ padding: "10px 16px" }} onClick={envoyer} disabled={texte.trim().length < 5 || etat === "envoi"}>
          {etat === "envoi" ? t("otp_envoi") : t("sig_envoyer")}
        </button>
        <button className="fin-lien" onClick={() => setOuvert(false)}>{t("annuler")}</button>
      </div>
      {etat === "erreur" && <p className="erreur">{t("sig_err")}</p>}
    </div>
  );
}

function FicheSuivi({ demande, t }) {
  const annulee = demande.statut === "ANNULEE";
  const etapeActive = INDEX[demande.statut] ?? 0;
  const intervenant = demande.soignant
    ? { nom: `${demande.soignant.prenom} ${demande.soignant.nom}`, tel: demande.soignant.telephone, photo: demande.soignant.photoUrl }
    : demande.transporteur
    ? { nom: demande.transporteur.nom, tel: demande.transporteur.telephone, photo: demande.transporteur.photoUrl }
    : demande.chauffeur
    ? { nom: demande.chauffeur, tel: null, photo: null }
    : null;

  const cleService = "s_" + (demande.service === "medicaments" ? "medic" : demande.service);

  return (
    <div className="suivi-carte">
      <div className="suivi-entete">
        <strong>
          n°{demande.id} · {t(cleService)}
        </strong>
        <small>
          {demande.date ? demande.date.replace("T", " · ") : "—"}
          {demande.destination ? ` · ${demande.destination}` : ""}
        </small>
      </div>

      {!annulee && (() => {
        const live = etatLive(demande);
        return (
          <div className={"suivi-live" + (live.actif ? " actif" : "")}>
            <span className="suivi-live-pastille" aria-hidden="true" />
            <span>{t(live.cle)}</span>
          </div>
        );
      })()}

      {annulee ? (
        <p className="suivi-annulee">{t("st_annulee")}</p>
      ) : (
        <ul className="etapes-suivi">
          {ETAPES.map((e, i) => (
            <li key={e.cle} className={i < etapeActive ? "faite" : i === etapeActive ? "active" : ""}>
              {t(e.cle)}
            </li>
          ))}
        </ul>
      )}

      {intervenant ? (
        <div className="suivi-chauffeur">
          {intervenant.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar-ch photo" src={intervenant.photo} alt={intervenant.nom} />
          ) : (
            <span className="avatar-ch">
              <IcoPersonne />
            </span>
          )}
          <span>
            <strong>{intervenant.nom}</strong>
            <small>{t("suivi_intervenant")}</small>
          </span>
          {intervenant.tel && (
            <a className="btn-appel-rond" href={`tel:${intervenant.tel}`} aria-label={t("suivi_intervenant")}>
              <IcoTelephone />
            </a>
          )}
        </div>
      ) : (
        !annulee && <p className="suivi-info">{t("suivi_pas_affecte")}</p>
      )}

      {/* Véhicule du transporteur : le patient sait quoi attendre. */}
      {demande.transporteur && (demande.transporteur.vehicule || demande.transporteur.vehiculeImmat) && (
        <div className="suivi-vehicule">
          <span className="suivi-veh-ico" aria-hidden="true">🚐</span>
          <span className="suivi-veh-txt">
            <strong>{[demande.transporteur.vehicule, demande.transporteur.vehiculeCouleur].filter(Boolean).join(" · ") || t("suivi_vehicule")}</strong>
            <small>{t("suivi_vehicule")}</small>
          </span>
          {demande.transporteur.vehiculeImmat && (
            <span className="suivi-plaque" dir="ltr">{demande.transporteur.vehiculeImmat}</span>
          )}
        </div>
      )}

      {(demande.statut === "TERMINEE" || demande.avis) && <BlocAvis demande={demande} t={t} />}

      {!annulee && <BlocSignalement demande={demande} t={t} />}

      <div className="info-appel" style={{ marginTop: 16 }}>
        <span>{t("suivi_besoin")}</span> <ChoixAppel />
      </div>
    </div>
  );
}

export default function Suivi() {
  return (
    <Suspense>
      <SuiviContenu />
    </Suspense>
  );
}
