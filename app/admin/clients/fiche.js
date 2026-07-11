"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAdmin, Pastille, NotesInternes, Avatar, SERVICES, LIBELLE_ROLE } from "../ui";

const ONGLETS = [
  ["resume", "Vue d'ensemble"],
  ["rdv", "Rendez-vous"],
  ["etabs", "Établissements"],
  ["docs", "Documents"],
  ["notif", "Notifications"],
  ["notes", "Notes internes"],
  ["histo", "Historique"],
];

const STATUT_RAT = { EN_ATTENTE: "En attente", ACCEPTE: "Active", REFUSE: "Refusée", REVOQUE: "Révoquée" };

function Ligne({ label, children }) {
  return (
    <div className="fe-ligne">
      <span className="fe-label">{label}</span>
      <span className="fe-valeur">{children || <em className="fe-vide">—</em>}</span>
    </div>
  );
}

// Fiche PATIENT / ÉTABLISSEMENT complète à onglets (côté admin).
// NotifierClient est fourni par la page (composant existant réutilisé).
export default function FichePatient({ fiche, onFermer, onRecharger, NotifierClient }) {
  const p = fiche.profil;
  const estPro = p.role === "pro";
  const nom = p.etablissement || [p.prenom, p.nom].filter(Boolean).join(" ") || "Client";

  const [onglet, setOnglet] = useState("resume");
  const [edition, setEdition] = useState(false);
  const [champs, setChamps] = useState({});
  const [msg, setMsg] = useState("");
  const [histo, setHisto] = useState(null);

  useEffect(() => {
    if (onglet === "histo" && histo === null) {
      fetchAdmin(`/api/admin/historique?entite=client&id=${p.id}`)
        .then((d) => setHisto(d.entrees || []))
        .catch(() => setHisto([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet]);

  async function enregistrer() {
    setMsg("");
    try {
      await fetchAdmin("/api/admin/clients", { method: "PATCH", body: JSON.stringify({ id: p.id, ...champs }) });
      setMsg("Fiche mise à jour ✓");
      setEdition(false);
      onRecharger?.();
    } catch {
      setMsg("Erreur : enregistrement impossible.");
    }
  }

  async function actionRattachement(id, action) {
    const conf = action === "revoquer" ? "Révoquer cette autorisation ?" : "Valider ce rattachement (vérifié avec le patient) ?";
    if (!window.confirm(conf)) return;
    setMsg("");
    try {
      await fetchAdmin("/api/admin/rattachements", { method: "PATCH", body: JSON.stringify({ id, action }) });
      setMsg("Enregistré ✓");
      onRecharger?.();
    } catch {
      setMsg("Action impossible.");
    }
  }

  // Prochain / dernier rendez-vous réels.
  const maintenant = Date.now();
  const futurs = fiche.demandes
    .filter((d) => d.date && !["ANNULEE", "TERMINEE"].includes(d.statut) && new Date(d.date).getTime() > maintenant)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const passes = fiche.demandes.filter((d) => d.date && new Date(d.date).getTime() <= maintenant);
  const annulees = fiche.demandes.filter((d) => d.statut === "ANNULEE").length;
  const rattachesActifs = (fiche.rattachements || []).filter((r) => r.statut === "ACCEPTE").length;
  const enAttente = (fiche.rattachements || []).filter((r) => r.statut === "EN_ATTENTE").length;

  return (
    <div className="fe">
      <button className="adm-btn secondaire fe-retour" onClick={onFermer}>← Retour à la liste</button>

      <div className="fe-entete">
        <Avatar nom={nom} />
        <div className="fe-entete-txt">
          <h1 className="fe-nom">{nom}</h1>
          <p className="fe-role">{LIBELLE_ROLE[p.role] || "Client (patient)"} · inscrit le {(p.cree_le || "").slice(0, 10) || "—"}</p>
          <div className="fe-badges">
            {futurs[0] && <span className="adm-pastille">Prochain RDV : {futurs[0].date.replace("T", " à ")}</span>}
            {enAttente > 0 && <span className="fe-dispo d-OCCUPE">{enAttente} rattachement(s) à traiter</span>}
          </div>
        </div>
      </div>

      <div className="fe-onglets" role="tablist">
        {ONGLETS.map(([id, label]) => (
          <button key={id} role="tab" className={"fe-onglet" + (onglet === id ? " actif" : "")} onClick={() => setOnglet(id)}>
            {label}
            {id === "etabs" && enAttente > 0 ? ` (${enAttente})` : ""}
          </button>
        ))}
      </div>

      {msg && <p className="adm-msg">{msg}</p>}

      <div className="fe-contenu">
        {/* ---------- VUE D'ENSEMBLE ---------- */}
        {onglet === "resume" && (
          <>
            <div className="fe-actions-rapides">
              <Link className="adm-btn" href="/admin/demandes">Créer un rendez-vous</Link>
              <button className="adm-btn secondaire" onClick={() => setOnglet("notif")}>Notifier / demander un document</button>
              <button className="adm-btn secondaire" onClick={() => setOnglet("notes")}>Ajouter une note</button>
            </div>

            {!edition ? (
              <div className="fe-carte">
                {estPro ? (
                  <>
                    <Ligne label="Établissement">{p.etablissement}</Ligne>
                    <Ligne label="Contact">{p.contact}</Ligne>
                  </>
                ) : (
                  <>
                    <Ligne label="Prénom">{p.prenom}</Ligne>
                    <Ligne label="Nom">{p.nom}</Ligne>
                  </>
                )}
                <Ligne label="Téléphone">{p.telephone && <a href={`tel:${p.telephone}`}>{p.telephone}</a>}</Ligne>
                <Ligne label="Email">{p.email}</Ligne>
                <Ligne label="Commune">{p.commune}</Ligne>
                <Ligne label="Rendez-vous au total">{String(fiche.demandes.length)}</Ligne>
                <Ligne label="Annulations">{String(annulees)}</Ligne>
                <Ligne label="Établissements autorisés">{String(rattachesActifs)}</Ligne>
                <Ligne label="Dernier rendez-vous">{passes[0] ? passes[0].date.replace("T", " à ") : null}</Ligne>
                <div style={{ padding: "12px 0" }}>
                  <button
                    className="adm-btn secondaire"
                    onClick={() => {
                      setChamps({
                        prenom: p.prenom || "", nom: p.nom || "", telephone: p.telephone || "",
                        email: p.email || "", commune: p.commune || "",
                        ...(estPro ? { etablissement: p.etablissement || "", contact: p.contact || "" } : {}),
                      });
                      setEdition(true);
                    }}
                  >
                    Modifier la fiche
                  </button>
                </div>
              </div>
            ) : (
              <div className="fe-carte">
                <div className="adm-grille-form" style={{ paddingTop: 12 }}>
                  {Object.entries({
                    ...(estPro ? { etablissement: "Établissement", contact: "Contact" } : { prenom: "Prénom", nom: "Nom" }),
                    telephone: "Téléphone", email: "Email", commune: "Commune",
                  }).map(([k, l]) => (
                    <input key={k} placeholder={l} value={champs[k] ?? ""} onChange={(e) => setChamps({ ...champs, [k]: e.target.value })} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, padding: "12px 0" }}>
                  <button className="adm-btn" onClick={enregistrer}>Enregistrer</button>
                  <button className="adm-btn secondaire" onClick={() => setEdition(false)}>Annuler</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ---------- RENDEZ-VOUS ---------- */}
        {onglet === "rdv" && (
          <>
            {fiche.demandes.length === 0 && <p className="adm-vide">Aucune demande pour ce client.</p>}
            <div className="adm-liste">
              {fiche.demandes.map((d) => (
                <Link className="adm-ligne cliquable" href={`/admin/demandes?id=${d.id}`} key={d.id}>
                  <span className="adm-ligne-texte">
                    <strong>n°{d.id} · {SERVICES[d.service] || d.service}{d.avis ? ` · ${"★".repeat(d.avis.note)}` : ""}</strong>
                    <small>
                      {d.date?.replace("T", " à ")}{d.destination ? ` · ${d.destination}` : ""}
                      {d.parEtablissement ? ` · réservé par ${d.parEtablissement}` : ""}
                    </small>
                  </span>
                  <Pastille statut={d.statut} />
                </Link>
              ))}
            </div>
          </>
        )}

        {/* ---------- ÉTABLISSEMENTS / PROCURATIONS ---------- */}
        {onglet === "etabs" && (
          <>
            <p className="fe-aide" style={{ marginTop: 0 }}>
              Établissements autorisés à réserver pour ce patient. « Valider » confirme une demande
              vérifiée avec le patient (méthode staff) ; « Révoquer » coupe l&apos;accès immédiatement.
            </p>
            {(fiche.rattachements || []).length === 0 && <p className="adm-vide">Aucun rattachement pour ce patient.</p>}
            {(fiche.rattachements || []).map((r) => (
              <div className="fe-carte doc-emp" key={r.id}>
                <div className="doc-emp-tete">
                  <span className="doc-emp-txt">
                    <strong>{r.etabNom || "Établissement"}</strong>
                    <small>Services : {r.scopes} · source : {r.source}{r.expiration ? ` · expire le ${r.expiration}` : ""}</small>
                    <small>Créé le {new Date(r.creeLe).toLocaleDateString("fr-FR")}</small>
                  </span>
                  <span className={"doc-badge" + (r.statut === "ACCEPTE" ? " ok" : ["REFUSE", "REVOQUE"].includes(r.statut) ? " ko" : "")}>
                    {STATUT_RAT[r.statut] || r.statut}
                  </span>
                </div>
                <div className="doc-emp-actions">
                  {r.statut === "EN_ATTENTE" && (
                    <button className="adm-btn" onClick={() => actionRattachement(r.id, "valider")}>Valider (vérifié)</button>
                  )}
                  {r.statut === "ACCEPTE" && (
                    <button className="adm-btn secondaire doc-emp-suppr" onClick={() => actionRattachement(r.id, "revoquer")}>Révoquer</button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ---------- DOCUMENTS ---------- */}
        {onglet === "docs" && (
          <>
            {(fiche.documents || []).length === 0 && <p className="adm-vide">Aucun document déposé par ce client.</p>}
            {(fiche.documents || []).map((d) => (
              <div className="fe-carte doc-emp" key={d.id}>
                <div className="doc-emp-tete">
                  <span className="doc-emp-txt">
                    <strong>{d.nom}</strong>
                    <small>{d.type?.startsWith("image/") ? "Image" : "PDF"} · {new Date(d.cree_le).toLocaleDateString("fr-FR")}</small>
                  </span>
                </div>
                {d.url && (
                  <div className="doc-emp-actions">
                    <a className="adm-btn secondaire" href={d.url} target="_blank" rel="noopener noreferrer">Ouvrir</a>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* ---------- NOTIFICATIONS ---------- */}
        {onglet === "notif" && <NotifierClient userId={p.id} />}

        {/* ---------- NOTES ---------- */}
        {onglet === "notes" && <NotesInternes entite="client" entiteId={p.id} />}

        {/* ---------- HISTORIQUE ---------- */}
        {onglet === "histo" && (
          <>
            {histo === null && <p className="adm-vide">Chargement…</p>}
            {histo?.length === 0 && <p className="adm-vide">Aucune action enregistrée pour cette fiche.</p>}
            <div className="fe-histo">
              {histo?.map((e) => (
                <div className="fe-histo-ligne" key={e.id}>
                  <span className="fe-histo-point" aria-hidden="true" />
                  <div>
                    <strong>{e.action}</strong>
                    {e.detail && <span className="fe-histo-detail"> — {e.detail}</span>}
                    <small>{new Date(e.creeLe).toLocaleString("fr-FR")} · {e.auteur}</small>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
