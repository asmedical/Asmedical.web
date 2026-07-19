"use client";
import { useEffect, useState } from "react";
import { fetchAdmin, Pastille, Avatar, useGardeAdmin, LIBELLE_STATUT_INTERVENANT } from "../ui";
import FicheEmploye from "../FicheEmploye";

const QUALIFS = { aide_soignant: "Auxiliaire de santé", infirmier: "Infirmier(ère)" };
const VIDE = { prenom: "", nom: "", telephone: "", email: "", qualification: "aide_soignant", communes: "" };

export default function PageSoignants() {
  const { role } = useGardeAdmin();
  const [statut, setStatut] = useState("");
  const [q, setQ] = useState("");
  const [liste, setListe] = useState(null);
  const [menuId, setMenuId] = useState(null); // carte dont le menu d'actions est ouvert
  const [fiche, setFiche] = useState(null); // { id, mode } — fiche employé ouverte
  const [creation, setCreation] = useState(false);
  const [neuf, setNeuf] = useState(VIDE);
  const [msg, setMsg] = useState("");

  async function charger() {
    try {
      const u = new URLSearchParams();
      if (statut) u.set("statut", statut);
      if (q.trim()) u.set("q", q.trim());
      const d = await fetchAdmin(`/api/admin/soignants?${u}`);
      setListe(d.soignants);
    } catch {
      setListe([]);
    }
  }
  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statut]);

  async function creer() {
    setMsg("");
    if (!neuf.prenom.trim() || !neuf.nom.trim()) {
      setMsg("Prénom et nom obligatoires.");
      return;
    }
    try {
      await fetchAdmin("/api/admin/soignants", { method: "POST", body: JSON.stringify(neuf) });
      setNeuf(VIDE);
      setCreation(false);
      setMsg("Soignant créé ✓ (statut : en attente de validation)");
      await charger();
    } catch {
      setMsg("Erreur : création impossible.");
    }
  }

  async function suspendre(x) {
    if (!window.confirm(`Suspendre ${x.prenom} ${x.nom} ? Il/elle ne pourra plus être affecté(e).`)) return;
    try {
      await fetchAdmin("/api/admin/soignants", { method: "PATCH", body: JSON.stringify({ id: x.id, statut: "SUSPENDU" }) });
      setMenuId(null);
      await charger();
    } catch {
      setMsg("Action impossible.");
    }
  }
  async function reactiver(x) {
    try {
      await fetchAdmin("/api/admin/soignants", { method: "PATCH", body: JSON.stringify({ id: x.id, statut: "VALIDE" }) });
      setMenuId(null);
      await charger();
    } catch {
      setMsg("Action impossible.");
    }
  }

  // Fiche employé ouverte : elle remplace la liste.
  const employe = fiche && liste?.find((x) => x.id === fiche.id);
  if (employe) {
    return (
      <FicheEmploye
        emploi="soignant"
        data={employe}
        role={role}
        modeInitial={fiche.mode}
        onChange={(maj) => { setListe((l) => l.map((x) => (x.id === maj.id ? { ...x, ...maj } : x))); }}
        onFermer={(supprime) => { setFiche(null); if (supprime) charger(); }}
      />
    );
  }

  return (
    <>
      <div className="adm-barre-titre">
        <h1 className="adm-titre">Soignants</h1>
        <button className="adm-btn" onClick={() => setCreation((c) => !c)}>{creation ? "Fermer" : "+ Créer un soignant"}</button>
      </div>

      {creation && (
        <div className="adm-fiche">
          <strong>Nouveau soignant</strong>
          <div className="adm-grille-form">
            <input placeholder="Prénom *" value={neuf.prenom} onChange={(e) => setNeuf({ ...neuf, prenom: e.target.value })} />
            <input placeholder="Nom *" value={neuf.nom} onChange={(e) => setNeuf({ ...neuf, nom: e.target.value })} />
            <input placeholder="Téléphone" value={neuf.telephone} onChange={(e) => setNeuf({ ...neuf, telephone: e.target.value })} />
            <input placeholder="Email" value={neuf.email} onChange={(e) => setNeuf({ ...neuf, email: e.target.value })} />
            <select value={neuf.qualification} onChange={(e) => setNeuf({ ...neuf, qualification: e.target.value })}>
              {Object.entries(QUALIFS).map(([k, v]) => (<option value={k} key={k}>{v}</option>))}
            </select>
            <input placeholder="Communes couvertes (ex. Bir Mourad Raïs, El Biar)" value={neuf.communes} onChange={(e) => setNeuf({ ...neuf, communes: e.target.value })} />
          </div>
          <button className="adm-btn" style={{ marginTop: 10 }} onClick={creer}>Créer</button>
        </div>
      )}

      <div className="adm-filtres">
        <input placeholder="Rechercher (nom, téléphone, commune)…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && charger()} />
        <select value={statut} onChange={(e) => setStatut(e.target.value)}>
          <option value="">Tous statuts</option>
          {Object.entries(LIBELLE_STATUT_INTERVENANT).map(([k, v]) => (<option value={k} key={k}>{v}</option>))}
        </select>
      </div>
      {msg && <p className="adm-msg">{msg}</p>}
      {!liste && <p className="adm-vide">Chargement…</p>}
      {liste?.length === 0 && <p className="adm-vide">Aucun soignant. Créez le premier avec le bouton ci-dessus.</p>}

      <div className="adm-liste">
        {liste?.map((x) => (
          <div key={x.id}>
            <div className="adm-ligne cliquable" onClick={() => setMenuId(menuId === x.id ? null : x.id)}>
              <Avatar mini url={x.photoUrl} nom={`${x.prenom} ${x.nom}`} />
              <span className="adm-ligne-texte">
                <strong>{x.prenom} {x.nom}</strong>
                <small>{QUALIFS[x.qualification]} · {x.telephone || "—"} {x.communes ? `· ${x.communes}` : ""}</small>
              </span>
              <Pastille statut={x.statut} table={LIBELLE_STATUT_INTERVENANT} />
            </div>
            {menuId === x.id && (
              <div className="adm-menu-actions">
                <button className="adm-btn" onClick={() => { setFiche({ id: x.id, mode: "voir" }); setMenuId(null); }}>Voir la fiche</button>
                <button className="adm-btn secondaire" onClick={() => { setFiche({ id: x.id, mode: "modifier" }); setMenuId(null); }}>Modifier</button>
                {x.statut === "VALIDE" ? (
                  <button className="adm-btn secondaire" onClick={() => suspendre(x)}>Suspendre</button>
                ) : (
                  <button className="adm-btn secondaire" onClick={() => reactiver(x)}>Valider / Réactiver</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
