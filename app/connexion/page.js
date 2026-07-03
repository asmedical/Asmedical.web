"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";

function FormulaireConnexion() {
  const { t, espaceChoisi, serviceEnCours, seConnecter } = useAsm();
  const routeur = useRouter();
  const params = useSearchParams();
  const gate = params.get("gate") === "1";

  // Connexion simulée (MVP) — sera remplacée par téléphone + OTP.
  const valider = () => {
    const type = espaceChoisi === "pro" ? "pro" : "patient";
    seConnecter(type);
    if (type === "pro") routeur.push("/pro");
    else if (serviceEnCours) routeur.push("/rdv");
    else routeur.push("/tableau");
  };

  const sousTitre = gate
    ? t("connexion_s_gate")
    : espaceChoisi === "pro"
    ? t("connexion_s_pro")
    : t("connexion_s");

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 420 }}>
        <h2 className="titre-page">{t("connexion_t")}</h2>
        <p className="sous-page">{sousTitre}</p>
        <div className="champ">
          <label>{t("tel_l")}</label>
          <input type="tel" placeholder={t("tel_ph")} />
        </div>
        <div className="champ">
          <label>{t("mdp_l")}</label>
          <input type="password" placeholder="••••••" />
        </div>
        <button className="btn-action" onClick={valider}>
          {t("connexion_b")}
        </button>
        <p className="lien-bas">
          <span>{t("pas_compte")}</span>{" "}
          <Link href={espaceChoisi === "pro" ? "/inscription/pro" : "/role"}>{t("creer")}</Link>
        </p>
        <div className="info-appel">
          <span>{t("urgence")}</span> <a href={TEL_LIEN}>{TEL_AFFICHE}</a>
        </div>
      </div>
    </div>
  );
}

export default function Connexion() {
  return (
    <Suspense>
      <FormulaireConnexion />
    </Suspense>
  );
}
