"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";
import { useParcours } from "@/app/components/parcours";

// « C'est urgent ? » — écran interstitiel.
//
// Il remplace la case « urgent » du formulaire. ASM organise des transports
// PROGRAMMÉS : laisser cocher une case laissait croire à une prise en charge
// immédiate. Devant une urgence vitale, la bonne action n'est pas de remplir
// un formulaire, c'est d'appeler les secours — d'où les numéros en premier,
// en grand, et cliquables.
//
// Mais tout ce qui presse n'est pas vital. Pour ces cas-là, la demande
// continue en mode « au plus tôt » : elle part sans créneau, la régulation
// cale l'heure et rappelle. Sans cette sortie, l'écran serait une impasse
// pour quiconque n'a pas besoin du SAMU.
export default function Urgence() {
  const { t } = useAsm();
  const routeur = useRouter();
  const { service } = useParams();
  const [, maj] = useParcours();

  function continuerAuPlusTot() {
    maj({ service, urgent: true, jour: "", iso: "", heure: "", fenetre: "" });
    routeur.push(`/reserver/${service}/lieux`);
  }

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 520 }}>
        <Link className="btn-retour" href={`/reserver/${service}/besoin`}>{t("pc_retour")}</Link>
        <h2 className="titre-page">{t("pc_urgent_t")}</h2>
        <p className="sous-page">{t("pc_urgent_p")}</p>

        <a className="pc-secours" href="tel:115">{t("pc_urgent_samu")}</a>
        <a className="pc-secours" href="tel:14">{t("pc_urgent_protection")}</a>

        <a className="btn-action" style={{ marginTop: 18 }} href={TEL_LIEN}>
          {t("pc_urgent_asm")} · {TEL_AFFICHE}
        </a>

        <h3 className="pc-sous-titre">{t("pc_urgent_suite")}</h3>
        <p className="sous-page">{t("pc_urgent_suite_p")}</p>
        <button className="btn-secondaire" onClick={continuerAuPlusTot}>{t("pc_urgent_b")}</button>
      </div>
    </div>
  );
}
