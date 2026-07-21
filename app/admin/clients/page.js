"use client";
import { useEffect, useState } from "react";
import { fetchAdmin, Pastille, NotesInternes, SERVICES, LIBELLE_ROLE, Avatar } from "../ui";
import FichePatient from "./fiche";

export default function PageClients() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("patient"); // patient | pro
  const [clients, setClients] = useState(null);
  const [fiche, setFiche] = useState(null); // { profil, demandes }
  const [edition, setEdition] = useState(false);
  const [champs, setChamps] = useState({});
  const [msg, setMsg] = useState("");
  const [creation, setCreation] = useState(false);
  const VIDE_CLIENT = { role: "patient", prenom: "", nom: "", etablissement: "", telephone: "", email: "", commune: "", contact: "" };
  const [neuf, setNeuf] = useState(VIDE_CLIENT);

  async function creerClient() {
    setMsg("");
    if (neuf.telephone.replace(/\D/g, "").length < 9) {
      setMsg("Téléphone obligatoire (9 chiffres minimum).");
      return;
    }
    if (neuf.role === "pro" && !neuf.etablissement.trim()) {
      setMsg("Nom de l'établissement obligatoire.");
      return;
    }
    try {
      const d = await fetchAdmin("/api/admin/clients", { method: "POST", body: JSON.stringify(neuf) });
      setNeuf(VIDE_CLIENT);
      setCreation(false);
      setMsg("Compte créé ✓ — le client peut se connecter avec son numéro.");
      setType(neuf.role === "pro" ? "pro" : "patient");
      await charger();
      await ouvrir(d.id);
    } catch (e) {
      setMsg(e?.status === 409 ? "Un compte existe déjà avec ce téléphone ou cet email." : e?.message || "Création impossible.");
    }
  }

  async function charger() {
    try {
      const u = new URLSearchParams({ type });
      if (q.trim()) u.set("q", q.trim());
      const d = await fetchAdmin(`/api/admin/clients?${u}`);
      setClients(d.clients);
    } catch {
      setClients([]);
    }
  }
  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function ouvrir(id) {
    setMsg("");
    setEdition(false);
    try {
      setFiche(await fetchAdmin(`/api/admin/clients?id=${id}`));
    } catch {
      setMsg("Impossible d'ouvrir la fiche.");
    }
  }

  // Fiche complète à onglets : elle remplace la liste tant qu'elle est ouverte.
  if (fiche) {
    return (
      <FichePatient
        fiche={fiche}
        NotifierClient={NotifierClient}
        onFermer={() => setFiche(null)}
        onRecharger={async () => {
          await ouvrir(fiche.profil.id);
          await charger();
        }}
      />
    );
  }

  return (
    <>
      <div className="adm-barre-titre">
        <h1 className="adm-titre">Clients</h1>
        <button className="adm-btn" onClick={() => setCreation((c) => !c)}>{creation ? "Fermer" : "+ Créer un client"}</button>
      </div>

      {creation && (
        <div className="adm-fiche">
          <strong>Nouveau compte client</strong>
          <p className="fe-aide" style={{ marginTop: 4 }}>
            Le client se connectera avec son numéro de téléphone (code SMS). Téléphone obligatoire.
          </p>
          <div className="chips" style={{ margin: "10px 0" }}>
            <button type="button" className={"chip" + (neuf.role === "patient" ? " actif" : "")} onClick={() => setNeuf({ ...neuf, role: "patient" })}>👤 Patient</button>
            <button type="button" className={"chip" + (neuf.role === "pro" ? " actif" : "")} onClick={() => setNeuf({ ...neuf, role: "pro" })}>🏥 Établissement</button>
          </div>
          <div className="adm-grille-form">
            {neuf.role === "pro" ? (
              <input placeholder="Nom de l'établissement *" value={neuf.etablissement} onChange={(e) => setNeuf({ ...neuf, etablissement: e.target.value })} />
            ) : (
              <>
                <input placeholder="Prénom" value={neuf.prenom} onChange={(e) => setNeuf({ ...neuf, prenom: e.target.value })} />
                <input placeholder="Nom" value={neuf.nom} onChange={(e) => setNeuf({ ...neuf, nom: e.target.value })} />
              </>
            )}
            <input placeholder="Téléphone *" value={neuf.telephone} onChange={(e) => setNeuf({ ...neuf, telephone: e.target.value })} />
            <input placeholder="Email (facultatif)" value={neuf.email} onChange={(e) => setNeuf({ ...neuf, email: e.target.value })} />
            <input placeholder="Commune" value={neuf.commune} onChange={(e) => setNeuf({ ...neuf, commune: e.target.value })} />
            <input placeholder={neuf.role === "pro" ? "Contact (responsable)" : "Contact famille / proche"} value={neuf.contact} onChange={(e) => setNeuf({ ...neuf, contact: e.target.value })} />
          </div>
          <button className="adm-btn" style={{ marginTop: 10 }} onClick={creerClient}>Créer le compte</button>
        </div>
      )}
      {/* Uniquement les CLIENTS : patients ou établissements. Les employés
          sont dans Soignants / Transport, l'équipe interne dans Équipe. */}
      <div className="adm-supervision">
        <button className={"adm-chip-sup" + (type === "patient" ? " actif" : "")} onClick={() => { setFiche(null); setType("patient"); }}>
          👤 Patients
        </button>
        <button className={"adm-chip-sup" + (type === "pro" ? " actif" : "")} onClick={() => { setFiche(null); setType("pro"); }}>
          🏥 Établissements
        </button>
      </div>

      {type === "pro" && <GroupesPanel />}
      <div className="adm-filtres">
        <input
          placeholder="Rechercher par nom, téléphone, email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && charger()}
        />
        <button className="adm-btn" onClick={charger}>Rechercher</button>
      </div>
      {msg && <p className="adm-msg">{msg}</p>}
      {!clients && <p className="adm-vide">Chargement…</p>}
      {clients?.length === 0 && <p className="adm-vide">Aucun client trouvé.</p>}

      <div className="adm-liste">
        {clients?.map((c) => (
          <div className="adm-ligne cliquable" key={c.id} onClick={() => ouvrir(c.id)}>
            <Avatar mini nom={c.etablissement || [c.prenom, c.nom].filter(Boolean).join(" ")} />
            <span className="adm-ligne-texte">
              <strong>{c.etablissement || [c.prenom, c.nom].filter(Boolean).join(" ") || "Sans nom"}</strong>
              <small>
                {LIBELLE_ROLE[c.role] || c.role} · {c.telephone || "—"} · {c.email || "—"}
                {c.commune ? ` · ${c.commune}` : ""}
              </small>
            </span>
            <span className="adm-pastille">{(c.cree_le || "").slice(0, 10)}</span>
          </div>
        ))}
      </div>

    </>
  );
}

