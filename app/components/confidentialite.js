import Link from "next/link";
import { POLITIQUE, PRIMAUTE, RESUME_AR, LANGUES } from "@/lib/confidentialite";

// Rendu de la politique de confidentialité, dans la langue demandée.
//
// Composant SERVEUR : ce document doit s'afficher pour quelqu'un sans compte,
// sans session et sans JavaScript — un examinateur de store, un régulateur,
// ou simplement une personne qui veut savoir ce qu'on fait de ses données
// avant de s'inscrire.
export default function PagePolitique({ langue }) {
  const p = POLITIQUE[langue] || POLITIQUE.fr;
  const dir = langue === "ar" ? "rtl" : "ltr";

  return (
    <div className="page" dir={dir} lang={langue}>
      <div className="contenu-page" style={{ maxWidth: 720 }}>
        <nav className="chips" style={{ marginBottom: 18 }} aria-label={p.titre}>
          {LANGUES.map((l) => (
            <Link
              key={l.cle}
              href={l.cle === "fr" ? "/confidentialite" : `/confidentialite/${l.cle}`}
              className={"chip" + (l.cle === langue ? " actif" : "")}
              hrefLang={l.cle}
            >
              {l.nom}
            </Link>
          ))}
        </nav>

        <h1 className="titre-page">{p.titre}</h1>
        <p className="sous-page">
          ASM — Assistance Sociale Médicale · {p.maj}
          {langue === "fr" && (
            <>
              <br />
              <span dir="rtl" lang="ar">{RESUME_AR}</span>
            </>
          )}
        </p>

        {/* Sur les traductions : dire laquelle fait foi. Trois documents
            présentés comme équivalents seraient un engagement intenable. */}
        {PRIMAUTE[langue] && <p className="pc-attente" style={{ textAlign: "start" }}>{PRIMAUTE[langue]}</p>}

        {p.sections.map((s) => (
          <section style={{ marginBottom: 22 }} key={s.titre}>
            <h2 style={{ marginBottom: 8, fontSize: 17 }}>{s.titre}</h2>
            {Array.isArray(s.points) && s.points.length > 0 && (
              <ul>
                {s.points.map((pt, i) => (
                  <li key={i}>
                    {pt.fort ? (<><strong>{pt.fort}</strong> : {pt.texte}</>) : pt.texte}
                  </li>
                ))}
              </ul>
            )}
            {(s.paragraphes || []).map((par, i) => <p key={i}>{par}</p>)}
          </section>
        ))}
      </div>
    </div>
  );
}
