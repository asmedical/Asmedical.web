"use client";
import { useEffect } from "react";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";

// Page d'erreur (500 / erreur d'exécution) — jamais d'écran technique brut.
export default function Erreur({ error, reset }) {
  useEffect(() => {
    // Log minimal et sans donnée sensible (message tronqué, pas de pile).
    try {
      const msg = String(error?.message || error).slice(0, 200);
      console.error(JSON.stringify({ niveau: "error", contexte: "page", message: msg }));
    } catch {}
  }, [error]);

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 460, textAlign: "center", paddingTop: 56 }}>
        <h2 className="titre-page">Une erreur est survenue</h2>
        <p className="sous-page">
          Un problème technique s&apos;est produit. Réessayez, ou appelez-nous.
          <br />
          <span dir="rtl" lang="ar" style={{ fontSize: 14 }}>حدث خطأ ما، يرجى المحاولة مجدداً</span>
        </p>
        <button className="btn-action" onClick={() => reset()}>Réessayer</button>
        <a className="btn-secondaire" style={{ marginTop: 10 }} href="/">Retour à l&apos;accueil</a>
        <div className="info-appel" style={{ marginTop: 16 }}>
          Besoin d&apos;aide tout de suite ? <a href={TEL_LIEN}>{TEL_AFFICHE}</a>
        </div>
      </div>
    </div>
  );
}