// Envoi d'un message officiel / notification au client (+ historique avec
// statut lu/non-lu/traité). Demande de document reliée à l'espace documents.
const TYPES_NOTIF = {
  message: "Message",
  document: "Demande de document",
  rdv: "Info rendez-vous",
  rappel: "Rappel",
};
const DOCS_NOTIF = {
  piece_identite: "Pièce d'identité",
  ordonnance: "Ordonnance",
  justificatif: "Justificatif",
  medical: "Document médical",
  autre: "Autre document",
};
const TITRES_DEFAUT = {
  message: "Message de l'équipe ASM",
  document: "Document demandé",
  rdv: "Mise à jour de votre rendez-vous",
  rappel: "Rappel ASM",
};
const STATUT_NOTIF = { NON_LU: "Non lu", LU: "Lu", TRAITEE: "Traité" };

function NotifierClient({ userId }) {
  const [envoyees, setEnvoyees] = useState(null);
  const [type, setType] = useState("message");
  const [docType, setDocType] = useState("piece_identite");
  const [titre, setTitre] = useState(TITRES_DEFAUT.message);
  const [corps, setCorps] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [retour, setRetour] = useState("");

  async function charger() {
    try {
      const d = await fetchAdmin(`/api/admin/notifications?userId=${encodeURIComponent(userId)}`);
      setEnvoyees(d.notifications);
    } catch {
      setEnvoyees([]);
    }
  }
  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function envoyer() {
    if (!titre.trim()) return;
    setOccupe(true);
    setRetour("");
    try {
      await fetchAdmin("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify({ userId, type, titre, corps, docType }),
      });
      setRetour("Notification envoyée ✓");
      setCorps("");
      await charger();
    } catch {
      setRetour("Erreur : envoi impossible.");
    } finally {
      setOccupe(false);
    }
  }

  async function traiter(id) {
    try {
      await fetchAdmin("/api/admin/notifications", {
        method: "PATCH",
        body: JSON.stringify({ id, statut: "TRAITEE" }),
      });
      await charger();
    } catch {}
  }

  return (
    <div className="adm-notes">
      <strong>Notifier ce client</strong>
      <div className="adm-grille-form" style={{ marginTop: 8 }}>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setTitre(TITRES_DEFAUT[e.target.value] || "");
          }}
        >
          {Object.entries(TYPES_NOTIF).map(([k, v]) => (
            <option value={k} key={k}>{v}</option>
          ))}
        </select>
        {type === "document" && (
          <select value={docType} onChange={(e) => setDocType(e.target.value)}>
            {Object.entries(DOCS_NOTIF).map(([k, v]) => (
              <option value={k} key={k}>{v}</option>
            ))}
          </select>
        )}
        <input placeholder="Titre *" value={titre} onChange={(e) => setTitre(e.target.value)} />
      </div>
      <input
        placeholder="Message (ex. Merci d'ajouter votre pièce d'identité.)"
        value={corps}
        onChange={(e) => setCorps(e.target.value)}
        style={{ marginTop: 8, width: "100%", padding: "11px 13px", fontSize: "14.5px", fontFamily: "inherit", border: "1px solid var(--ligne)", borderRadius: 10 }}
      />
      <button className="adm-btn" style={{ marginTop: 10 }} onClick={envoyer} disabled={occupe || !titre.trim()}>
        {occupe ? "Envoi…" : "Envoyer la notification"}
      </button>
      {retour && <p className="adm-msg">{retour}</p>}

      {envoyees?.length > 0 && (
        <>
          <strong style={{ display: "block", marginTop: 14 }}>Notifications envoyées</strong>
          <div className="adm-liste">
            {envoyees.map((n) => (
              <div className="adm-ligne" key={n.id}>
                <span>
                  <strong>{TYPES_NOTIF[n.type] || n.type} · {n.titre}</strong>
                  <small>
                    {new Date(n.creeLe).toLocaleString("fr-FR")} · {n.auteur || "—"}
                    {n.corps ? ` · ${n.corps.slice(0, 60)}` : ""}
                  </small>
                </span>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span className={"adm-pastille" + (n.statut === "NON_LU" ? " ko" : n.statut === "TRAITEE" ? " ok" : "")}>
                    {STATUT_NOTIF[n.statut] || n.statut}
                  </span>
                  {n.type === "document" && n.statut !== "TRAITEE" && (
                    <button className="adm-btn secondaire" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={() => traiter(n.id)}>
                      Reçu ✓
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Groupes multi-sites (superadmin) : relier plusieurs comptes pro pour
// que chacun voie les chiffres consolidés du groupe dans son espace.
// Le panneau se masque seul si le rôle n'y a pas droit (403 serveur).
function GroupesPanel() {
  const [donnees, setDonnees] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [choix, setChoix] = useState({}); // groupeId -> userId a ajouter
  const [msg, setMsg] = useState("");

  const charger = () =>
    fetchAdmin("/api/admin/groupes").then(setDonnees).catch(() => setDonnees({ interdit: true }));
  useEffect(() => { charger(); }, []);

  if (!donnees || donnees.interdit) return null;

  async function agir(corps, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return;
    setMsg("");
    try {
      await fetchAdmin("/api/admin/groupes", { method: "POST", body: JSON.stringify(corps) });
      await charger();
      setNom("");
    } catch (e) {
      setMsg(e?.data?.erreur === "membre_autre_groupe"
        ? "Ce compte appartient déjà à un autre groupe — retirez-le d'abord."
        : "Action impossible.");
    }
  }

  const dejaMembres = new Set(donnees.groupes.flatMap((g) => g.membres.map((m) => m.userId)));
  const libres = donnees.pros.filter((p) => !dejaMembres.has(p.id));

  return (
    <div className="adm-fiche" style={{ marginTop: 10 }}>
      <button className="adm-btn secondaire" onClick={() => setOuvert((o) => !o)}>
        🏢 Groupes multi-sites ({donnees.groupes.length}) {ouvert ? "▴" : "▾"}
      </button>
      {ouvert && (
        <div style={{ marginTop: 12 }}>
          <p className="fe-aide" style={{ marginTop: 0 }}>
            Un groupe relie plusieurs établissements (sites d&apos;une même enseigne) : chaque site
            voit alors les statistiques consolidées du groupe dans son espace pro.
          </p>
          {msg && <p className="adm-msg">{msg}</p>}
          <div className="adm-filtres">
            <input placeholder="Nom du nouveau groupe (ex. Cliniques El Azhar)" value={nom} onChange={(e) => setNom(e.target.value)} />
            <button className="adm-btn" disabled={nom.trim().length < 2} onClick={() => agir({ action: "creer", nom: nom.trim() })}>
              + Créer le groupe
            </button>
          </div>
          {donnees.groupes.map((g) => (
            <div key={g.id} style={{ border: "1px solid var(--ligne)", borderRadius: 10, padding: "10px 14px", marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong>{g.nom}</strong>
                <button className="fin-lien" onClick={() => agir({ action: "supprimer", groupeId: g.id }, `Supprimer le groupe « ${g.nom} » ? Les sites redeviennent indépendants.`)}>
                  Supprimer
                </button>
              </div>
              {g.membres.length === 0 && <p className="fe-aide">Aucun site pour l&apos;instant.</p>}
              {g.membres.map((m) => (
                <p key={m.userId} style={{ margin: "6px 0", fontSize: 14 }}>
                  🏥 {m.nom}{" "}
                  <button className="fin-lien" onClick={() => agir({ action: "retirer", userId: m.userId }, `Retirer « ${m.nom} » du groupe ?`)}>
                    retirer
                  </button>
                </p>
              ))}
              <div className="adm-filtres" style={{ marginTop: 8 }}>
                <select value={choix[g.id] || ""} onChange={(e) => setChoix({ ...choix, [g.id]: e.target.value })}>
                  <option value="">Ajouter un établissement…</option>
                  {libres.map((p) => (
                    <option value={p.id} key={p.id}>{p.nom}</option>
                  ))}
                </select>
                <button
                  className="adm-btn secondaire"
                  disabled={!choix[g.id]}
                  onClick={() => agir({ action: "ajouter", groupeId: g.id, userId: choix[g.id] })}
                >
                  Ajouter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
