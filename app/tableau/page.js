"use client";
import Link from "next/link";
import { useAsm } from "@/app/providers";
import { IcoVehicule, IcoMaison } from "@/app/components/icones";

// Tableau de bord patient : prochains rendez-vous
export default function Tableau() {
  const { t } = useAsm();
  return (
    <div className="page">
      <div className="contenu-page">
        <div className="bienvenue">
          <strong>{t("bonjour")}</strong>
          <p>{t("bienvenue_p")}</p>
        </div>
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
        <Link className="btn-action" style={{ marginTop: 8 }} href="/accueil">
          {t("nouvelle")}
        </Link>
      </div>
    </div>
  );
}
