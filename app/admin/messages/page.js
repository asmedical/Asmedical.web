"use client";
import { useEffect, useRef, useState } from "react";
import { fetchAdmin } from "../ui";

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
      <h1 className="adm-titre">Messages</h1>
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
