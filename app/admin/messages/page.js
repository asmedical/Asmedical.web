"use client";
import { useEffect, useRef, useState } from "react";
import { fetchAdmin } from "../ui";

const GROUPES = [
  ["aides_soignants", "Tous les aides-soignants"],
  ["infirmiers", "Tous les infirmiers"],
  ["soignants", "Tous les soignants"],
  ["chauffeurs", "Tous les chauffeurs / transporteurs"],
  ["employes", "Tous les employés"],
];

// Diffusion proactive : message et/ou notification à un groupe d'employés.
function Diffusion() {
  const [ouvert, setOuvert] = useState(false);
  const [groupe, setGroupe] = useState("aides_soignants");
  const [canal, setCanal] = useState("les_deux");
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [retour, setRetour] = useState("");

  async function envoyer() {
    if (!texte.trim()) return;
    setOccupe(true);
    setRetour("");
    try {
      const d = await fetchAdmin("/api/admin/diffusion", {
        method: "POST",
        body: JSON.stringify({ cible: "groupe", groupe, canal, titre, texte }),
      });
      setRetour(`Envoyé à ${d.envoyes} destinataire${d.envoyes > 1 ? "s" : ""} ✓`);
      setTexte("");
      setTitre("");
    } catch (e) {
      setRetour(e?.status === 400 ? "Aucun destinataire dans ce groupe (aucun compte lié)." : "Envoi impossible.");
    }
    setOccupe(false);
  }

  if (!ouvert) return <button className="adm-btn" onClick={() => setOuvert(true)}>+ Diffusion groupe</button>;

  return (
    <div className="adm-fiche" style={{ width: "100%", marginTop: 12 }}>
      <strong>Diffusion à un groupe</strong>
      <div className="adm-grille-form">
        <label className="fe-champ"><span>Destinataires</span>
          <select value={groupe} onChange={(e) => setGroupe(e.target.value)}>
            {GROUPES.map(([k, v]) => <option value={k} key={k}>{v}</option>)}
          </select>
        </label>
        <label className="fe-champ"><span>Canal</span>
          <select value={canal} onChange={(e) => setCanal(e.target.value)}>
            <option value="les_deux">Message + notification</option>
            <option value="message">Message (chat) seulement</option>
            <option value="notification">Notification seulement</option>
          </select>
        </label>
      </div>
      {canal !== "message" && (
        <input placeholder="Titre de la notification (ex. Réunion d'équipe)" value={titre} onChange={(e) => setTitre(e.target.value)} style={{ width: "100%", marginTop: 8 }} />
      )}
      <textarea rows={3} placeholder="Votre message à l'équipe…" value={texte} onChange={(e) => setTexte(e.target.value)} style={{ width: "100%", marginTop: 8, padding: "11px 13px", fontFamily: "inherit", fontSize: 14.5, border: "1px solid var(--ligne)", borderRadius: 10 }} />
      {retour && <p className="adm-msg">{retour}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className={"adm-btn" + (occupe ? " btn-charge" : "")} onClick={envoyer} disabled={occupe || !texte.trim()}>Envoyer</button>
        <button className="adm-btn secondaire" onClick={() => setOuvert(false)}>Fermer</button>
      </div>
    </div>
  );
}

// Boîte de réception de l'équipe : conversations (non-lus en tête de liste),
// fil complet et réponse. Rafraîchie automatiquement.
export default function PageMessages() {
  const [conversations, setConversations] = useState(null);
  const [ouvert, setOuvert] = useState(null); // userId
  const [messages, setMessages] = useState([]);
  const [saisie, setSaisie] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState("");
  const finRef = useRef(null);

  async function chargerListe() {
    try {
      const d = await fetchAdmin("/api/admin/messages");
      setConversations(d.conversations);
    } catch {
      setConversations([]);
    }
  }

  async function chargerFil(userId, defile) {
    try {
      const d = await fetchAdmin(`/api/admin/messages?userId=${encodeURIComponent(userId)}`);
      setMessages(d.messages || []);
      if (defile) requestAnimationFrame(() => finRef.current?.scrollIntoView({ block: "end" }));
    } catch {}
  }

  useEffect(() => {
    chargerListe();
    const minuteur = setInterval(() => {
      chargerListe();
      if (ouvert) chargerFil(ouvert, false);
    }, 20000);
    return () => clearInterval(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  async function ouvrir(userId) {
    setOuvert(userId);
    setMessages([]);
    await chargerFil(userId, true);
    await chargerListe(); // met à jour les badges non-lus
  }

  async function repondre() {
    const texte = saisie.trim();
    if (!texte || envoi || !ouvert) return;
    setEnvoi(true);
    setMsg("");
    try {
      await fetchAdmin("/api/admin/messages", {
        method: "POST",
        body: JSON.stringify({ userId: ouvert, texte }),
      });
      setSaisie("");
      await chargerFil(ouvert, true);
    } catch {
      setMsg("Erreur : envoi impossible.");
    } finally {
      setEnvoi(false);
    }
  }

  const conv = conversations?.find((c) => c.userId === ouvert);

  return (
    <>
      <div className="adm-barre-titre">
        <h1 className="adm-titre">Messages</h1>
        {!ouvert && <Diffusion />}
      </div>
      {msg && <p className="adm-msg">{msg}</p>}
      {!conversations && <p className="adm-vide">Chargement…</p>}
      {conversations?.length === 0 && (
        <p className="adm-vide">Aucune conversation pour l&apos;instant. Les messages des patients arriveront ici.</p>
      )}

      {!ouvert && (
        <div className="adm-liste">
          {conversations?.map((c) => (
            <div className="adm-ligne cliquable" key={c.userId} onClick={() => ouvrir(c.userId)}>
              <span>
                <strong>{c.nom}</strong>
                <small>
                  {c.dernier ? (c.dernier.deEquipe ? "Vous : " : "") + c.dernier.texte.slice(0, 60) : "—"}
                  {c.dernier ? ` · ${new Date(c.dernier.creeLe).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
                </small>
              </span>
              {c.nonLus > 0 && <span className="adm-badge-nonlu">{c.nonLus}</span>}
            </div>
          ))}
        </div>
      )}

      {ouvert && (
        <div className="adm-fiche">
          <div className="adm-barre-titre">
            <strong>{conv?.nom || "Conversation"}</strong>
            <span>
              {conv?.telephone && (
                <a className="adm-btn secondaire" href={`tel:${conv.telephone}`} style={{ marginInlineEnd: 8, textDecoration: "none" }}>
                  Appeler
                </a>
              )}
              <button className="adm-btn secondaire" onClick={() => setOuvert(null)}>← Conversations</button>
            </span>
          </div>

          <div className="fil-messages adm-fil">
            {messages.length === 0 && <p className="adm-vide">Chargement du fil…</p>}
            {messages.map((m) => (
              <div className={"bulle-msg" + (m.deEquipe ? " moi" : " equipe")} key={m.id}>
                {m.deEquipe && m.auteur && <small className="bulle-auteur">{m.auteur}</small>}
                <p>{m.texte}</p>
                <small className="bulle-heure">
                  {new Date(m.creeLe).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </small>
              </div>
            ))}
            <div ref={finRef} />
          </div>

          <div className="msg-saisie">
            <input
              type="text"
              placeholder="Votre réponse…"
              value={saisie}
              maxLength={1000}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && repondre()}
            />
            <button onClick={repondre} disabled={envoi || !saisie.trim()}>
              Envoyer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
