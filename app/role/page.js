"use client";
import Link from "next/link";
import { useAsm } from "@/app/providers";
import { IcoPersonne, IcoEtablissement } from "@/app/components/icones";

// Choix du rôle à la création de compte
export default function ChoixRole() {
  const { t } = useAsm();
  return (
    <div className="page">
      <div className="contenu-page">
        <Link className="btn-retour" href="/connexion">
          {t("retour")}
        </Link>
        <h2 className="titre-page">{t("role_t")}</h2>
        <p className="sous-page">{t("role_s")}</p>
        <div className="grille-role">
          <Link className="carte-role" href="/inscription/patient">
            <span className="ico-service">
              <IcoPersonne />
            </span>
            <span>
              <strong>{t("role_patient")}</strong>
              <small>{t("role_patient_d")}</small>
            </span>
          </Link>
          <Link className="carte-role" href="/inscription/pro">
            <span className="ico-service">
              <IcoEtablissement />
            </span>
            <span>
              <strong>{t("role_pro")}</strong>
              <small>{t("role_pro_d")}</small>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
