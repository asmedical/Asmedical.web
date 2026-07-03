"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";

// Inscription Établissement (simulée pour le MVP — vraie auth OTP à venir)
export default function InscriptionPro() {
  const { t, seConnecter } = useAsm();
  const routeur = useRouter();

  const creer = () => {
    seConnecter("pro");
    routeur.push("/pro");
  };

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 440 }}>
        <Link className="btn-retour" href="/role">
          {t("retour")}
        </Link>
        <h2 className="titre-page">{t("insc_pro_t")}</h2>
        <p className="sous-page">{t("insc_pro_s")}</p>
        <div className="champ">
          <label>{t("etab_l")}</label>
          <input type="text" placeholder={t("etab_ph")} />
        </div>
        <div className="champ">
          <label>{t("type_l")}</label>
          <select>
            <option>{t("type_hopital")}</option>
            <option>{t("type_clinique")}</option>
            <option>{t("type_labo")}</option>
            <option>{t("type_pharma")}</option>
            <option>{t("type_centre")}</option>
          </select>
        </div>
        <div className="champ">
          <label>{t("contact_l")}</label>
          <input type="text" placeholder={t("contact_ph")} />
        </div>
        <div className="champ">
          <label>{t("tel_l")}</label>
          <input type="tel" placeholder={t("tel_ph")} />
        </div>
        <button className="btn-action" onClick={creer}>
          {t("insc_pro_b")}
        </button>
        <p className="lien-bas">
          <span>{t("deja_compte")}</span> <Link href="/connexion">{t("connexion_b")}</Link>
        </p>
      </div>
    </div>
  );
}
