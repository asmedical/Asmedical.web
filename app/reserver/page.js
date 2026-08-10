"use client";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { ecrireParcours, viderParcours } from "@/app/components/parcours";
import { IcoVehicule, IcoMaison, IcoMedicaments } from "@/app/components/icones";

// Point d'entrée du parcours : on choisit d'abord la prestation, car c'est
// elle qui détermine tout le reste — types de demande, champs de l'étape 2,
// créneaux ou fenêtres de livraison.
const SERVICES = [
  { cle: "transport", Ico: IcoVehicule, titre: "s_transport", detail: "s_transport_d" },
  { cle: "domicile", Ico: IcoMaison, titre: "s_domicile", detail: "s_domicile_d" },
  { cle: "medicaments", Ico: IcoMedicaments, titre: "s_medic", detail: "s_medic_d" },
];

export default function ChoixService() {
  const { t } = useAsm();
  const routeur = useRouter();

  function choisir(service) {
    // Nouvelle demande : on repart d'une feuille blanche, sinon les
    // réponses d'une demande précédente se glisseraient dans celle-ci.
    viderParcours();
    ecrireParcours({ service });
    routeur.push(`/reserver/${service}/besoin`);
  }

  return (
    <div className="page">
      <div className="contenu-page">
        <h2 className="titre-page">{t("accueil_q")}</h2>

        <div className="pc-choix">
          {SERVICES.map((s) => (
            <button className="pc-carte" key={s.cle} onClick={() => choisir(s.cle)}>
              <span className="ico-service" aria-hidden="true">
                <s.Ico />
              </span>
              <span>
                <strong>{t(s.titre)}</strong>
                <small>{t(s.detail)}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
