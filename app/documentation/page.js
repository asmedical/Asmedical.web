"use client";
import { useAsm } from "@/app/providers";
import { IcoDocument, IcoDocumentLignes } from "@/app/components/icones";

// Documentation : bons CNAS, ordonnances (dépôt de fichiers à venir)
export default function Documentation() {
  const { t } = useAsm();
  return (
    <div className="page">
      <div className="contenu-page">
        <h2 className="titre-page">{t("doc_t")}</h2>
        <p className="sous-page">{t("doc_s")}</p>
        <div className="item-liste">
          <span className="ico-service">
            <IcoDocument />
          </span>
          <span>
            <strong>{t("doc_cnas")}</strong>
            <small>28/06/2026</small>
          </span>
        </div>
        <div className="item-liste">
          <span className="ico-service">
            <IcoDocumentLignes />
          </span>
          <span>
            <strong>{t("doc_ordo")}</strong>
            <small>25/06/2026</small>
          </span>
        </div>
        <button className="btn-action">{t("doc_ajouter")}</button>
      </div>
    </div>
  );
}
