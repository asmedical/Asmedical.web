"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";

// « C'est urgent ? » — écran interstitiel.
//
// Il remplace la case « urgent » du formulaire. ASM organise des transports
// PROGRAMMÉS : laisser cocher une case laissait croire à une prise en charge
// immédiate. Devant une urgence vitale, la bonne action n'est pas de remplir
// un formulaire, c'est d'appeler les secours — d'où les numéros en premier,
// en grand, et cliquables.
export default function Urgence() {
  const { t } = useAsm();
  const { service } = useParams();

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
      </div>
    </div>
  );
}
