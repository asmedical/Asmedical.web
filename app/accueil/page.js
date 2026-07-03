"use client";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { IcoVehicule, IcoMaison, IcoMedicaments } from "@/app/components/icones";

// Accueil patient : choix du service.
// Le compte est obligatoire pour réserver : sans connexion → écran de connexion.
export default function Accueil() {
  const { t, connecte, choisirService } = useAsm();
  const routeur = useRouter();

  const choisir = (service) => {
    choisirService(service);
    routeur.push(connecte ? "/rdv" : "/connexion?gate=1");
  };

  return (
    <div className="page">
      <div className="accueil-centre">
        <h1>{t("besoin")}</h1>
        <div className="carte">
          <div className="choix">
            <button onClick={() => choisir("transport")}>
              <span className="ico-service" aria-hidden="true">
                <IcoVehicule />
              </span>
              <span>
                <strong>{t("s_transport")}</strong>
                <small>{t("s_transport_d")}</small>
              </span>
            </button>
            <button onClick={() => choisir("domicile")}>
              <span className="ico-service" aria-hidden="true">
                <IcoMaison />
              </span>
              <span>
                <strong>{t("s_domicile")}</strong>
                <small>{t("s_domicile_d")}</small>
              </span>
            </button>
            <button onClick={() => choisir("medicaments")}>
              <span className="ico-service" aria-hidden="true">
                <IcoMedicaments />
              </span>
              <span>
                <strong>{t("s_medic")}</strong>
                <small>{t("s_medic_d")}</small>
              </span>
            </button>
          </div>
        </div>
        <p className="rassurance">{t("rassurance")}</p>
      </div>
    </div>
  );
}
