"use client";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAsm } from "@/app/providers";
import { estRecurrent, validerEtape, etapeSuivante, dureePour } from "@/lib/parcours";
import { Stepper, useParcours, useStructure, libelleType } from "@/app/components/parcours";

// Étape 1 — une seule question à l'écran : de quoi avez-vous besoin ?
// L'ancien formulaire empilait tout sur une page ; ici chaque étape ne pose
// qu'une question, ce qui reste tenable pour une personne âgée sur un
// téléphone.
//
// Pour le domicile, les prestations proposées sont celles configurées en
// back-office, avec leur durée : c'est elle qui fixe la longueur du créneau
// réservé — une injection de vingt minutes ne doit pas bloquer une heure de
// soignant.
export default function EtapeBesoin() {
  const { t, langue } = useAsm();
  const routeur = useRouter();
  const { service } = useParams();
  const [d, maj] = useParcours();
  const { structure, pret } = useStructure();

  const types = structure.types?.[service] || [];
  if (pret && !types.length) {
    return (
      <div className="page">
        <div className="contenu-page">
          <p className="sous-page">{t("pc_err_service")}</p>
          <Link className="btn-action" href="/reserver">{t("pc_retour")}</Link>
        </div>
      </div>
    );
  }

  function choisir(ty) {
    const type = ty.cle;
    maj({ service, type, duree: dureePour(structure, service, type) });
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
        <Stepper etape="besoin" demande={d} />

        <div className="pc-choix">
          {types.map((ty) => (
            <button
              className={"pc-carte" + (d?.type === ty.cle ? " actif" : "")}
              key={ty.cle}
              onClick={() => choisir(ty)}
            >
              <span>
                <strong>{libelleType(ty, t, langue)}</strong>
                {/* La durée est annoncée avant de choisir : elle change le
                    créneau réservé et le montant facturé. */}
                {ty.duree ? <small>≈ {ty.duree} {t("duree_min")}</small> : null}
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
