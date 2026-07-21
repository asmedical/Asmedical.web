"use client";
import { useEffect, useState } from "react";
import { fetchAdmin, LIBELLE_ROLE, ROLES_ADMIN, Avatar } from "../ui";
import { MATRICE, ROLES_MATRICE, REGLES_EXTERNES } from "@/lib/permissions";

const LIB_CIBLE = { client: "Compte client", soignant: "Soignant", transporteur: "Transporteur" };

// Demandes de suppression soumises par les admins/modérateurs :
// le super admin valide (exécute) ou refuse.
function DemandesSuppression() {
  const [liste, setListe] = useState(null);
  const [msg, setMsg] = useState("");

  async function charger() {
    try {
      const d = await fetchAdmin("/api/admin/suppressions");
      setListe(d.demandes);
    } catch {
      setListe([]);
    }
  }
  useEffect(() => {
    charger();
  }, []);

  async function decider(id, action, nom) {
    const conf = action === "valider"
      ? `VALIDER la suppression de « ${nom} » ?\n\nLe compte/la fiche sera supprimé définitivement (historique conservé).`
      : `Refuser la demande de suppression de « ${nom} » ?`;
    if (!window.confirm(conf)) return;
    setMsg("");
    try {
      await fetchAdmin("/api/admin/suppressions", { method: "PATCH", body: JSON.stringify({ id, action }) });
      setMsg(action === "valider" ? "Suppression exécutée ✓" : "Demande refusée ✓");
      await charger();
    } catch {
      setMsg("Action impossible.");
    }
  }

  const enAttente = liste?.filter((d) => d.statut === "EN_ATTENTE") || [];
  const traitees = liste?.filter((d) => d.statut !== "EN_ATTENTE").slice(0, 5) || [];
  if (liste !== null && liste.length === 0) return null;

  return (
    <>
      <h2 className="adm-sous-titre">Demandes de suppression {enAttente.length > 0 ? `(${enAttente.length} à traiter)` : ""}</h2>
      {msg && <p className="adm-msg">{msg}</p>}
      {liste === null && <p className="adm-vide">Chargement…</p>}
      {liste !== null && enAttente.length === 0 && <p className="adm-vide">Aucune demande en attente.</p>}
      <div className="adm-liste">
        {enAttente.map((d) => (
          <div className="adm-ligne signale" key={d.id}>
            <span className="adm-ligne-texte">
              <strong>{LIB_CIBLE[d.cibleType] || d.cibleType} · {d.cibleNom || d.cibleId}</strong>
              <small>
                Demandé par {d.demandePar} · {new Date(d.creeLe).toLocaleString("fr-FR")}
                {d.motif ? ` · Motif : ${d.motif}` : ""}
              </small>
            </span>
            <span style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button className="adm-btn secondaire" onClick={() => decider(d.id, "refuser", d.cibleNom || d.cibleId)}>Refuser</button>
              <button className="btn-danger" style={{ padding: "9px 14px", fontSize: 13 }} onClick={() => decider(d.id, "valider", d.cibleNom || d.cibleId)}>Valider</button>
            </span>
          </div>
        ))}
        {traitees.map((d) => (
          <div className="adm-ligne" key={d.id} style={{ opacity: 0.65 }}>
            <span className="adm-ligne-texte">
              <strong>{LIB_CIBLE[d.cibleType] || d.cibleType} · {d.cibleNom || d.cibleId}</strong>
              <small>{d.statut === "VALIDEE" ? "Validée" : "Refusée"} par {d.decidePar} · demandée par {d.demandePar}</small>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

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
            <Avatar mini nom={[m.prenom, m.nom].filter(Boolean).join(" ") || m.email} />
            <span className="adm-ligne-texte">
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

      {superadmin && <DemandesSuppression />}

      {superadmin && (
        <>
          <h2 className="adm-sous-titre">Rôles & privilèges</h2>
          <p className="adm-vide" style={{ textAlign: "start" }}>
            Matrice des droits réellement appliqués par le serveur. Chaque action sensible est
            vérifiée côté serveur (jamais un simple masquage de bouton) et journalisée ci-dessous.
          </p>
          <div className="adm-fiche" style={{ overflowX: "auto" }}>
            <table className="adm-matrice">
              <thead>
                <tr>
                  <th>Action</th>
                  {ROLES_MATRICE.map((r) => <th key={r}>{LIBELLE_ROLE[r] || r}</th>)}
                </tr>
              </thead>
              <tbody>
                {MATRICE.map(([action, roles]) => (
                  <tr key={action}>
                    <td>{action}</td>
                    {ROLES_MATRICE.map((r) => (
                      <td key={r} className="centre">{roles.includes(r) ? "✅" : "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="adm-regles-ext">
              {REGLES_EXTERNES.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
        </>
      )}

      <JournalActivite recentes={donnees.journal} />
    </>
  );
}

// Journal d'activité GLOBAL filtrable : qui a fait quoi, quand, sur quoi —
// par auteur, action, type d'entité, période et texte libre, avec pages.
// Sans filtre actif, on affiche les entrées récentes déjà chargées.
function JournalActivite({ recentes }) {
  const [f, setF] = useState({ auteur: "", action: "", entite: "", q: "", debut: "", fin: "" });
  const [res, setRes] = useState(null); // null = pas de recherche → récentes
  const [page, setPage] = useState(1);
  const filtreActif = Object.values(f).some((v) => v.trim());

  async function chercher(p = 1) {
    setPage(p);
    try {
      const u = new URLSearchParams({ vue: "global", page: String(p) });
      for (const [k, v] of Object.entries(f)) if (v.trim()) u.set(k, v.trim());
      setRes(await fetchAdmin(`/api/admin/historique?${u}`));
    } catch {
      setRes({ entrees: [], total: 0, pages: 0 });
    }
  }

  const entrees = res ? res.entrees : recentes;

  return (
    <>
      <h2 className="adm-sous-titre">Journal d&apos;activité</h2>
      <div className="adm-filtres">
        <input placeholder="Auteur…" value={f.auteur} onChange={(e) => setF({ ...f, auteur: e.target.value })} style={{ maxWidth: 140 }} />
        <input placeholder="Action (ex. export, statut)…" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} style={{ maxWidth: 180 }} />
        <select value={f.entite} onChange={(e) => setF({ ...f, entite: e.target.value })}>
          <option value="">Toutes entités</option>
          {["demande", "client", "soignant", "transporteur", "facture", "paiement", "export", "groupe", "reglage"].map((x) => (
            <option value={x} key={x}>{x}</option>
          ))}
        </select>
        <input type="date" value={f.debut} onChange={(e) => setF({ ...f, debut: e.target.value })} />
        <input type="date" value={f.fin} onChange={(e) => setF({ ...f, fin: e.target.value })} />
        <input placeholder="Texte du détail…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && chercher(1)} style={{ maxWidth: 170 }} />
        <button className="adm-btn" onClick={() => chercher(1)}>Filtrer</button>
        {res && (
          <button className="adm-btn secondaire" onClick={() => { setRes(null); setF({ auteur: "", action: "", entite: "", q: "", debut: "", fin: "" }); }}>
            Réinitialiser
          </button>
        )}
      </div>
      {res && <p className="fe-aide">{res.total} action{res.total > 1 ? "s" : ""} trouvée{res.total > 1 ? "s" : ""}{filtreActif ? " avec ces filtres" : ""}.</p>}
      {entrees.length === 0 && <p className="adm-vide">Aucune action {res ? "ne correspond à ces filtres" : "enregistrée pour l'instant"}.</p>}
      <div className="adm-liste">
        {entrees.map((j) => (
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
      {res?.pages > 1 && (
        <div className="adm-pagination">
          <button disabled={page <= 1} onClick={() => chercher(page - 1)}>←</button>
          <span>Page {page} / {res.pages}</span>
          <button disabled={page >= res.pages} onClick={() => chercher(page + 1)}>→</button>
        </div>
      )}
    </>
  );
}
