import Link from "next/link";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";

export const metadata = { title: "Page introuvable — ASM" };

// Page 404 personnalisée : jamais de page blanche.
export default function NonTrouve() {
  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 460, textAlign: "center", paddingTop: 56 }}>
        <div
          style={{
            fontFamily: "'Bricolage Grotesque',sans-serif",
            fontSize: 52,
            fontWeight: 700,
            color: "var(--vert)",
            lineHeight: 1,
            marginBottom: 12,
          }}
        >
          404
        </div>
        <h2 className="titre-page">Page introuvable</h2>
        <p className="sous-page">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
          <br />
          <span dir="rtl" lang="ar" style={{ fontSize: 14 }}>الصفحة غير موجودة</span>
        </p>
        <Link className="btn-action" href="/">Retour à l&apos;accueil</Link>
        <a className="btn-secondaire" style={{ marginTop: 10 }} href={TEL_LIEN}>
          Appeler ASM · {TEL_AFFICHE}
        </a>
      </div>
    </div>
  );
}
