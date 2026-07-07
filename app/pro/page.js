"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAsm } from "@/app/providers";
import { IcoVehicule, IcoMaison, IcoMedicaments } from "@/app/components/icones";

const ICONES = { transport: IcoVehicule, domicile: IcoMaison, medicaments: IcoMedicaments };
const CLE_SERVICE = { transport: "s_transport", domicile: "s_domicile", medicaments: "s_medic" };
const CLE_TRAJET = { simple: "tr_simple", accompagne: "tr_accomp", medicalise: "tr_medic" };

// Un rendez-vous est « passé » (→ historique) s'il est terminé, annulé,
// ou si sa date est dépassée. Sinon il est actif.
function estPasse(d, maintenant) {
  if (d.statut === "TERMINEE" || d.statut === "ANNULEE") return true;
  if (d.date && new Date(d.date).getTime() < maintenant) return true;
  return false;
}

function nomPatient(d) {
  return d.nom || d.telephone || "Patient";
}
function formatDate(d) {
  return d.date ? d.date.replace("T", " · ") : "—";
}
function libelleService(d, t) {
  const s = t(CLE_SERVICE[d.service] || "s_transport");
  return d.typeTrajet ? `${s} · ${t(CLE_TRAJET[d.typeTrajet] || "")}` : s;
}
function badgeStatut(d, t, maintenant) {
  if (d.statut === "TERMINEE") return { txt: t("st_terminee"), cls: "" };
  if (d.statut === "ANNULEE") return { txt: t("st_annulee"), cls: "" };
  if (d.statut === "CONFIRMEE") return { txt: t("st_confirmee"), cls: "verte" };
  if (d.statut === "AFFECTEE") return { txt: t("st_affectee"), cls: "verte" };
  if (d.date && new Date(d.date).getTime() < maintenant) return { txt: t("st_passe"), cls: "" };
  return { txt: t("st_a_rappeler"), cls: "" };
}

// Espace Professionnel (établissement) : rendez-vous actifs par défaut,
// historique des rendez-vous passés à la demande.
export default function EspacePro() {
  const { t } = useAsm();
  const [demandes, setDemandes] = useState(null);
  const [vue, setVue] = useState("actifs");
  const [ouvert, setOuvert] = useState(null);

  useEffect(() => {
    let annule = false;
    fetch("/api/demandes")
      .then((r) => (r.ok ? r.json() : []))
      .then((liste) => {
        // On ne garde que les demandes de l'espace établissement.
        // (L'isolement par établissement viendra avec la vraie connexion.)
        if (!annule) setDemandes(Array.isArray(liste) ? liste.filter((d) => d.espace === "pro") : []);
      })
      .catch(() => {
        if (!annule) setDemandes([]);
      });
    return () => {
      annule = true;
    };
  }, []);

  const maintenant = Date.now();
  const reels = demandes || [];
  const actifs = reels
    .filter((d) => !estPasse(d, maintenant))
    .sort((a, b) => {
      if (!a.date) return -1; // à programmer d'abord
      if (!b.date) return 1;
      return new Date(a.date) - new Date(b.date); // du plus proche au plus lointain
    });
  const historique = reels
    .filter((d) => estPasse(d, maintenant))
    .sort((a, b) => new Date(b.date || b.creeLe) - new Date(a.date || a.creeLe)); // récent → ancien

  return (
    <div className="page">
      <div className="contenu-page">
        <div className="bienvenue">
          <strong>{t("pro_bonjour")}</strong>
          <p>{t("pro_p")}</p>
        </div>
        <Link className="btn-action" href="/rdv">
          {t("pro_commander")}
        </Link>

        {/* Petit lien discret en haut à droite pour ouvrir l'historique */}
        <div className="barre-histo">
          <button
            className={"lien-histo" + (vue === "historique" ? " actif" : "")}
            onClick={() => {
              setVue(vue === "actifs" ? "historique" : "actifs");
              setOuvert(null);
            }}
          >
            {vue === "actifs" ? t("rdv_historique") : t("retour_actifs")}
          </button>
        </div>

        {demandes === null && <div className="vide">{t("pro_chargement")}</div>}

        {demandes !== null &&
          vue === "actifs" &&
          (actifs.length === 0 ? (
            <div className="vide">{t("aucun_actif")}</div>
          ) : (
            actifs.map((d) => {
              const Icone = ICONES[d.service] || IcoVehicule;
              const b = badgeStatut(d, t, maintenant);
              return (
                <Link
                  key={d.id}
                  className="item-liste carte-suivi-lien"
                  href="/suivi"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <span className="ico-service">
                    <Icone />
                  </span>
                  <span>
                    <strong>{nomPatient(d)}</strong>
                    <small>
                      {libelleService(d, t)} · {formatDate(d)}
                    </small>
                  </span>
                  <span className={"pastille " + b.cls}>{b.txt}</span>
                </Link>
              );
            })
          ))}

        {demandes !== null &&
          vue === "historique" &&
          (historique.length === 0 ? (
            <div className="vide">{t("aucun_historique")}</div>
          ) : (
            historique.map((d) => {
              const Icone = ICONES[d.service] || IcoVehicule;
              const b = badgeStatut(d, t, maintenant);
              const estOuvert = ouvert === d.id;
              return (
                <div className="item-histo" key={d.id}>
                  <button
                    className="item-liste"
                    onClick={() => setOuvert(estOuvert ? null : d.id)}
                    aria-expanded={estOuvert}
                  >
                    <span className="ico-service">
                      <Icone />
                    </span>
                    <span>
                      <strong>{nomPatient(d)}</strong>
                      <small>
                        {libelleService(d, t)} · {formatDate(d)}
                      </small>
                    </span>
                    <span className={"pastille " + b.cls}>{b.txt}</span>
                  </button>
                  {estOuvert && (
                    <div className="histo-detail">
                      {(d.depart || d.destination) && (
                        <p>
                          <strong>{t("detail_trajet")} :</strong> {d.depart || "?"} → {d.destination || "?"}
                        </p>
                      )}
                      <p>
                        <strong>{t("detail_date")} :</strong> {formatDate(d)}
                      </p>
                      {d.notes && (
                        <p>
                          <strong>{t("detail_notes")} :</strong> {d.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ))}

        <p className="lien-bas">
          <Link href="/admin">Accès équipe ASM →</Link>
        </p>
      </div>
    </div>
  );
}
