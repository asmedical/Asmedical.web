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
      <h1 className="adm-titre">Clients</h1>
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
