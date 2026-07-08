"use client";
import { useEffect, useState } from "react";
import { fetchAdmin, Pastille, NotesInternes, ChampPhoto, Avatar, LIBELLE_STATUT_INTERVENANT } from "../ui";

const TYPES = { simple: "Simple (assis)", accompagne: "Accompagné (fauteuil)", medicalise: "Médicalisé" };
const VIDE = { nom: "", responsable: "", telephone: "", email: "", typeTransport: "simple", vehicule: "", zone: "" };

export default function PageTransporteurs() {
  const [statut, setStatut] = useState("");
  const [q, setQ] = useState("");
  const [liste, setListe] = useState(null);
  const [ouvert, setOuvert] = useState(null);
  const [creation, setCreation] = useState(false);
  const [neuf, setNeuf] = useState(VIDE);
  const [edition, setEdition] = useState(null);
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

  async function maj(id, champs, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return;
    setMsg("");
    try {
      await fetchAdmin("/api/admin/transporteurs", { method: "PATCH", body: JSON.stringify({ id, ...champs }) });
      setMsg("Enregistré ✓");
      setEdition(null);
      await charger();
    } catch {
      setMsg("Erreur (vos droits ne le permettent peut-être pas).");
    }
  }

  const t = liste?.find((x) => x.id === ouvert);

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
          <div className="adm-ligne cliquable" key={x.id} onClick={() => setOuvert(ouvert === x.id ? null : x.id)}>
            <Avatar mini url={x.photoUrl} nom={x.nom} />
            <span className="adm-ligne-texte">
              <strong>{x.nom}</strong>
              <small>{TYPES[x.typeTransport]} · {x.telephone || "—"} {x.zone ? `· ${x.zone}` : ""}</small>
            </span>
            <Pastille statut={x.statut} table={LIBELLE_STATUT_INTERVENANT} />
          </div>
        ))}
      </div>

      {t && (
        <div className="adm-fiche">
          <strong>{t.nom} — {TYPES[t.typeTransport]}</strong>
          <ChampPhoto
            entite="transporteur"
            id={t.id}
            url={t.photoUrl}
            nom={t.nom}
            onPhoto={charger}
          />
          {edition !== t.id ? (
            <div className="adm-detail">
              <p><b>Responsable :</b> {t.responsable || "—"}</p>
              <p><b>Téléphone :</b> {t.telephone ? <a href={`tel:${t.telephone}`}>{t.telephone}</a> : "—"} · <b>Email :</b> {t.email || "—"}</p>
              <p><b>Véhicule :</b> {t.vehicule || "—"} · <b>Zone :</b> {t.zone || "—"}</p>
              <button className="adm-btn secondaire" onClick={() => setEdition(t.id)}>Modifier</button>
            </div>
          ) : (
            <FormEdition t={t} onValider={(c) => maj(t.id, c)} onAnnuler={() => setEdition(null)} />
          )}

          <div className="adm-actions">
            {t.statut !== "VALIDE" && (
              <button className="adm-btn" onClick={() => maj(t.id, { statut: "VALIDE" }, `Valider ${t.nom} ?`)}>✓ Valider</button>
            )}
            {t.statut === "VALIDE" && (
              <button className="adm-btn secondaire" onClick={() => maj(t.id, { statut: "SUSPENDU" }, `Suspendre ${t.nom} ?`)}>Suspendre</button>
            )}
            {t.statut === "SUSPENDU" && (
              <button className="adm-btn" onClick={() => maj(t.id, { statut: "VALIDE" })}>Réactiver</button>
            )}
            {t.statut === "EN_ATTENTE" && (
              <button className="adm-btn secondaire" onClick={() => maj(t.id, { statut: "REFUSE" }, "Refuser ce profil ?")}>Refuser</button>
            )}
          </div>

          <NotesInternes entite="transporteur" entiteId={t.id} />
        </div>
      )}
    </>
  );
}

function FormEdition({ t, onValider, onAnnuler }) {
  const [c, setC] = useState({
    nom: t.nom, responsable: t.responsable || "", telephone: t.telephone || "", email: t.email || "",
    typeTransport: t.typeTransport, vehicule: t.vehicule || "", zone: t.zone || "",
  });
  return (
    <div className="adm-detail">
      <div className="adm-grille-form">
        <input placeholder="Nom / société" value={c.nom} onChange={(e) => setC({ ...c, nom: e.target.value })} />
        <input placeholder="Responsable" value={c.responsable} onChange={(e) => setC({ ...c, responsable: e.target.value })} />
        <input placeholder="Téléphone" value={c.telephone} onChange={(e) => setC({ ...c, telephone: e.target.value })} />
        <input placeholder="Email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
        <select value={c.typeTransport} onChange={(e) => setC({ ...c, typeTransport: e.target.value })}>
          <option value="simple">Simple (assis)</option>
          <option value="accompagne">Accompagné (fauteuil)</option>
          <option value="medicalise">Médicalisé</option>
        </select>
        <input placeholder="Véhicule" value={c.vehicule} onChange={(e) => setC({ ...c, vehicule: e.target.value })} />
        <input placeholder="Zone couverte" value={c.zone} onChange={(e) => setC({ ...c, zone: e.target.value })} />
      </div>
      <button className="adm-btn" style={{ marginTop: 10 }} onClick={() => onValider(c)}>Enregistrer</button>
      <button className="adm-btn secondaire" style={{ marginTop: 10, marginInlineStart: 8 }} onClick={onAnnuler}>Annuler</button>
    </div>
  );
}
