// Page de secours affichée par le service worker quand le réseau est coupé.
// Volontairement autonome (aucune donnée à charger).
export const metadata = { title: "ASM — Hors ligne" };

export default function HorsLigne() {
  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 420, textAlign: "center", paddingTop: 40 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icone-192.png" alt="ASM" width={72} height={72} style={{ borderRadius: 20, margin: "0 auto 18px" }} />
        <h2 className="titre-page">Pas de connexion</h2>
        <p className="sous-page">
          Votre téléphone semble hors ligne. Vérifiez votre connexion, puis réessayez.
          <br />
          <span dir="rtl" lang="ar">يبدو أن هاتفك غير متصل. تحقّق من الاتصال ثم أعد المحاولة.</span>
        </p>
        <a className="btn-action" href="/accueil" style={{ display: "inline-block", marginTop: 8 }}>
          Réessayer · إعادة المحاولة
        </a>
        <p className="sous-page" style={{ marginTop: 22 }}>
          Urgence / عاجل : <a href="tel:+33665390504" style={{ fontWeight: 800 }}>+33 6 65 39 05 04</a>
        </p>
      </div>
    </div>
  );
}
