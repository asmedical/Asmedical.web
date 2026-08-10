// Politique de confidentialité — exigée notamment par Google Play.
// Le texte vient de lib/confidentialite.js, source unique partagée avec
// l'application (via /api/confidentialite) : un document juridique ne doit
// pas exister en deux versions destinées à diverger.
import { MAJ, RESUME_AR, SECTIONS } from "@/lib/confidentialite";

export const metadata = {
  title: "ASM — Politique de confidentialité",
  description: "Comment ASM collecte, utilise et protège vos données personnelles.",
};

function Bloc({ titre, children }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h3 style={{ marginBottom: 8 }}>{titre}</h3>
      {children}
    </section>
  );
}

export default function Confidentialite() {
  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 720 }}>
        <h2 className="titre-page">Politique de confidentialité</h2>
        <p className="sous-page">
          ASM — Assistance Sociale Médicale · dernière mise à jour : {MAJ}
          <br />
          <span dir="rtl" lang="ar">
            {RESUME_AR}
          </span>
        </p>

        {SECTIONS.map((s) => (
          <Bloc titre={s.titre} key={s.titre}>
            {Array.isArray(s.points) && s.points.length > 0 && (
              <ul>
                {s.points.map((pt, i) => (
                  <li key={i}>
                    {pt.fort ? (
                      <>
                        <strong>{pt.fort}</strong> : {pt.texte}
                      </>
                    ) : (
                      pt.texte
                    )}
                  </li>
                ))}
              </ul>
            )}
            {(s.paragraphes || []).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </Bloc>
        ))}
      </div>
    </div>
  );
}
