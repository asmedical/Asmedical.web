"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const CAT = {
  piece_identite: "Pièce d'identité", diplome: "Diplôme", certificat: "Certificat",
  permis: "Permis de conduire", assurance: "Assurance", carte_grise: "Carte grise",
  contrat: "Contrat", rib: "RIB", autre: "Autre",
};
const STATUT = { EN_ATTENTE: "En attente", VALIDE: "Validé", REFUSE: "Refusé" };

async function jeton() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// « Mes documents » côté employé : dépôt de ses pièces (identité, diplôme,
// permis, assurance, contrat…) et suivi de leur validation par l'équipe.
export default function DocumentsEmploye() {
  const [docs, setDocs] = useState(null);
  const [cat, setCat] = useState("piece_identite");
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function charger() {
    const token = await jeton();
    if (!token) { setDocs([]); return; }
    try {
      const r = await fetch("/api/employe/documents", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setDocs(d.documents || []);
    } catch { setDocs([]); }
  }
  useEffect(() => { charger(); }, []);

  async function deposer(e) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    setEnvoi(true); setErr(""); setMsg("");
    try {
      const token = await jeton();
      const fd = new FormData();
      fd.append("fichier", fichier); fd.append("categorie", cat);
      const r = await fetch("/api/employe/documents", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erreur || "");
      setMsg("Document envoyé ✓ — en attente de validation par l'équipe.");
      await charger();
    } catch (ex) { setErr(ex.message || "Envoi impossible."); }
    setEnvoi(false);
  }

  const badge = (s) => "doc-badge " + (s === "VALIDE" ? "ok" : s === "REFUSE" ? "ko" : "");

  return (
    <>
      <h1 className="emp-titre">Mes documents</h1>
      <p className="emp-sous">Déposez vos pièces (identité, diplôme, permis, assurance, contrat…). L&apos;équipe ASM les valide.</p>

      <div className="fe-carte" style={{ marginBottom: 16 }}>
        <label className="fe-champ"><span>Type de document</span>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            {Object.entries(CAT).map(([k, v]) => <option value={k} key={k}>{v}</option>)}
          </select>
        </label>
        <label className={"adm-btn" + (envoi ? " btn-charge" : "")} style={{ cursor: "pointer", marginTop: 12, display: "inline-block" }}>
          {envoi ? "Envoi…" : "Déposer un document (PDF/JPG/PNG)"}
          <input type="file" accept="application/pdf,image/*" hidden onChange={deposer} disabled={envoi} />
        </label>
      </div>

      {msg && <p className="adm-msg">{msg}</p>}
      {err && <p className="erreur">{err}</p>}

      {docs === null && <p className="adm-vide">Chargement…</p>}
      {docs?.length === 0 && <p className="adm-vide">Aucun document déposé pour le moment.</p>}

      {docs?.map((d) => (
        <div className="fe-carte doc-emp" key={d.id}>
          <div className="doc-emp-tete">
            <span className="doc-emp-txt">
              <strong>{CAT[d.categorie] || d.categorie}</strong>
              <small>{d.nom}</small>
              {d.expiration && <small>Expire le {d.expiration}</small>}
              {d.statut === "REFUSE" && d.remarque && <small className="doc-emp-remarque">Motif : {d.remarque}</small>}
            </span>
            <span className={badge(d.statut)}>{STATUT[d.statut] || d.statut}</span>
          </div>
          {d.url && (
            <div className="doc-emp-actions">
              <a className="adm-btn secondaire" href={d.url} target="_blank" rel="noopener noreferrer">Ouvrir</a>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
