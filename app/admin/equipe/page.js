"use client";
import { useEffect, useState } from "react";
import { fetchAdmin, LIBELLE_ROLE, ROLES_ADMIN } from "../ui";

// Gestion des comptes internes + journal d'activité.
// Un membre est un compte NORMAL du site (créé par SMS comme un patient),
// que le superadmin promeut ici. Seul le superadmin peut changer les rôles.
export default function PageEquipe() {
  const [donnees, setDonnees] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState(null);
  const [msg, setMsg] = useState("");

  async function charger() {
    try {
      setDonnees(await fetchAdmin("/api/admin/equipe"));
    } catch {
      setDonnees({ membres: [], journal: [], monRole: "" });
    }
  }
  useEffect(() => {
    charger();
  }, []);

  const superadmin = donnees?.monRole === "superadmin";

  async function chercher() {
    if (!recherche.trim()) return;
    try {
      const d = await fetchAdmin(`/api/admin/clients?q=${encodeURIComponent(recherche.trim())}`);
      setResultats(d.clients.filter((c) => !ROLES_ADMIN.includes(c.role)));
    } catch {
      setResultats([]);
    }
  }

  async function changerRole(id, role, nom) {
    const libelle = LIBELLE_ROLE[role] || role;
    if (!window.confirm(`Donner le rôle « ${libelle} » à ${nom} ?`)) return;
    setMsg("");
    try {
      await fetchAdmin("/api/admin/equipe", { method: "PATCH", body: JSON.stringify({ id, role }) });
      setMsg("Rôle mis à jour ✓");
      setResultats(null);
      setRecherche("");
      await charger();
    } catch {
      setMsg("Erreur : seul le super admin peut changer les rôles.");
    }
  }

  if (!donnees) return <p className="adm-vide">Chargement…</p>;

  return (
    <>
      <h1 className="adm-titre">Équipe & journal</h1>
      {msg && <p className="adm-msg">{msg}</p>}

      <h2 className="adm-sous-titre">Membres internes ({donnees.membres.length})</h2>
      {donnees.membres.length === 0 && (
        <p className="adm-vide">
          Aucun membre pour l&apos;instant. Voir la procédure : le membre crée un compte normal
          sur le site, puis le super admin le promeut ci-dessous.
        </p>
      )}
      <div className="adm-liste">
        {donnees.membres.map((m) => (
          <div className="adm-ligne" key={m.id}>
            <span>
              <strong>{[m.prenom, m.nom].filter(Boolean).join(" ") || m.email || m.telephone}</strong>
              <small>{m.telephone || "—"} · {m.email || "—"}</small>
            </span>
            {superadmin ? (
              <select
                value={m.role}
                onChange={(e) => changerRole(m.id, e.target.value, [m.prenom, m.nom].filter(Boolean).join(" ") || "ce membre")}
              >
                {[...ROLES_ADMIN, "patient"].map((r) => (
                  <option value={r} key={r}>{LIBELLE_ROLE[r] || r}</option>
                ))}
              </select>
            ) : (
              <span className="adm-pastille">{LIBELLE_ROLE[m.role] || m.role}</span>
            )}
          </div>
        ))}
      </div>

      {superadmin && (
        <>
          <h2 className="adm-sous-titre">Promouvoir un compte existant</h2>
          <p className="adm-vide" style={{ textAlign: "start" }}>
            La personne crée d&apos;abord un compte normal sur le site (connexion SMS), puis vous la
            retrouvez ici pour lui donner un rôle interne.
          </p>
          <div className="adm-filtres">
            <input
              placeholder="Rechercher le compte (nom, téléphone, email)…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && chercher()}
            />
            <button className="adm-btn" onClick={chercher}>Rechercher</button>
          </div>
          {resultats?.length === 0 && <p className="adm-vide">Aucun compte trouvé.</p>}
          <div className="adm-liste">
            {resultats?.map((c) => (
              <div className="adm-ligne" key={c.id}>
                <span>
                  <strong>{[c.prenom, c.nom].filter(Boolean).join(" ") || c.etablissement || "Sans nom"}</strong>
                  <small>{c.telephone || "—"} · {c.email || "—"}</small>
                </span>
                <select defaultValue="" onChange={(e) => e.target.value && changerRole(c.id, e.target.value, [c.prenom, c.nom].filter(Boolean).join(" ") || "ce compte")}>
                  <option value="" disabled>Donner un rôle…</option>
                  {ROLES_ADMIN.map((r) => (
                    <option value={r} key={r}>{LIBELLE_ROLE[r]}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="adm-sous-titre">Journal d&apos;activité</h2>
      {donnees.journal.length === 0 && <p className="adm-vide">Aucune action enregistrée pour l&apos;instant.</p>}
      <div className="adm-liste">
        {donnees.journal.map((j) => (
          <div className="adm-ligne" key={j.id}>
            <span>
              <strong>{j.auteur} — {j.action}</strong>
              <small>
                {j.entite} n°{j.entiteId} {j.detail ? `· ${j.detail}` : ""} · {new Date(j.creeLe).toLocaleString("fr-FR")}
              </small>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
