"use client";
import { useAsm } from "@/app/providers";
import { IcoBulle } from "@/app/components/icones";

// Messagerie patient ↔ équipe ASM (aperçu — fil complet à venir)
export default function Messagerie() {
  const { t } = useAsm();
  return (
    <div className="page">
      <div className="contenu-page">
        <h2 className="titre-page">{t("msg_t")}</h2>
        <p className="sous-page">{t("msg_s")}</p>
        <div className="item-liste">
          <span className="ico-service">
            <IcoBulle />
          </span>
          <span>
            <strong>{t("equipe")}</strong>
            <small>{t("msg_ex")}</small>
          </span>
          <span className="pastille verte">{t("nouveau")}</span>
        </div>
      </div>
    </div>
  );
}
