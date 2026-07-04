"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAsm } from "@/app/providers";
import { IcoVehicule, IcoMaison, IcoMedicaments } from "@/app/components/icones";

const ICONES = {
  transport: IcoVehicule,
  domicile: IcoMaison,
  medicaments: IcoMedicaments,
};
const CLES_SERVICE = {
  transport: "s_transport",
  domicile: "s_domicile",
  medicaments: "s_medic",
};

// Tableau de bord patient : demandes envoyées depuis cet appareil,
// puis exemples de la maquette tant qu'il n'y en a aucune.
export default function Tableau() {
  const { t } = useAsm();
  const [demandes, setDemandes] = useState([]);

  useEffect(() => {
    try {
      setDemandes(JSON.parse(localStorage.getItem("asm_demandes") || "[]"));
    } catch {}
  }, []);

  return (
    <div className="page">
      <div className="contenu-page">
        <div className="bienvenue">
          <strong>{t("bonjour")}</strong>
          <p>{t("bienvenue_p")}</p>
        </div>

        {demandes.map((d, i) => {
          const Icone = ICONES[d.service] || IcoVehicule;
          return (
            <Link
              className="item-liste"
              href="/suivi"
              key={i}
              style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}
            >
              <span className="ico-service">
                <Icone />
              </span>
              <span>
                <strong>{t(CLES_SERVICE[d.service] || "s_transport")}</strong>
                <small>
                  {d.date ? d.date.replace("T", " · ") : "—"}
                  {d.destination ? ` · ${d.destination}` : ""}
                </small>
              </span>
              <span className="pastille">{t("attente")}</span>
            </Link>
          );
        })}

        {demandes.length === 0 && (
          <>
            <Link
              className="item-liste carte-suivi-lien"
              href="/suivi"
              style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}
            >
              <span className="ico-service">
                <IcoVehicule />
              </span>
              <span>
                <strong>{t("rdv_dialyse")}</strong>
                <small>{t("rdv_dialyse_d")}</small>
              </span>
              <span className="pastille verte">{t("suivre_court")}</span>
            </Link>
            <div className="item-liste">
              <span className="ico-service">
                <IcoMaison />
              </span>
              <span>
                <strong>{t("s_domicile")}</strong>
                <small>{t("rdv_dom_d")}</small>
              </span>
              <span className="pastille">{t("attente")}</span>
            </div>
          </>
        )}

        <Link className="btn-action" style={{ marginTop: 8 }} href="/accueil">
          {t("nouvelle")}
        </Link>
      </div>
    </div>
  );
}
