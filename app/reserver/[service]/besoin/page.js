"use client";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAsm } from "@/app/providers";
import { TYPES, estRecurrent, validerEtape, etapeSuivante } from "@/lib/parcours";
import { Stepper, useParcours } from "@/app/components/parcours";

// Étape 1 — une seule question à l'écran : de quoi avez-vous besoin ?
// L'ancien formulaire empilait tout sur une page ; ici chaque étape ne pose
// qu'une question, ce qui reste tenable pour une personne âgée sur un
// téléphone.
export default function EtapeBesoin() {
  const { t } = useAsm();
  const routeur = useRouter();
  const { service } = useParams();
  const [d, maj] = useParcours();

  const types = TYPES[service] || [];
  if (!types.length) {
    return (
      <div className="page">
        <div className="contenu-page">
          <p className="sous-page">{t("pc_err_service")}</p>
          <Link className="btn-action" href="/reserver">{t("pc_retour")}</Link>
        </div>
      </div>
    );
  }

  function choisir(type) {
    maj({ service, type });
    // Dialyse, chimiothérapie : besoin régulier. On n'affiche jamais de
    // créneaux temps réel pour un abonnement — la régulation confirme
    // humainement et rappelle sous trente minutes.
    if (estRecurrent(service, type)) {
      routeur.push(`/reserver/${service}/abonnement`);
      return;
    }
    if (!validerEtape("besoin", { service, type }).length) {
      routeur.push(`/reserver/${service}/${etapeSuivante("besoin")}`);
    }
  }

  return (
    <div className="page">
      <div className="contenu-page">
        <Link className="btn-retour" href="/reserver">{t("pc_retour")}</Link>
        <h2 className="titre-page">{t("pc_besoin_q")}</h2>
        <Stepper etape="besoin" />

        <div className="pc-choix">
          {types.map((ty) => (
            <button
              className={"pc-carte" + (d?.type === ty.cle ? " actif" : "")}
              key={ty.cle}
              onClick={() => choisir(ty.cle)}
            >
              <span>
                <strong>{t(ty.libelle)}</strong>
              </span>
            </button>
          ))}
        </div>

        {/* L'urgence n'est plus une case à cocher : c'est un lien discret vers
            un écran qui dit la vérité sur ce qu'ASM peut faire. */}
        <Link className="pc-urgent" href={`/reserver/${service}/urgence`}>
          {t("pc_urgent_lien")}
        </Link>
      </div>
    </div>
  );
}
