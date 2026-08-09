"use client";
import { useRouter } from "next/navigation";
import { useAsm } from "./providers";
import { IcoPersonne, IcoEtablissement } from "./components/icones";

// Démarrage : choix de l'espace (Patient / Professionnel) — fond vert
export default function Demarrage() {
  const { t, choisirEspace } = useAsm();
  const routeur = useRouter();

  const aller = (espace) => {
    choisirEspace(espace);
    routeur.push(espace === "pro" ? "/connexion" : "/accueil");
  };

  return (
    <div className="page page-demarrage">
      <div className="accueil-centre">
        <h1>{t("dem_t")}</h1>
        <p className="devise-amiri" dir="rtl" lang="ar">
          دائماً قريبون منكم
        </p>
        <p className="sous-dem">{t("dem_s")}</p>
        {/* L'écrasante majorité des visiteurs sont des patients : leur espace
            est le choix PRINCIPAL, mis en avant. L'espace professionnel reste
            présent, mais en second plan. */}
        <div className="grille-role" style={{ width: "100%", maxWidth: 440 }}>
          <button className="carte-role carte-role-vedette" onClick={() => aller("patient")}>
            <span className="ico-service">
              <IcoPersonne />
            </span>
            <span>
              <strong>{t("esp_patient")}</strong>
              <small>{t("esp_patient_d")}</small>
            </span>
          </button>
          <button className="carte-role carte-role-pro carte-role-discret" onClick={() => aller("pro")}>
            <span className="ico-service">
              <IcoEtablissement />
            </span>
            <span>
              <strong>{t("esp_pro")}</strong>
              <small>{t("esp_pro_d")}</small>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
