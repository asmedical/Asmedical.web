"use client";
import { useEffect, useState } from "react";
import { fetchAdmin, Pastille, Avatar, useGardeAdmin, LIBELLE_STATUT_INTERVENANT } from "../ui";
import FicheEmploye from "../FicheEmploye";

const TYPES = { simple: "Simple (assis)", accompagne: "Accompagné (fauteuil)", medicalise: "Médicalisé" };
const VIDE = { nom: "", responsable: "", telephone: "", email: "", typeTransport: "simple", vehicule: "", zone: "" };

export default function PageTransporteurs() {
  const { role } = useGardeAdmin();
  const [statut, setStatut] = useState("");
  const [q, setQ] = useState("");
  const [liste, setListe] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [fiche, setFiche] = useState(null);
  const [creation, setCreation] = useState(false);
  const [neuf, setNeuf] = useState(VIDE);
  const [msg, setMsg] = useState("");

  async function charger() {
    try {
      const u = new URLSearchParams();
      if (statut) u.set("statut", statut);
      if (q.trim()) u.set("q", q.trim());
      const d = await fetchAdmin(`/api/admin/transporteurs?${u}`);
      setListe(d.transporteurs);
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
    if (!neuf.nom.trim()) {
      setMsg("Nom obligatoire.");
      return;
    }
    try {
      await fetchAdmin("/api/admin/transporteurs", { method: "POST", body: JSON.stringify(neuf) });
      setNeuf(VIDE);
      setCreation(false);
      setMsg("Transporteur créé ✓ (statut : en attente de validation)");
      await charger();
    } catch {
      setMsg("Erreur : création impossible.");
    }
  }

  async function suspendre(x) {
    if (!window.confirm(`Suspendre ${x.nom} ? Il ne pourra plus être affecté.`)) return;
    try {
      await fetchAdmin("/api/admin/transporteurs", { method: "PATCH", body: JSON.stringify({ id: x.id, statut: "SUSPENDU" }) });
      setMenuId(null);
      await charger();
    } catch {
      setMsg("Action impossible.");
    }
  }
  async function reactiver(x) {
    try {
      await fetchAdmin("/api/admin/transporteurs", { method: "PATCH", body: JSON.stringify({ id: x.id, statut: "VALIDE" }) });
      setMenuId(null);
      await charger();
    } catch {
      setMsg("Action impossible.");
    }
  }

  const employe = fiche && liste?.find((x) => x.id === fiche.id);
  if (employe) {
    return (
      <FicheEmploye
        emploi="transporteur"
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
        <h1 className="adm-titre">Transporteurs</h1>
        <button className="adm-btn" onClick={() => setCreation((c) => !c)}>{creation ? "Fermer" : "+ Créer un transporteur"}</button>
      </div>

      {creation && (
        <div className="adm-fiche">
          <strong>Nouveau transporteur</strong>
          <div className="adm-grille-form">
            <input placeholder="Nom / société *" value={neuf.nom} onChange={(e) => setNeuf({ ...neuf, nom: e.target.value })} />
            <input placeholder="Responsable" value={neuf.responsable} onChange={(e) => setNeuf({ ...neuf, responsable: e.target.value })} />
            <input placeholder="Téléphone" value={neuf.telephone} onChange={(e) => setNeuf({ ...neuf, telephone: e.target.value })} />
            <input placeholder="Email" value={neuf.email} onChange={(e) => setNeuf({ ...neuf, email: e.target.value })} />
            <select value={neuf.typeTransport} onChange={(e) => setNeuf({ ...neuf, typeTransport: e.target.value })}>
              {Object.entries(TYPES).map(([k, v]) => (<option value={k} key={k}>{v}</option>))}
            </select>
            <input placeholder="Véhicule (ex. Trafic aménagé)" value={neuf.vehicule} onChange={(e) => setNeuf({ ...neuf, vehicule: e.target.value })} />
            <input placeholder="Zone couverte (communes)" value={neuf.zone} onChange={(e) => setNeuf({ ...neuf, zone: e.target.value })} />
          </div>
          <button className="adm-btn" style={{ marginTop: 10 }} onClick={creer}>Créer</button>
        </div>
      )}

      <div className="adm-filtres">
        <input placeholder="Rechercher (nom, téléphone, zone)…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && charger()} />
        <select value={statut} onChange={(e) => setStatut(e.target.value)}>
          <option value="">Tous statuts</option>
          {Object.entries(LIBELLE_STATUT_INTERVENANT).map(([k, v]) => (<option value={k} key={k}>{v}</option>))}
        </select>
      </div>
      {msg && <p className="adm-msg">{msg}</p>}
      {!liste && <p className="adm-vide">Chargement…</p>}
      {liste?.length === 0 && <p className="adm-vide">Aucun transporteur. Créez le premier avec le bouton ci-dessus.</p>}

      <div className="adm-liste">
        {liste?.map((x) => (
          <div key={x.id}>
            <div className="adm-ligne cliquable" onClick={() => setMenuId(menuId === x.id ? null : x.id)}>
              <Avatar mini url={x.photoUrl} nom={x.nom} />
              <span className="adm-ligne-texte">
                <strong>{x.nom}</strong>
                <small>{TYPES[x.typeTransport]} · {x.telephone || "—"} {x.zone ? `· ${x.zone}` : ""}</small>
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
