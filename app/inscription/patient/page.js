"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";

// Inscription Patient (simulée pour le MVP — vraie auth OTP à venir)
export default function InscriptionPatient() {
  const { t, serviceEnCours, seConnecter } = useAsm();
  const routeur = useRouter();

  const creer = () => {
    seConnecter("patient");
    routeur.push(serviceEnCours ? "/rdv" : "/tableau");
  };

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 440 }}>
        <Link className="btn-retour" href="/role">
          {t("retour")}
        </Link>
        <h2 className="titre-page">{t("insc_pat_t")}</h2>
        <p className="sous-page">{t("insc_pat_s")}</p>
        <div className="champ">
          <label>{t("nom_l")}</label>
          <input type="text" placeholder={t("nom_ph")} />
        </div>
        <div className="champ">
          <label>{t("tel_l")}</label>
          <input type="tel" placeholder={t("tel_ph")} />
        </div>
        <div className="champ">
          <label>{t("ville_l")}</label>
          <input type="text" placeholder={t("ville_ph")} />
        </div>
        <div className="champ">
          <label>{t("mdp_l")}</label>
          <input type="password" placeholder="••••••" />
        </div>
        <button className="btn-action" onClick={creer}>
          {t("insc_pat_b")}
        </button>
        <p className="lien-bas">
          <span>{t("deja_compte")}</span> <Link href="/connexion">{t("connexion_b")}</Link>
        </p>
      </div>
    </div>
  );
}
