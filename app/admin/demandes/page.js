"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchAdmin, Pastille, NotesInternes, LIBELLE_STATUT_DEMANDE, SERVICES } from "../ui";

function PageDemandes() {
  const params = useSearchParams();
  const [statut, setStatut] = useState(params.get("statut") || "");
  const [service, setService] = useState("");
  const [supervision, setSupervision] = useState(params.get("supervision") || "");
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
      if (supervision) u.set("supervision", supervision);
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
  }, [statut, service, supervision, jour, page]);

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
    } catch (e) {
      setMsg(e?.data?.raison ? `⛔ Affectation impossible : ${e.data.raison}` : "Erreur : modification impossible.");
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

      {/* Supervision terrain : accès rapide en un tap */}
      <div className="adm-supervision">
        {[
          ["", "Toutes"],
          ["en_retard", "⏱ En retard"],
          ["non_confirmee", "❓ Non confirmées"],
          ["probleme", "⚠️ Problèmes"],
        ].map(([k, v]) => (
          <button
            key={k}
            className={"adm-chip-sup" + (supervision === k ? " actif" : "")}
            onClick={() => { setSupervision(k); setPage(1); }}
          >
            {v}
          </button>
        ))}
      </div>

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
          <div className={"adm-ligne cliquable" + (x.prioritaire ? " prioritaire" : "") + (x.problemeLe ? " signale" : "")} key={x.id} onClick={() => setOuverte(ouverte === x.id ? null : x.id)}>
            <span>
              <strong>
                {x.problemeLe ? "⚠️ " : x.prioritaire ? "🔴 " : ""}n°{x.id} · {SERVICES[x.service] || x.service}
                {x.typeTrajet ? ` (${x.typeTrajet})` : ""}
              </strong>
              <small>
                {x.nom || "—"} · {x.telephone} · {x.date?.replace("T", " à ")}
                {x.soignant ? ` · 👩‍⚕️ ${x.soignant.prenom} ${x.soignant.nom}` : ""}
                {x.transporteur ? ` · 🚑 ${x.transporteur.nom}` : x.chauffeur ? ` · 🚑 ${x.chauffeur}` : ""}
                {etapeCourte(x) ? ` · ${etapeCourte(x)}` : ""}
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
            {d.sousMode && <p><b>Mode :</b> {LIB_SOUS_MODE[d.sousMode] || d.sousMode}{d.prioritaire ? " · 🔴 prioritaire" : ""}</p>}
            {(d.depart || d.destination) && <p><b>Trajet :</b> {d.depart || "?"} → {d.destination || "?"}</p>}
            <p><b>Date :</b> {d.date?.replace("T", " à ")} · <b>Récurrence :</b> {d.recurrence}</p>
            {(d.fenetre || d.pharmacie) && (
              <p><b>Livraison :</b> {d.fenetre || "—"}{d.pharmacie ? ` · Pharmacie : ${d.pharmacie}` : " · Pharmacie : au choix d'ASM"}</p>
            )}
            {d.abonnement && (
              <p>
                <b>Abonnement n°{d.abonnement.id} :</b> {joursAbo(d.abonnement.jours)} à {d.abonnement.heure} → {d.abonnement.centre}
                {d.abonnement.retour ? " (aller-retour)" : " (aller simple)"} · du {d.abonnement.debut}{d.abonnement.fin ? ` au ${d.abonnement.fin}` : ""} · {d.abonnement.statut}
              </p>
            )}
            {d.notes && <p><b>Notes client :</b> {d.notes}</p>}
            <DocsDemande d={d} />
            <Precisions json={d.details} />
            <SuiviIntervenant d={d} />
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

const LIB_SOUS_MODE = {
  ponctuel: "Ponctuel",
  urgent: "Urgent — au plus tôt",
  abonnement: "Abonnement (régulier)",
  fenetre: "Livraison (fenêtre horaire)",
};

const JOURS_FR = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
function joursAbo(csv) {
  return String(csv || "")
    .split(",")
    .map((j) => JOURS_FR[Number(j)])
    .filter(Boolean)
    .join(" · ");
}

// Étape courte de l'avancement terrain, pour l'aperçu en liste.
function etapeCourte(d) {
  if (d.finLe) return "✅ terminée";
  if (d.debutLe) return "🔧 en cours";
  if (d.arriveeLe) return "📍 arrivée";
  if (d.enRouteLe) return "🚗 en route";
  if (d.accepteeLe) return "👍 confirmée";
  return "";
}

// Suivi temps réel posé par l'intervenant sur le terrain (fiche mission).
function SuiviIntervenant({ d }) {
  const h = (v) => (v ? new Date(v).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null);
  const etapes = [
    ["Confirmée", d.accepteeLe],
    ["En route", d.enRouteLe],
    ["Arrivée", d.arriveeLe],
    ["Commencée", d.debutLe],
    ["Terminée", d.finLe],
  ].filter(([, v]) => v);
  if (!etapes.length && !d.problemeTexte && !d.compteRendu) return null;
  return (
    <div className="adm-suivi-terrain">
      <b>Suivi intervenant :</b>
      {etapes.length > 0 && (
        <span className="adm-suivi-etapes">
          {etapes.map(([l, v]) => (
            <span key={l} className="adm-suivi-etape">{l} <small>{h(v)}</small></span>
          ))}
        </span>
      )}
      {d.problemeTexte && <p className="adm-suivi-pb">⚠️ Problème signalé{d.problemeLe ? ` (${h(d.problemeLe)})` : ""} : {d.problemeTexte}</p>}
      {d.compteRendu && <p><b>Compte rendu :</b> {d.compteRendu}</p>}
      {d.avis && <p><b>Avis patient :</b> {"★".repeat(d.avis.note)}{"☆".repeat(5 - d.avis.note)} {d.avis.commentaire ? `— « ${d.avis.commentaire} »` : ""}</p>}
    </div>
  );
}

// Affiche joliment le JSON des précisions structurées du client.
function Precisions({ json }) {
  if (!json) return null;
  let p;
  try {
    p = JSON.parse(json);
  } catch {
    return <p><b>Précisions :</b> {json}</p>;
  }
  const lignes = [
    p.acte && ["Soin demandé", p.acte],
    p.besoins?.length && ["Besoins", p.besoins.join(", ")],
    p.acces && ["Accès", p.acces],
    p.code && ["Code porte", p.code],
    (p.prevenirNom || p.prevenirTel) && ["Proche à prévenir", `${p.prevenirNom || ""} ${p.prevenirTel || ""}`.trim()],
  ].filter(Boolean);
  if (!lignes.length) return null;
  return (
    <>
      {lignes.map(([l, v]) => (
        <p key={l}><b>{l} :</b> {v}</p>
      ))}
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

// Documents d'une demande (ordonnances) + signature de fin — liens signés
// chargés à la demande (1 h), jamais d'URL publique.
function DocsDemande({ d }) {
  const [docs, setDocs] = useState(null); // null = pas chargés
  const [charge, setCharge] = useState(false);
  const rien = !(d.documents?.length || d.signaturePath);
  if (rien) return null;
  async function voir() {
    setCharge(true);
    try {
      const r = await fetchAdmin(`/api/admin/demandes?documents=${d.id}`);
      setDocs(r);
    } catch {
      setDocs({ documents: [], signatureUrl: null });
    }
    setCharge(false);
  }
  return (
    <div style={{ margin: "6px 0" }}>
      {docs === null ? (
        <button className="adm-btn secondaire" onClick={voir} disabled={charge}>
          📎 {charge ? "Chargement…" : `Documents (${d.documents?.length || 0}${d.signaturePath ? " + signature" : ""})`}
        </button>
      ) : (
        <p style={{ margin: 0 }}>
          <b>Documents :</b>{" "}
          {docs.documents.map((x) => (
            <span key={x.id}>
              {x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer">{x.nom}</a> : x.nom}
              {" · "}
            </span>
          ))}
          {docs.signatureUrl && (
            <a href={docs.signatureUrl} target="_blank" rel="noopener noreferrer">✍ Signature de fin</a>
          )}
          {docs.documents.length === 0 && !docs.signatureUrl && "aucun"}
        </p>
      )}
    </div>
  );
}
