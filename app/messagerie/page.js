"use client";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";
import { IcoBulle } from "@/app/components/icones";

// Messagerie patient ↔ équipe ASM. La messagerie écrite en temps réel n'est
// pas encore active : on propose le canal réel de contact (appel), sans
// afficher de faux message.
export default function Messagerie() {
  const { t } = useAsm();
  return (
    <div className="page">
      <div className="contenu-page">
        <h2 className="titre-page">{t("msg_t")}</h2>
        <p className="sous-page">{t("msg_s")}</p>

        <div className="etat-vide" style={{ padding: "26px 16px" }}>
          <span className="ico-service" style={{ margin: "0 auto 12px" }}>
            <IcoBulle />
          </span>
          <p>{t("msg_vide")}</p>
        </div>

        <a className="btn-action" href={TEL_LIEN} style={{ marginTop: 8 }}>
          {t("msg_appeler")} {TEL_AFFICHE}
        </a>
      </div>
    </div>
  );
}
