"use client";
import { useEffect, useState } from "react";
import { fetchAdmin, Pastille, NotesInternes, SERVICES, LIBELLE_ROLE } from "../ui";

export default function PageClients() {
  const [q, setQ] = useState("");
  const [clients, setClients] = useState(null);
  const [fiche, setFiche] = useState(null); // { profil, demandes }
  const [edition, setEdition] = useState(false);
  const [champs, setChamps] = useState({});
  const [msg, setMsg] = useState("");

  async function charger() {
    try {
      const d = await fetchAdmin(`/api/admin/clients${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
      setClients(d.clients);
    } catch {
      setClients([]);
    }
  }
  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ouvrir(id) {
    setMsg("");
    setEdition(false);
    try {
      setFiche(await fetchAdmin(`/api/admin/clients?id=${id}`));
    } catch {
      setMsg("Impossible d'ouvrir la fiche.");
    }
  }

  async function enregistrer() {
    setMsg("");
    try {
      await fetchAdmin("/api/admin/clients", {
        method: "PATCH",
        body: JSON.stringify({ id: fiche.profil.id, ...champs }),
      });
      setMsg("Fiche mise à jour ✓");
      setEdition(false);
      await ouvrir(fiche.profil.id);
      await charger();
    } catch {
      setMsg("Erreur : enregistrement impossible.");
    }
  }

  const p = fiche?.profil;

  return (
    <>
      <h1 className="adm-titre">Clients</h1>
      <div className="adm-filtres">
        <input
          placeholder="Rechercher par nom, téléphone, email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && charger()}
        />
        <button className="adm-btn" onClick={charger}>Rechercher</button>
      </div>
      {msg && <p className="adm-msg">{msg}</p>}
      {!clients && <p className="adm-vide">Chargement…</p>}
      {clients?.length === 0 && <p className="adm-vide">Aucun client trouvé.</p>}

      <div className="adm-liste">
        {clients?.map((c) => (
          <div className="adm-ligne cliquable" key={c.id} onClick={() => ouvrir(c.id)}>
            <span>
              <strong>{c.etablissement || [c.prenom, c.nom].filter(Boolean).join(" ") || "Sans nom"}</strong>
              <small>
                {LIBELLE_ROLE[c.role] || c.role} · {c.telephone || "—"} · {c.email || "—"}
                {c.commune ? ` · ${c.commune}` : ""}
              </small>
            </span>
            <span className="adm-pastille">{(c.cree_le || "").slice(0, 10)}</span>
          </div>
        ))}
      </div>

      {p && (
        <div className="adm-fiche">
          <strong>{p.etablissement || [p.prenom, p.nom].filter(Boolean).join(" ") || "Client"}</strong>

          {!edition ? (
            <div className="adm-detail">
              <p><b>Type :</b> {LIBELLE_ROLE[p.role] || p.role}</p>
              <p><b>Téléphone :</b> {p.telephone ? <a href={`tel:${p.telephone}`}>{p.telephone}</a> : "—"} · <b>Email :</b> {p.email || "—"}</p>
              <p><b>Commune :</b> {p.commune || "—"} {p.contact ? `· Contact : ${p.contact}` : ""}</p>
              <p><b>Inscrit le :</b> {(p.cree_le || "").slice(0, 10)}</p>
              <button
                className="adm-btn secondaire"
                onClick={() => {
                  setChamps({ prenom: p.prenom || "", nom: p.nom || "", telephone: p.telephone || "", commune: p.commune || "" });
                  setEdition(true);
                }}
              >
                Modifier la fiche
              </button>
            </div>
          ) : (
            <div className="adm-detail">
              <div className="adm-grille-form">
                {Object.entries({ prenom: "Prénom", nom: "Nom", telephone: "Téléphone", commune: "Commune" }).map(([k, l]) => (
                  <input key={k} placeholder={l} value={champs[k] ?? ""} onChange={(e) => setChamps({ ...champs, [k]: e.target.value })} />
                ))}
              </div>
              <button className="adm-btn" style={{ marginTop: 10 }} onClick={enregistrer}>Enregistrer</button>
              <button className="adm-btn secondaire" style={{ marginTop: 10, marginInlineStart: 8 }} onClick={() => setEdition(false)}>Annuler</button>
            </div>
          )}

          <strong style={{ display: "block", marginTop: 16 }}>Ses demandes ({fiche.demandes.length})</strong>
          {fiche.demandes.length === 0 && <p className="adm-vide">Aucune demande.</p>}
          <div className="adm-liste">
            {fiche.demandes.map((d) => (
              <div className="adm-ligne" key={d.id}>
                <span>
                  <strong>n°{d.id} · {SERVICES[d.service] || d.service}</strong>
                  <small>{d.date?.replace("T", " à ")}</small>
                </span>
                <Pastille statut={d.statut} />
              </div>
            ))}
          </div>

          <NotesInternes entite="client" entiteId={p.id} />
        </div>
      )}
    </>
  );
}
