import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";

export const metadata = { title: "Maintenance — ASM", robots: { index: false } };

// Page de maintenance. Activée en mettant la variable d'environnement
// MAINTENANCE_MODE=on (voir middleware.js), sans toucher au reste du site.
export default function Maintenance() {
  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 460, textAlign: "center", paddingTop: 56 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            margin: "0 auto 16px",
            background: "var(--vert-pale)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
          }}
          aria-hidden="true"
        >
          🛠️
        </div>
        <h2 className="titre-page">Site en maintenance</h2>
        <p className="sous-page">
          Le site est momentanément en maintenance. Nous revenons très vite.
          Pour toute urgence, appelez-nous.
          <br />
          <span dir="rtl" lang="ar" style={{ fontSize: 14 }}>الموقع قيد الصيانة، سنعود قريباً</span>
        </p>
        <a className="btn-action" href={TEL_LIEN}>Appeler ASM · {TEL_AFFICHE}</a>
      </div>
    </div>
  );
}
