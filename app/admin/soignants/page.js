"use client";
import { useEffect, useState } from "react";
import { fetchAdmin, Pastille, NotesInternes, ChampPhoto, Avatar, LIBELLE_STATUT_INTERVENANT } from "../ui";

const QUALIFS = { aide_soignant: "Aide-soignant(e)", infirmier: "Infirmier(ère)" };
const VIDE = { prenom: "", nom: "", telephone: "", email: "", qualification: "aide_soignant", communes: "" };

export default function PageSoignants() {
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

  async function maj(id, champs, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return;
    setMsg("");
    try {
      await fetchAdmin("/api/admin/soignants", { method: "PATCH", body: JSON.stringify({ id, ...champs }) });
      setMsg("Enregistré ✓");
      setEdition(null);
      await charger();
    } catch {
      setMsg("Erreur (vos droits ne le permettent peut-être pas).");
    }
  }

  const s = liste?.find((x) => x.id === ouvert);

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
          <div className="adm-ligne cliquable" key={x.id} onClick={() => setOuvert(ouvert === x.id ? null : x.id)}>
            <Avatar mini url={x.photoUrl} nom={`${x.prenom} ${x.nom}`} />
            <span className="adm-ligne-texte">
              <strong>{x.prenom} {x.nom}</strong>
              <small>{QUALIFS[x.qualification]} · {x.telephone || "—"} {x.communes ? `· ${x.communes}` : ""}</small>
            </span>
            <Pastille statut={x.statut} table={LIBELLE_STATUT_INTERVENANT} />
          </div>
        ))}
      </div>

      {s && (
        <div className="adm-fiche">
          <strong>{s.prenom} {s.nom} — {QUALIFS[s.qualification]}</strong>
          <ChampPhoto
            entite="soignant"
            id={s.id}
            url={s.photoUrl}
            nom={`${s.prenom} ${s.nom}`}
            onPhoto={charger}
          />
          {edition !== s.id ? (
            <div className="adm-detail">
              <p><b>Téléphone :</b> {s.telephone ? <a href={`tel:${s.telephone}`}>{s.telephone}</a> : "—"} · <b>Email :</b> {s.email || "—"}</p>
              <p><b>Communes :</b> {s.communes || "—"}</p>
              <p><b>Horaires :</b> {s.heureDebut}h – {s.heureFin}h {s.joursOff ? `· repos : ${s.joursOff}` : ""}</p>
              {s.conges && <p><b>Congés :</b> {s.conges}</p>}
              <button className="adm-btn secondaire" onClick={() => setEdition(s.id)}>Modifier</button>
            </div>
          ) : (
            <FormEdition s={s} onValider={(champs) => maj(s.id, champs)} onAnnuler={() => setEdition(null)} />
          )}

          <div className="adm-actions">
            {s.statut !== "VALIDE" && (
              <button className="adm-btn" onClick={() => maj(s.id, { statut: "VALIDE" }, `Valider le profil de ${s.prenom} ${s.nom} ?`)}>✓ Valider</button>
            )}
            {s.statut === "VALIDE" && (
              <button className="adm-btn secondaire" onClick={() => maj(s.id, { statut: "SUSPENDU" }, `Suspendre ${s.prenom} ${s.nom} ? Il/elle ne sera plus proposé(e).`)}>Suspendre</button>
            )}
            {s.statut === "SUSPENDU" && (
              <button className="adm-btn" onClick={() => maj(s.id, { statut: "VALIDE" })}>Réactiver</button>
            )}
            {s.statut === "EN_ATTENTE" && (
              <button className="adm-btn secondaire" onClick={() => maj(s.id, { statut: "REFUSE" }, "Refuser ce profil ?")}>Refuser</button>
            )}
          </div>

          <NotesInternes entite="soignant" entiteId={s.id} />
        </div>
      )}
    </>
  );
}

function FormEdition({ s, onValider, onAnnuler }) {
  const [c, setC] = useState({
    prenom: s.prenom, nom: s.nom, telephone: s.telephone || "", email: s.email || "",
    qualification: s.qualification, communes: s.communes || "",
    heureDebut: s.heureDebut, heureFin: s.heureFin, joursOff: s.joursOff || "", conges: s.conges || "",
  });
  return (
    <div className="adm-detail">
      <div className="adm-grille-form">
        <input placeholder="Prénom" value={c.prenom} onChange={(e) => setC({ ...c, prenom: e.target.value })} />
        <input placeholder="Nom" value={c.nom} onChange={(e) => setC({ ...c, nom: e.target.value })} />
        <input placeholder="Téléphone" value={c.telephone} onChange={(e) => setC({ ...c, telephone: e.target.value })} />
        <input placeholder="Email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
        <select value={c.qualification} onChange={(e) => setC({ ...c, qualification: e.target.value })}>
          <option value="aide_soignant">Aide-soignant(e)</option>
          <option value="infirmier">Infirmier(ère)</option>
        </select>
        <input placeholder="Communes couvertes" value={c.communes} onChange={(e) => setC({ ...c, communes: e.target.value })} />
        <input type="number" min="0" max="24" placeholder="Début (h)" value={c.heureDebut} onChange={(e) => setC({ ...c, heureDebut: e.target.value })} />
        <input type="number" min="0" max="24" placeholder="Fin (h)" value={c.heureFin} onChange={(e) => setC({ ...c, heureFin: e.target.value })} />
        <input placeholder="Jours de repos (ex. 4,5 = ven,sam)" value={c.joursOff} onChange={(e) => setC({ ...c, joursOff: e.target.value })} />
        <input placeholder="Congés (dates AAAA-MM-JJ, virgules)" value={c.conges} onChange={(e) => setC({ ...c, conges: e.target.value })} />
      </div>
      <button className="adm-btn" style={{ marginTop: 10 }} onClick={() => onValider(c)}>Enregistrer</button>
      <button className="adm-btn secondaire" style={{ marginTop: 10, marginInlineStart: 8 }} onClick={onAnnuler}>Annuler</button>
    </div>
  );
}
