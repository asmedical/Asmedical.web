import Link from "next/link";
import { AIDE, LANGUES, TEL_AFFICHE, TEL_LIEN, WHATSAPP_LIEN, EMAIL } from "@/lib/aide";

// Rendu de la page d'assistance, dans la langue demandée.
//
// Composant SERVEUR, sans état ni JavaScript client : cette page doit
// s'afficher pour quelqu'un qui n'a pas de compte, pas de session, et
// éventuellement une connexion lente — un examinateur de store, ou un
// patient dont l'application ne démarre plus.
export default function PageAide({ langue }) {
  const a = AIDE[langue] || AIDE.fr;
  const dir = langue === "ar" ? "rtl" : "ltr";

  return (
    <div className="page" dir={dir} lang={langue}>
      <div className="contenu-page" style={{ maxWidth: 620 }}>
        {/* Le choix de langue est en haut et toujours visible : c'est la
            première chose dont a besoin quelqu'un qui tombe sur la mauvaise
            version. */}
        <nav className="chips" style={{ marginBottom: 18 }} aria-label={a.titre}>
          {LANGUES.map((l) => (
            <Link
              key={l.cle}
              href={l.cle === "fr" ? "/aide" : `/aide/${l.cle}`}
              className={"chip" + (l.cle === langue ? " actif" : "")}
              hrefLang={l.cle}
            >
              {l.nom}
            </Link>
          ))}
        </nav>

        <h1 className="titre-page">{a.titre}</h1>
        <p className="sous-page">{a.intro}</p>

        {/* L'urgence en premier, avant les coordonnées : quelqu'un qui arrive
            ici en panique ne doit pas avoir à lire pour trouver le bon numéro. */}
        <div className="pc-secours" style={{ textAlign: "start", marginTop: 18 }}>
          <strong style={{ display: "block", marginBottom: 4 }}>{a.urgence_t}</strong>
          <span style={{ fontWeight: 500, fontSize: 15, lineHeight: 1.5 }}>{a.urgence_p}</span>
        </div>

        <h2 className="pc-sous-titre">{a.contact_t}</h2>
        <p className="sous-page">{a.contact_p}</p>

        <div className="pc-recap">
          <div className="pc-recap-ligne">
            <div>
              <small>{a.tel_l}</small>
              <strong><a href={TEL_LIEN}>{TEL_AFFICHE}</a></strong>
            </div>
          </div>
          <div className="pc-recap-ligne">
            <div>
              <small>{a.whatsapp_l}</small>
              <strong><a href={WHATSAPP_LIEN} rel="noopener noreferrer">{TEL_AFFICHE}</a></strong>
            </div>
          </div>
          <div className="pc-recap-ligne">
            <div>
              <small>{a.email_l}</small>
              <strong><a href={`mailto:${EMAIL}`}>{EMAIL}</a></strong>
            </div>
          </div>
        </div>
        <p className="pc-attente" style={{ textAlign: "start" }}>{a.delai}</p>

        <h2 className="pc-sous-titre">{a.sujets_t}</h2>
        {a.sujets.map((s, i) => (
          <div className="carte-aide" key={i}>
            <strong>{s.q}</strong>
            <p>{s.r}</p>
            {s.lien && <Link className="pc-lien" href={s.lien}>{s.lien_l}</Link>}
          </div>
        ))}
      </div>
    </div>
  );
}
