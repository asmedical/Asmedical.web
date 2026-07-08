"use client";
import { useEffect, useState } from "react";
import {
  fetchAdmin,
  Pastille,
  NotesInternes,
  ChampPhoto,
  Avatar,
  LIBELLE_STATUT_INTERVENANT,
  LIBELLE_STATUT_DEMANDE,
  SERVICES,
} from "./ui";

const QUALIFS = { aide_soignant: "Aide-soignant(e)", infirmier: "Infirmier(ère)" };
const TYPES_TR = { simple: "Simple (assis)", accompagne: "Accompagné (fauteuil)", medicalise: "Médicalisé" };
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DISPO = { DISPONIBLE: "Disponible", OCCUPE: "Occupé", ABSENT: "Absent" };
const REMU = { fixe: "Salaire fixe", horaire: "Taux horaire", mission: "Par intervention", forfait: "Forfait" };

const ONGLETS = [
  ["resume", "Résumé"],
  ["perso", "Infos perso"],
  ["compte", "Compte & accès"],
  ["travail", "Travail & dispos"],
  ["planning", "Planning"],
  ["paie", "Paie"],
  ["documents", "Documents"],
  ["notes", "Notes internes"],
  ["histo", "Historique"],
];

// Petites briques d'affichage ------------------------------------------------
function Ligne({ label, children }) {
  return (
    <div className="fe-ligne">
      <span className="fe-label">{label}</span>
      <span className="fe-valeur">{children || <em className="fe-vide">—</em>}</span>
    </div>
  );
}
function Champ({ label, valeur, onChange, type = "text", placeholder, options }) {
  return (
    <label className="fe-champ">
      <span>{label}</span>
      {options ? (
        <select value={valeur ?? ""} onChange={(e) => onChange(e.target.value)}>
          {options.map(([v, l]) => (
            <option value={v} key={v}>{l}</option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea rows={3} value={valeur ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} value={valeur ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

// Fiche employé complète, à onglets (soignant ou transporteur) ---------------
export default function FicheEmploye({ emploi, data, role, onFermer, onChange, modeInitial = "voir" }) {
  const apiBase = emploi === "soignant" ? "/api/admin/soignants" : "/api/admin/transporteurs";
  const estSoignant = emploi === "soignant";
  const superadmin = role === "superadmin";

  const [onglet, setOnglet] = useState("resume");
  const [mode, setMode] = useState(modeInitial); // voir | modifier
  const [form, setForm] = useState(() => ({ ...data }));
  const [enreg, setEnreg] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setForm({ ...data });
  }, [data]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const nomComplet = estSoignant ? `${data.prenom} ${data.nom}` : data.nom;
  const roleLibelle = estSoignant
    ? QUALIFS[data.qualification] || "Soignant"
    : `Transporteur · ${TYPES_TR[data.typeTransport] || ""}`;
  const zone = estSoignant ? data.communes : data.zone;

  // Planning (demandes affectées) et historique, chargés à la demande.
  const [planning, setPlanning] = useState(null);
  const [histo, setHisto] = useState(null);
  useEffect(() => {
    if (onglet === "planning" && planning === null) {
      const p = estSoignant ? `soignantId=${data.id}` : `transporteurId=${data.id}`;
      fetchAdmin(`/api/admin/demandes?${p}&page=1`).then((d) => setPlanning(d.demandes || [])).catch(() => setPlanning([]));
    }
    if (onglet === "histo" && histo === null) {
      fetchAdmin(`/api/admin/historique?entite=${emploi}&id=${data.id}`).then((d) => setHisto(d.entrees || [])).catch(() => setHisto([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet]);

  // Champs réellement modifiables selon le type d'employé.
  function champsEditables() {
    const communs = [
      "telephone", "email", "adresse", "commune", "wilaya", "dateNaissance", "contactUrgence",
      "dispo", "specialites", "accepteUrgences", "heureDebut", "heureFin", "joursOff", "conges",
      "typeRemuneration", "tauxHoraire", "tarifMission", "primes", "retenues", "notesPaie",
    ];
    return estSoignant
      ? ["prenom", "nom", "qualification", "communes", ...communs]
      : ["nom", "responsable", "typeTransport", "vehicule", "zone", ...communs];
  }

  async function enregistrer() {
    setEnreg(true);
    setErr("");
    setMsg("");
    try {
      const charge = { id: data.id };
      for (const k of champsEditables()) charge[k] = form[k];
      const d = await fetchAdmin(apiBase, { method: "PATCH", body: JSON.stringify(charge) });
      const maj = d.soignant || d.transporteur;
      setMsg("Modifications enregistrées ✓");
      setMode("voir");
      onChange?.(maj);
    } catch {
      setErr("Enregistrement impossible (vos droits ne le permettent peut-être pas).");
    }
    setEnreg(false);
  }

  async function changerStatut(statut, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return;
    setErr("");
    try {
      const d = await fetchAdmin(apiBase, { method: "PATCH", body: JSON.stringify({ id: data.id, statut }) });
      onChange?.(d.soignant || d.transporteur);
      setMsg("Statut mis à jour ✓");
    } catch {
      setErr("Action impossible.");
    }
  }

  async function supprimer() {
    if (!window.confirm(`SUPPRESSION DÉFINITIVE de « ${nomComplet} ».\n\nCette action est irréversible. Préférez « Suspendre » si vous voulez seulement le retirer temporairement.\n\nConfirmer la suppression ?`)) return;
    try {
      await fetchAdmin(`${apiBase}?id=${data.id}`, { method: "DELETE" });
      onFermer?.(true);
    } catch {
      setErr("Suppression impossible.");
    }
  }

  const basculerJour = (i) => {
    const set = new Set(String(form.joursOff || "").split(",").filter((x) => x !== ""));
    const s = String(i);
    set.has(s) ? set.delete(s) : set.add(s);
    setForm((f) => ({ ...f, joursOff: [...set].sort().join(",") }));
  };
  const joursReposLisible = String(data.joursOff || "").split(",").filter((x) => x !== "").map((i) => JOURS[Number(i)]).join(" · ");

  return (
    <div className="fe">
      {/* En-tête */}
      <button className="adm-btn secondaire fe-retour" onClick={() => onFermer?.(false)}>← Retour à la liste</button>

      <div className="fe-entete">
        <Avatar url={data.photoUrl} nom={nomComplet} />
        <div className="fe-entete-txt">
          <h1 className="fe-nom">{nomComplet}</h1>
          <p className="fe-role">{roleLibelle}</p>
          <div className="fe-badges">
            <Pastille statut={data.statut} table={LIBELLE_STATUT_INTERVENANT} />
            <span className={"fe-dispo d-" + (data.dispo || "DISPONIBLE")}>{DISPO[data.dispo] || "Disponible"}</span>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="fe-onglets" role="tablist">
        {ONGLETS.map(([id, label]) => (
          <button key={id} role="tab" className={"fe-onglet" + (onglet === id ? " actif" : "")} onClick={() => setOnglet(id)}>
            {label}
          </button>
        ))}
      </div>

      {msg && <p className="adm-msg">{msg}</p>}
      {err && <p className="erreur">{err}</p>}

      <div className="fe-contenu">
        {/* ---------------- RÉSUMÉ ---------------- */}
        {onglet === "resume" && (
          <>
            <div className="fe-actions-rapides">
              <button className="adm-btn" onClick={() => { setMode("modifier"); setOnglet("perso"); }}>Modifier</button>
              {data.statut === "VALIDE" ? (
                <button className="adm-btn secondaire" onClick={() => changerStatut("SUSPENDU", `Suspendre ${nomComplet} ? Il/elle ne pourra plus être affecté(e).`)}>Suspendre</button>
              ) : (
                <button className="adm-btn" onClick={() => changerStatut("VALIDE")}>Valider / Réactiver</button>
              )}
              <button className="adm-btn secondaire" onClick={() => setOnglet("notes")}>Ajouter une note</button>
              <button className="adm-btn secondaire" onClick={() => setOnglet("planning")}>Voir le planning</button>
            </div>

            <div className="fe-carte">
              <Ligne label="Téléphone">{data.telephone && <a href={`tel:${data.telephone}`}>{data.telephone}</a>}</Ligne>
              <Ligne label="Email">{data.email}</Ligne>
              <Ligne label={estSoignant ? "Communes couvertes" : "Zone couverte"}>{zone}</Ligne>
              <Ligne label="Horaires">{`${data.heureDebut ?? 7}h – ${data.heureFin ?? 19}h`}</Ligne>
              <Ligne label="Jours de repos">{joursReposLisible}</Ligne>
              <Ligne label="Disponibilité">{DISPO[data.dispo] || "Disponible"}</Ligne>
              <Ligne label="Accepte les urgences">{data.accepteUrgences ? "Oui" : "Non"}</Ligne>
              <Ligne label="Dernière modification">{data.majLe ? new Date(data.majLe).toLocaleString("fr-FR") : "—"}</Ligne>
            </div>

            {data.statut !== "VALIDE" && (
              <p className="fe-alerte">⚠️ Ce profil n’est pas actif : il n’apparaît pas dans les affectations tant qu’il n’est pas validé.</p>
            )}
          </>
        )}

        {/* ---------------- INFOS PERSO ---------------- */}
        {onglet === "perso" && (
          mode === "modifier" ? (
            <div className="fe-grille-edit">
              {estSoignant ? (
                <>
                  <Champ label="Prénom" valeur={form.prenom} onChange={set("prenom")} />
                  <Champ label="Nom" valeur={form.nom} onChange={set("nom")} />
                </>
              ) : (
                <>
                  <Champ label="Nom / société" valeur={form.nom} onChange={set("nom")} />
                  <Champ label="Responsable" valeur={form.responsable} onChange={set("responsable")} />
                </>
              )}
              <Champ label="Téléphone" valeur={form.telephone} onChange={set("telephone")} type="tel" />
              <Champ label="Email" valeur={form.email} onChange={set("email")} type="email" />
              <Champ label="Adresse" valeur={form.adresse} onChange={set("adresse")} />
              <Champ label="Commune" valeur={form.commune} onChange={set("commune")} />
              <Champ label="Wilaya" valeur={form.wilaya} onChange={set("wilaya")} />
              <Champ label="Date de naissance" valeur={form.dateNaissance} onChange={set("dateNaissance")} type="date" />
              <Champ label="Contact d'urgence (nom + tél.)" valeur={form.contactUrgence} onChange={set("contactUrgence")} />
            </div>
          ) : (
            <div className="fe-carte">
              {estSoignant ? (
                <>
                  <Ligne label="Prénom">{data.prenom}</Ligne>
                  <Ligne label="Nom">{data.nom}</Ligne>
                  <Ligne label="Qualification">{QUALIFS[data.qualification]}</Ligne>
                </>
              ) : (
                <>
                  <Ligne label="Nom / société">{data.nom}</Ligne>
                  <Ligne label="Responsable">{data.responsable}</Ligne>
                </>
              )}
              <Ligne label="Téléphone">{data.telephone && <a href={`tel:${data.telephone}`}>{data.telephone}</a>}</Ligne>
              <Ligne label="Email">{data.email}</Ligne>
              <Ligne label="Adresse">{data.adresse}</Ligne>
              <Ligne label="Commune">{data.commune}</Ligne>
              <Ligne label="Wilaya">{data.wilaya}</Ligne>
              <Ligne label="Date de naissance">{data.dateNaissance}</Ligne>
              <Ligne label="Contact d'urgence">{data.contactUrgence}</Ligne>
              <Ligne label="Compte créé le">{data.creeLe ? new Date(data.creeLe).toLocaleDateString("fr-FR") : "—"}</Ligne>
              <div className="fe-photo-bloc">
                <span className="fe-label">Photo</span>
                <ChampPhoto entite={emploi} id={data.id} url={data.photoUrl} nom={nomComplet} onPhoto={(url) => onChange?.({ ...data, photoUrl: url })} />
              </div>
            </div>
          )
        )}

        {/* ---------------- COMPTE & ACCÈS ---------------- */}
        {onglet === "compte" && (
          <OngletCompte data={data} emploi={emploi} nomComplet={nomComplet} estSoignant={estSoignant} superadmin={superadmin} onChange={onChange} />
        )}

        {/* ---------------- TRAVAIL & DISPOS ---------------- */}
        {onglet === "travail" && (
          mode === "modifier" ? (
            <div className="fe-grille-edit">
              <Champ label={estSoignant ? "Communes couvertes" : "Zone couverte"} valeur={estSoignant ? form.communes : form.zone} onChange={set(estSoignant ? "communes" : "zone")} placeholder="Séparées par des virgules" />
              {estSoignant ? (
                <>
                  <Champ label="Qualification" valeur={form.qualification} onChange={set("qualification")} options={Object.entries(QUALIFS)} />
                  <Champ label="Spécialités / soins" valeur={form.specialites} onChange={set("specialites")} placeholder="Ex. pansements, injections…" />
                </>
              ) : (
                <>
                  <Champ label="Type de transport" valeur={form.typeTransport} onChange={set("typeTransport")} options={Object.entries(TYPES_TR)} />
                  <Champ label="Véhicule" valeur={form.vehicule} onChange={set("vehicule")} placeholder="Ex. Trafic aménagé, 4 places" />
                  <Champ label="Options / capacité" valeur={form.specialites} onChange={set("specialites")} placeholder="Ex. brancard, oxygène…" />
                </>
              )}
              <Champ label="Heure de début" valeur={form.heureDebut} onChange={set("heureDebut")} type="number" />
              <Champ label="Heure de fin" valeur={form.heureFin} onChange={set("heureFin")} type="number" />
              <Champ label="Disponibilité" valeur={form.dispo} onChange={set("dispo")} options={Object.entries(DISPO)} />
              <Champ label="Congés (dates AAAA-MM-JJ)" valeur={form.conges} onChange={set("conges")} placeholder="Séparées par des virgules" />
              <div className="fe-champ fe-champ-large">
                <span>Jours de repos</span>
                <div className="chips">
                  {JOURS.map((j, i) => (
                    <button type="button" key={j} className={"chip" + (String(form.joursOff || "").split(",").includes(String(i)) ? " actif" : "")} onClick={() => basculerJour(i)}>{j}</button>
                  ))}
                </div>
              </div>
              <label className="case-ligne fe-champ-large">
                <input type="checkbox" checked={!!form.accepteUrgences} onChange={(e) => set("accepteUrgences")(e.target.checked)} />
                Accepte les interventions urgentes
              </label>
            </div>
          ) : (
            <div className="fe-carte">
              <Ligne label={estSoignant ? "Communes couvertes" : "Zone couverte"}>{zone}</Ligne>
              {estSoignant ? (
                <>
                  <Ligne label="Qualification">{QUALIFS[data.qualification]}</Ligne>
                  <Ligne label="Spécialités / soins">{data.specialites}</Ligne>
                </>
              ) : (
                <>
                  <Ligne label="Type de transport">{TYPES_TR[data.typeTransport]}</Ligne>
                  <Ligne label="Véhicule">{data.vehicule}</Ligne>
                  <Ligne label="Options / capacité">{data.specialites}</Ligne>
                </>
              )}
              <Ligne label="Horaires">{`${data.heureDebut ?? 7}h – ${data.heureFin ?? 19}h`}</Ligne>
              <Ligne label="Jours de repos">{joursReposLisible}</Ligne>
              <Ligne label="Congés prévus">{data.conges}</Ligne>
              <Ligne label="Disponibilité">{DISPO[data.dispo] || "Disponible"}</Ligne>
              <Ligne label="Urgences">{data.accepteUrgences ? "Accepte les urgences" : "Pas d'urgences"}</Ligne>
            </div>
          )
        )}

        {/* ---------------- PLANNING ---------------- */}
        {onglet === "planning" && (
          <>
            {planning === null && <p className="adm-vide">Chargement du planning…</p>}
            {planning?.length === 0 && <p className="adm-vide">Aucune intervention affectée pour le moment.</p>}
            <div className="adm-liste">
              {planning?.map((d) => (
                <div className="adm-ligne" key={d.id}>
                  <span className="adm-ligne-texte">
                    <strong>n°{d.id} · {SERVICES[d.service] || d.service}</strong>
                    <small>{d.date?.replace("T", " à ")}{d.destination ? ` · ${d.destination}` : ""}{d.nom ? ` · ${d.nom}` : ""}</small>
                  </span>
                  <Pastille statut={d.statut} table={LIBELLE_STATUT_DEMANDE} />
                </div>
              ))}
            </div>
            <p className="fe-aide">Pour affecter cet intervenant à une demande, ouvrez la demande dans l’onglet « Demandes ».</p>
          </>
        )}

        {/* ---------------- PAIE ---------------- */}
        {onglet === "paie" && (
          mode === "modifier" ? (
            <div className="fe-grille-edit">
              <Champ label="Type de rémunération" valeur={form.typeRemuneration} onChange={set("typeRemuneration")} options={[["", "—"], ...Object.entries(REMU)]} />
              <Champ label="Taux horaire (DA)" valeur={form.tauxHoraire} onChange={set("tauxHoraire")} type="number" />
              <Champ label="Tarif par intervention (DA)" valeur={form.tarifMission} onChange={set("tarifMission")} type="number" />
              <Champ label="Primes (DA)" valeur={form.primes} onChange={set("primes")} type="number" />
              <Champ label="Retenues (DA)" valeur={form.retenues} onChange={set("retenues")} type="number" />
              <div className="fe-champ fe-champ-large">
                <Champ label="Notes de paie" valeur={form.notesPaie} onChange={set("notesPaie")} type="textarea" />
              </div>
            </div>
          ) : (
            (data.typeRemuneration || data.tauxHoraire || data.tarifMission || data.notesPaie) ? (
              <div className="fe-carte">
                <Ligne label="Type de rémunération">{REMU[data.typeRemuneration]}</Ligne>
                <Ligne label="Taux horaire">{data.tauxHoraire ? `${data.tauxHoraire} DA/h` : null}</Ligne>
                <Ligne label="Tarif par intervention">{data.tarifMission ? `${data.tarifMission} DA` : null}</Ligne>
                <Ligne label="Primes">{data.primes ? `${data.primes} DA` : null}</Ligne>
                <Ligne label="Retenues">{data.retenues ? `${data.retenues} DA` : null}</Ligne>
                <Ligne label="Notes de paie">{data.notesPaie}</Ligne>
                <p className="fe-aide">Les bulletins, factures et l’historique des paiements seront ajoutés ici prochainement.</p>
              </div>
            ) : (
              <div className="adm-vide fe-etat-vide">
                <p>Aucune donnée de paie disponible pour le moment.</p>
                <button className="adm-btn secondaire" style={{ marginTop: 10 }} onClick={() => setMode("modifier")}>Configurer la rémunération</button>
              </div>
            )
          )
        )}

        {/* ---------------- DOCUMENTS ---------------- */}
        {onglet === "documents" && (
          <div className="adm-vide fe-etat-vide">
            <p><strong>Documents de l’employé</strong></p>
            <p>Pièce d’identité, diplôme, permis, assurance, contrat, RIB…</p>
            <p className="fe-aide">Cet espace documentaire (ajout, validation, expiration) sera activé prochainement. La structure est déjà prête côté serveur.</p>
          </div>
        )}

        {/* ---------------- NOTES ---------------- */}
        {onglet === "notes" && <NotesInternes entite={emploi} entiteId={data.id} />}

        {/* ---------------- HISTORIQUE ---------------- */}
        {onglet === "histo" && (
          <>
            {histo === null && <p className="adm-vide">Chargement de l’historique…</p>}
            {histo?.length === 0 && <p className="adm-vide">Aucune action enregistrée pour le moment.</p>}
            <div className="fe-histo">
              {histo?.map((e) => (
                <div className="fe-histo-ligne" key={e.id}>
                  <span className="fe-histo-point" aria-hidden="true" />
                  <div>
                    <strong>{LIB_ACTION[e.action] || e.action}</strong>
                    {e.detail && <span className="fe-histo-detail"> — {e.detail}</span>}
                    <small>{new Date(e.creeLe).toLocaleString("fr-FR")} · {e.auteur}</small>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Barre d'édition collante */}
      {mode === "modifier" && (
        <div className="fe-barre-edit">
          <span className="fe-barre-info">Modification — {ONGLETS.find((o) => o[0] === onglet)?.[1]}</span>
          <div>
            <button className="adm-btn secondaire" onClick={() => { setForm({ ...data }); setMode("voir"); setErr(""); }} disabled={enreg}>Annuler</button>
            <button className={"adm-btn" + (enreg ? " btn-charge" : "")} onClick={enregistrer} disabled={enreg} style={{ marginInlineStart: 8 }}>
              {enreg ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {/* Zone super admin : suppression définitive */}
      {mode === "voir" && superadmin && (
        <div className="fe-zone-danger">
          <span>Zone super admin</span>
          <button className="btn-danger" onClick={supprimer}>Supprimer définitivement</button>
        </div>
      )}
    </div>
  );
}

// Onglet « Compte & accès » : création du compte de connexion de l'employé,
// mot de passe temporaire, et actions (réinitialiser, forcer, suspendre).
// Réservé au super admin (l'API le vérifie aussi côté serveur).
function OngletCompte({ data, emploi, nomComplet, estSoignant, superadmin, onChange }) {
  const [statut, setStatut] = useState(null); // état du compte (si lié)
  const [chargement, setChargement] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const roleParDefaut = estSoignant ? (data.qualification === "infirmier" ? "infirmier" : "aide_soignant") : "chauffeur";
  const [form, setForm] = useState({ email: data.email || "", telephone: data.telephone || "", motDePasse: "", role: roleParDefaut });
  const [nouveauMdp, setNouveauMdp] = useState("");

  const ROLES = estSoignant
    ? [["aide_soignant", "Aide-soignant"], ["infirmier", "Infirmier"], ["coordinateur", "Coordinateur"]]
    : [["chauffeur", "Chauffeur"], ["transporteur", "Transporteur"]];

  async function chargerStatut() {
    if (!data.userId) return;
    setChargement(true);
    try {
      const d = await fetchAdmin(`/api/admin/compte?userId=${data.userId}`);
      setStatut(d.compte);
    } catch {
      setStatut(null);
    }
    setChargement(false);
  }
  useEffect(() => {
    chargerStatut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.userId]);

  function motDePasseAuto() {
    const base = "Asm" + Math.floor(1000 + Math.random() * 9000) + "!";
    setForm((f) => ({ ...f, motDePasse: base }));
  }

  async function creer() {
    setErr(""); setMsg("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setErr("Email de connexion invalide.");
    if (form.motDePasse.length < 8) return setErr("Mot de passe temporaire : 8 caractères minimum.");
    setChargement(true);
    try {
      const d = await fetchAdmin("/api/admin/compte", {
        method: "POST",
        body: JSON.stringify({ ...form, prenom: data.prenom || "", nom: data.nom || data.responsable || "", entite: emploi, entiteId: data.id }),
      });
      setMsg("Compte créé ✓ — communiquez l'email et le mot de passe temporaire à l'employé.");
      onChange?.({ ...data, userId: d.userId });
    } catch (e) {
      setErr(e?.status === 409 ? "Un compte existe déjà avec cet email." : "Création impossible.");
    }
    setChargement(false);
  }

  async function action(act, extra) {
    setErr(""); setMsg("");
    try {
      await fetchAdmin("/api/admin/compte", { method: "PATCH", body: JSON.stringify({ userId: data.userId, action: act, ...extra }) });
      setMsg("Effectué ✓");
      setNouveauMdp("");
      await chargerStatut();
    } catch {
      setErr("Action impossible.");
    }
  }

  if (!superadmin) {
    return <div className="adm-vide fe-etat-vide"><p>La gestion des comptes de connexion est réservée au super admin.</p></div>;
  }

  // Pas encore de compte → formulaire de création.
  if (!data.userId) {
    return (
      <div>
        <p className="fe-aide" style={{ marginTop: 0 }}>Créez un compte de connexion pour que {nomComplet} accède à son espace employé. Un mot de passe temporaire sera exigé au premier accès.</p>
        <div className="fe-grille-edit">
          <Champ label="Email de connexion" valeur={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <Champ label="Téléphone" valeur={form.telephone} onChange={(v) => setForm({ ...form, telephone: v })} type="tel" />
          <Champ label="Rôle" valeur={form.role} onChange={(v) => setForm({ ...form, role: v })} options={ROLES} />
          <div className="fe-champ">
            <span>Mot de passe temporaire</span>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="text" value={form.motDePasse} onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} placeholder="8 caractères min." />
              <button type="button" className="adm-btn secondaire" onClick={motDePasseAuto} style={{ flexShrink: 0 }}>Générer</button>
            </div>
          </div>
        </div>
        {err && <p className="erreur">{err}</p>}
        {msg && <p className="adm-msg">{msg}</p>}
        <button className={"adm-btn" + (chargement ? " btn-charge" : "")} onClick={creer} disabled={chargement} style={{ marginTop: 14 }}>Créer le compte de connexion</button>
      </div>
    );
  }

  // Compte existant → statut + actions.
  return (
    <div>
      {chargement && !statut && <p className="adm-vide">Chargement du compte…</p>}
      {statut && (
        <div className="fe-carte">
          <div className="fe-ligne"><span className="fe-label">Email de connexion</span><span className="fe-valeur">{statut.email}</span></div>
          <div className="fe-ligne"><span className="fe-label">Téléphone</span><span className="fe-valeur">{statut.telephone || "—"}</span></div>
          <div className="fe-ligne"><span className="fe-label">Rôle du compte</span><span className="fe-valeur">{statut.role || "—"}</span></div>
          <div className="fe-ligne"><span className="fe-label">Mot de passe temporaire</span><span className="fe-valeur">{statut.motDePasseTemporaire ? "Oui — changement exigé" : "Non (déjà changé)"}</span></div>
          <div className="fe-ligne"><span className="fe-label">Première connexion</span><span className="fe-valeur">{statut.premiereConnexionFaite ? "Effectuée" : "Pas encore"}</span></div>
          <div className="fe-ligne"><span className="fe-label">Dernière connexion</span><span className="fe-valeur">{statut.derniereConnexion ? new Date(statut.derniereConnexion).toLocaleString("fr-FR") : "—"}</span></div>
          <div className="fe-ligne"><span className="fe-label">Accès</span><span className="fe-valeur">{statut.suspendu ? "🔴 Suspendu" : "🟢 Actif"}</span></div>
        </div>
      )}

      {err && <p className="erreur">{err}</p>}
      {msg && <p className="adm-msg">{msg}</p>}

      <div className="fe-champ" style={{ marginTop: 16, maxWidth: 360 }}>
        <span>Réinitialiser le mot de passe (nouveau temporaire)</span>
        <div style={{ display: "flex", gap: 6 }}>
          <input type="text" value={nouveauMdp} onChange={(e) => setNouveauMdp(e.target.value)} placeholder="Nouveau mot de passe temporaire" />
          <button className="adm-btn" onClick={() => nouveauMdp.length >= 8 ? action("reset", { motDePasse: nouveauMdp }) : setErr("8 caractères min.")} style={{ flexShrink: 0 }}>Réinitialiser</button>
        </div>
      </div>

      <div className="fe-actions-rapides" style={{ marginTop: 16 }}>
        {!statut?.motDePasseTemporaire && (
          <button className="adm-btn secondaire" onClick={() => action("forcer")}>Forcer un changement de mot de passe</button>
        )}
        {statut?.suspendu ? (
          <button className="adm-btn" onClick={() => action("reactiver")}>Réactiver l&apos;accès</button>
        ) : (
          <button className="adm-btn secondaire" onClick={() => window.confirm("Suspendre l'accès de cet employé à son espace ?") && action("suspendre")}>Suspendre l&apos;accès</button>
        )}
      </div>
    </div>
  );
}

const LIB_ACTION = {
  "soignant.cree": "Profil créé",
  "soignant.maj": "Profil modifié",
  "soignant.photo": "Photo changée",
  "soignant.supprime": "Profil supprimé",
  "transporteur.cree": "Profil créé",
  "transporteur.maj": "Profil modifié",
  "transporteur.photo": "Photo changée",
  "transporteur.supprime": "Profil supprimé",
};
