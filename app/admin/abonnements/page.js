"use client";
import { useEffect, useState } from "react";
import { fetchAdmin, Pastille } from "../ui";

const STATUT_ABO = { ACTIF: "Actif", SUSPENDU: "Suspendu", TERMINE: "Terminé" };
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function joursLisible(csv) {
  return String(csv || "").split(",").filter((x) => x !== "").map((n) => JOURS[Number(n)]).join(" · ");
}

export default function PageAbonnements() {
  const [statut, setStatut] = useState("");
  const [q, setQ] = useState("");
  const [liste, setListe] = useState(null);
  const [ouvert, setOuvert] = useState(null);
  const [msg, setMsg] = useState("");
  const [horizon, setHorizon] = useState(14);

  async function charger() {
    try {
      const u = new URLSearchParams();
      if (statut) u.set("statut", statut);
      if (q.trim()) u.set("q", q.trim());
      const d = await fetchAdmin(`/api/admin/abonnements?${u}`);
      setListe(d.abonnements);
    } catch {
      setListe([]);
    }
  }
  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statut]);

  async function maj(id, champs, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return;
    setMsg("");
    try {
      await fetchAdmin("/api/admin/abonnements", { method: "PATCH", body: JSON.stringify({ id, ...champs }) });
      setMsg("Enregistré ✓");
      await charger();
    } catch {
      setMsg("Action impossible.");
    }
  }

  async function generer(id) {
    setMsg("");
    try {
      const d = await fetchAdmin("/api/admin/abonnements", { method: "POST", body: JSON.stringify({ id, horizon }) });
      setMsg(d.crees > 0 ? `${d.crees} rendez-vous créés ✓ (ils apparaissent dans « Demandes »).` : "Aucun nouveau rendez-vous à créer (déjà générés).");
      await charger();
    } catch (e) {
      setMsg(e?.status === 400 ? "Abonnement inactif ou sans jour défini." : "Génération impossible.");
    }
  }

  const a = liste?.find((x) => x.id === ouvert);

  return (
    <>
      <h1 className="adm-titre">Abonnements</h1>
      <p className="adm-sous-titre" style={{ marginTop: 0 }}>Transports réguliers (dialyse, rééducation…)</p>

      <div className="adm-filtres">
        <input placeholder="Rechercher (nom, téléphone, centre)…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && charger()} />
        <select value={statut} onChange={(e) => setStatut(e.target.value)}>
          <option value="">Tous statuts</option>
          {Object.entries(STATUT_ABO).map(([k, v]) => (<option value={k} key={k}>{v}</option>))}
        </select>
      </div>

      {msg && <p className="adm-msg">{msg}</p>}
      {!liste && <p className="adm-vide">Chargement…</p>}
      {liste?.length === 0 && <p className="adm-vide">Aucun abonnement. Ils se créent quand un patient choisit « Transport régulier » à la réservation.</p>}

      <div className="adm-liste">
        {liste?.map((x) => (
          <div className="adm-ligne cliquable" key={x.id} onClick={() => setOuvert(ouvert === x.id ? null : x.id)}>
            <span className="adm-ligne-texte">
              <strong>{x.nom || "Sans nom"} · {x.centre}</strong>
              <small>{joursLisible(x.jours)} · {x.heure} · {x._count?.demandes ?? 0} RDV{x.retour ? " · aller-retour" : ""}</small>
            </span>
            <Pastille statut={x.statut} table={STATUT_ABO} />
          </div>
        ))}
      </div>

      {a && (
        <div className="adm-fiche">
          <strong>{a.nom || "Abonnement"} n°{a.id}</strong>
          <div className="adm-detail">
            <p><b>Téléphone :</b> {a.telephone ? <a href={`tel:${a.telephone}`}>{a.telephone}</a> : "—"}</p>
            <p><b>Trajet :</b> {a.domicile || "?"} → {a.centre}{a.retour ? " (aller-retour)" : " (aller simple)"}</p>
            <p><b>Jours :</b> {joursLisible(a.jours)} · <b>Heure :</b> {a.heure}</p>
            <p><b>Période :</b> du {a.debut || "—"}{a.fin ? ` au ${a.fin}` : " (sans fin)"}</p>
            <p><b>Rendez-vous générés :</b> {a._count?.demandes ?? 0}</p>
          </div>

          {/* Génération des rendez-vous récurrents */}
          <div className="adm-fiche" style={{ background: "var(--vert-pale)", marginTop: 12 }}>
            <strong>Générer les rendez-vous</strong>
            <p className="fe-aide" style={{ marginTop: 4 }}>Crée automatiquement les rendez-vous des prochains jours (les dates déjà créées ne sont pas dupliquées).</p>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--ligne)" }}>
                <option value={7}>7 prochains jours</option>
                <option value={14}>14 prochains jours</option>
                <option value={30}>30 prochains jours</option>
              </select>
              <button className="adm-btn" onClick={() => generer(a.id)} disabled={a.statut !== "ACTIF"}>Générer</button>
            </div>
            {a.statut !== "ACTIF" && <p className="fe-aide">Réactivez l&apos;abonnement pour générer des rendez-vous.</p>}
          </div>

          <div className="adm-actions">
            {a.statut !== "ACTIF" && <button className="adm-btn" onClick={() => maj(a.id, { statut: "ACTIF" })}>Réactiver</button>}
            {a.statut === "ACTIF" && <button className="adm-btn secondaire" onClick={() => maj(a.id, { statut: "SUSPENDU" }, `Suspendre l'abonnement de ${a.nom || "ce patient"} ?`)}>Suspendre</button>}
            {a.statut !== "TERMINE" && <button className="adm-btn secondaire" onClick={() => maj(a.id, { statut: "TERMINE" }, "Terminer définitivement cet abonnement ?")}>Terminer</button>}
          </div>
        </div>
      )}
    </>
  );
}
