"use client";
import Link from "next/link";
import { useAsm } from "@/app/providers";

// Nous connaître : présentation, fonctionnement, gages de confiance
export default function Connaitre() {
  const { t } = useAsm();
  return (
    <div className="page">
      <div className="contenu-page">
        <h2 className="titre-page">{t("connaitre_t")}</h2>
        <p className="sous-page">{t("connaitre_s")}</p>
        <div className="bloc">
          <h3>{t("cm_t")}</h3>
          <div className="ligne-etape">
            <span className="num">1</span>
            <p>
              <strong>{t("cm1")}</strong>
              <span>{t("cm1d")}</span>
            </p>
          </div>
          <div className="ligne-etape">
            <span className="num">2</span>
            <p>
              <strong>{t("cm2")}</strong>
              <span>{t("cm2d")}</span>
            </p>
          </div>
          <div className="ligne-etape">
            <span className="num">3</span>
            <p>
              <strong>{t("cm3")}</strong>
              <span>{t("cm3d")}</span>
            </p>
          </div>
        </div>
        <div className="bloc">
          <h3>{t("conf_t")}</h3>
          <ul className="liste-atouts">
            <li>
              <strong>{t("conf1")}</strong>
              <span>{t("conf1d")}</span>
            </li>
            <li>
              <strong>{t("conf2")}</strong>
              <span>{t("conf2d")}</span>
            </li>
            <li>
              <strong>{t("conf3")}</strong>
              <span>{t("conf3d")}</span>
            </li>
            <li>
              <strong>{t("conf4")}</strong>
              <span>{t("conf4d")}</span>
            </li>
          </ul>
        </div>
        <Link className="btn-action" href="/accueil">
          {t("faire_demande")}
        </Link>
      </div>
    </div>
  );
}
