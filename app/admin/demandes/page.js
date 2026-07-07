"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchAdmin, Pastille, NotesInternes, LIBELLE_STATUT_DEMANDE, SERVICES } from "../ui";

function PageDemandes() {
  const params = useSearchParams();
  const [statut, setStatut] = useState(params.get("statut") || "");
  const [service, setService] = useState("");
  const [jour, setJour] = useState(params.get("jour") === "auj" ? new Date().toISOString().slice(0, 10) : "");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState(null);
  const [ouverte, setOuverte] = useState(params.get("id") ? Number(params.get("id")) : null);
  const [soignants, setSoignants] = useState([]);
  const [transporteurs, setTransporteurs] = useState([]);
  const [msg, setMsg] = useState("");
  const [creation, setCreation] = useState(false);
  const [neuf, setNeuf] = useState({ service: "transport", nom: "", telephone: "", date: "", depart: "", destination: "", notes: "" });

  async function charger() {
    try {
      const u = new URLSearchParams();
      if (statut) u.set("statut", statut);
      if (service) u.set("service", service);
      if (jour) u.set("jour", jour);
      if (q.trim()) u.set("q", q.trim());
      u.set("page", String(page));
      setDonnees(await fetchAdmin(`/api/admin/demandes?${u}`));
    } catch {
      setDonnees({ demandes: [], total: 0, pages: 0 });
    }
  }
  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statut, service, jour, page]);

  useEffect(() => {
    fetchAdmin("/api/admin/soignants?statut=VALIDE").then((d) => setSoignants(d.soignants)).catch(() => {});
    fetchAdmin("/api/admin/transporteurs?statut=VALIDE").then((d) => setTransporteurs(d.transporteurs)).catch(() => {});
  }, []);

  async function maj(id, champs, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return;
    setMsg("");
    try {
      await fetchAdmin("/api/admin/demandes", { method: "PATCH", body: JSON.stringify({ id, ...champs }) });
      setMsg("Enregistré ✓");
      await charger();
    } catch {
      setMsg("Erreur : modification impossible.");
    }
  }

  async function creer() {
    setMsg("");
    if (!neuf.telephone.trim() || !neuf.date) {
      setMsg("Téléphone et date obligatoires.");
      return;
    }
    try {
      await fetchAdmin("/api/admin/demandes", { method: "POST", body: JSON.stringify(neuf) });
      setCreation(false);
      setNeuf({ service: "transport", nom: "", telephone: "", date: "", depart: "", destination: "", notes: "" });
      setMsg("Rendez-vous créé ✓");
      await charger();
    } catch {
      setMsg("Erreur : création impossible.");
    }
  }

  const d = donnees?.demandes.find((x) => x.id === ouverte);

  return (
    <>
      <div className="adm-barre-titre">
        <h1 className="adm-titre">Demandes & rendez-vous</h1>
        <button className="adm-btn" onClick={() => setCreation((c) => !c)}>
          {creation ? "Fermer" : "+ Créer un RDV"}
        </button>
      </div>

      {creation && (
        <div className="adm-fiche">
          <strong>Nouveau rendez-vous (créé par l&apos;équipe)</strong>
          <div className="adm-grille-form">
            <select value={neuf.service} onChange={(e) => setNeuf({ ...neuf, service: e.target.value })}>
              {Object.entries(SERVICES).map(([k, v]) => (
                <option value={k} key={k}>{v}</option>
              ))}
            </select>
            <input placeholder="Nom du client" value={neuf.nom} onChange={(e) => setNeuf({ ...neuf, nom: e.target.value })} />
            <input placeholder="Téléphone *" value={neuf.telephone} onChange={(e) => setNeuf({ ...neuf, telephone: e.target.value })} />
            <input type="datetime-local" value={neuf.date} onChange={(e) => setNeuf({ ...neuf, date: e.target.value })} />
            <input placeholder="Départ" value={neuf.depart} onChange={(e) => setNeuf({ ...neuf, depart: e.target.value })} />
            <input placeholder="Destination" value={neuf.destination} onChange={(e) => setNeuf({ ...neuf, destination: e.target.value })} />
          </div>
          <input placeholder="Notes" value={neuf.notes} onChange={(e) => setNeuf({ ...neuf, notes: e.target.value })} style={{ marginTop: 8 }} />
          <button className="adm-btn" style={{ marginTop: 10 }} onClick={creer}>Créer</button>
        </div>
      )}

      <div className="adm-filtres">
        <input placeholder="Rechercher (nom, téléphone, destination)…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setPage(1), charger())} />
        <select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }}>
          <option value="">Tous statuts</option>
          {Object.entries(LIBELLE_STATUT_DEMANDE).map(([k, v]) => (
            <option value={k} key={k}>{v}</option>
          ))}
        </select>
        <select value={service} onChange={(e) => { setService(e.target.value); setPage(1); }}>
          <option value="">Tous services</option>
          {Object.entries(SERVICES).map(([k, v]) => (
            <option value={k} key={k}>{v}</option>
          ))}
        </select>
        <input type="date" value={jour} onChange={(e) => { setJour(e.target.value); setPage(1); }} />
      </div>

      {msg && <p className="adm-msg">{msg}</p>}
      {!donnees && <p className="adm-vide">Chargement…</p>}
      {donnees?.demandes.length === 0 && <p className="adm-vide">Aucune demande ne correspond.</p>}

      <div className="adm-liste">
        {donnees?.demandes.map((x) => (
          <div className={"adm-ligne cliquable" + (x.prioritaire ? " prioritaire" : "")} key={x.id} onClick={() => setOuverte(ouverte === x.id ? null : x.id)}>
            <span>
              <strong>
                {x.prioritaire ? "🔴 " : ""}n°{x.id} · {SERVICES[x.service] || x.service}
                {x.typeTrajet ? ` (${x.typeTrajet})` : ""}
              </strong>
              <small>
                {x.nom || "—"} · {x.telephone} · {x.date?.replace("T", " à ")}
                {x.soignant ? ` · 👩‍⚕️ ${x.soignant.prenom} ${x.soignant.nom}` : ""}
                {x.transporteur ? ` · 🚑 ${x.transporteur.nom}` : x.chauffeur ? ` · 🚑 ${x.chauffeur}` : ""}
              </small>
            </span>
            <Pastille statut={x.statut} />
          </div>
        ))}
      </div>

      {donnees?.pages > 1 && (
        <div className="adm-pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>
          <span>Page {page} / {donnees.pages}</span>
          <button disabled={page >= donnees.pages} onClick={() => setPage(page + 1)}>→</button>
        </div>
      )}

      {d && (
        <div className="adm-fiche">
          <strong>Demande n°{d.id} — {SERVICES[d.service] || d.service}</strong>
          <div className="adm-detail">
            <p><b>Client :</b> {d.nom || "—"} · <a href={`tel:${d.telephone}`}>{d.telephone}</a></p>
            {(d.depart || d.destination) && <p><b>Trajet :</b> {d.depart || "?"} → {d.destination || "?"}</p>}
            <p><b>Date :</b> {d.date?.replace("T", " à ")} · <b>Récurrence :</b> {d.recurrence}</p>
            {d.notes && <p><b>Notes client :</b> {d.notes}</p>}
            {d.details && <p><b>Précisions :</b> {d.details}</p>}
          </div>

          <div className="adm-actions">
            <label>Statut
              <select value={d.statut} onChange={(e) => maj(d.id, { statut: e.target.value }, e.target.value === "ANNULEE" ? "Annuler cette demande ?" : null)}>
                {Object.entries(LIBELLE_STATUT_DEMANDE).map(([k, v]) => (
                  <option value={k} key={k}>{v}</option>
                ))}
              </select>
            </label>
            {d.service === "domicile" ? (
              <label>Soignant
                <select value={d.soignantId || ""} onChange={(e) => maj(d.id, { soignantId: e.target.value || null })}>
                  <option value="">— non affecté —</option>
                  {soignants.map((s) => (
                    <option value={s.id} key={s.id}>{s.prenom} {s.nom} ({s.qualification === "infirmier" ? "inf." : "AS"})</option>
                  ))}
                </select>
              </label>
            ) : (
              <label>Transporteur
                <select value={d.transporteurId || ""} onChange={(e) => maj(d.id, { transporteurId: e.target.value || null })}>
                  <option value="">— non affecté —</option>
                  {transporteurs.map((t) => (
                    <option value={t.id} key={t.id}>{t.nom} ({t.typeTransport})</option>
                  ))}
                </select>
              </label>
            )}
            <label>Reprogrammer
              <input type="datetime-local" defaultValue={d.date} onBlur={(e) => e.target.value && e.target.value !== d.date && maj(d.id, { date: e.target.value })} />
            </label>
            <button className="adm-btn secondaire" onClick={() => maj(d.id, { prioritaire: !d.prioritaire })}>
              {d.prioritaire ? "Retirer la priorité" : "Marquer urgent"}
            </button>
          </div>

          <NotesInternes entite="demande" entiteId={d.id} />
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <PageDemandes />
    </Suspense>
  );
}
