"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { IcoVehicule, IcoMaison, IcoMedicaments } from "@/app/components/icones";
import PourQui from "@/app/components/pourqui";
import { ecrireParcours, viderParcours } from "@/app/components/parcours";

// Accueil patient : choix du service, puis parcours guidé par étapes.
// Le compte est obligatoire pour réserver : sans connexion → écran de connexion.
export default function Accueil() {
  const { t, connecte, choisirService } = useAsm();
  const routeur = useRouter();

  const choisir = (service) => {
    choisirService(service);
    // Le patient éventuellement choisi par PourQui est déjà dans l'état du
    // parcours : on ajoute le service sans écraser le reste. Le ménage se
    // fait à l'arrivée sur l'accueil, pas ici.
    ecrireParcours({ service });
    routeur.push(connecte ? `/reserver/${service}/besoin` : "/connexion?gate=1");
  };

  // Nouvelle demande : on repart d'une feuille blanche à chaque passage par
  // l'accueil. Le vidage a lieu PENDANT le premier rendu, pas dans un effet :
  // les effets des enfants s'exécutent avant ceux du parent, et PourQui écrit
  // le patient choisi dès son premier effet — un vidage tardif l'effacerait.
  useState(() => viderParcours());

  return (
    <div className="page">
      <div className="accueil-centre">
        <h1>{t("besoin")}</h1>
        <PourQui />
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
