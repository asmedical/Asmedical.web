"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";
import { chargerMesDemandes } from "@/lib/supabase";
import { IcoPersonne, IcoTelephone } from "@/app/components/icones";

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

      <div className="info-appel" style={{ marginTop: 16 }}>
        <span>{t("suivi_besoin")}</span> <a href={TEL_LIEN}>{TEL_AFFICHE}</a>
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
