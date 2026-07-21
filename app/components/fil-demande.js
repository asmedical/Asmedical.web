"use client";
import { useEffect, useRef, useState } from "react";
import { useAsm } from "@/app/providers";
import { supabase } from "@/lib/supabase";

// Fil de discussion d'une demande — partagé entre le patient, ses proches
// autorisés, l'établissement réservataire et l'équipe ASM. L'accès est
// vérifié côté serveur à chaque lecture et à chaque message.
export default function FilDemande({ demandeId }) {
  const { t } = useAsm();
  const [ouvert, setOuvert] = useState(false);
  const [messages, setMessages] = useState(null); // null = pas chargé
  const [refus, setRefus] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const corpsRef = useRef(null);

  const defiler = () => {
    requestAnimationFrame(() => {
      if (corpsRef.current) corpsRef.current.scrollTop = corpsRef.current.scrollHeight;
    });
  };

  async function charger() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`/api/messages?demande=${demandeId}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      if (r.status === 403) return setRefus(true);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setMessages(d.messages || []);
      defiler();
    } catch {
      setMessages([]);
    }
  }

  // Rafraîchissement léger tant que le fil est ouvert.
  useEffect(() => {
    if (!ouvert) return;
    charger();
    const minuteur = setInterval(charger, 20000);
    return () => clearInterval(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, demandeId]);

  async function envoyer() {
    const texte = saisie.trim();
    if (!texte || envoi) return;
    setEnvoi(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ demandeId, texte }),
      });
      if (!r.ok) throw new Error();
      setSaisie("");
      await charger();
    } catch {}
    setEnvoi(false);
  }

  if (refus) return null;

  if (!ouvert) {
    return (
      <p className="lien-bas" style={{ textAlign: "start", marginTop: 10 }}>
        <a onClick={() => setOuvert(true)}>💬 {t("fil_b")}</a>
      </p>
    );
  }

  return (
    <div className="fil-demande">
      <div className="fil-demande-tete">
        <strong>💬 {t("fil_t")}</strong>
        <button className="fin-lien" onClick={() => setOuvert(false)}>{t("fermer")}</button>
      </div>
      <p className="fil-demande-info">{t("fil_info")}</p>
      <div className="fil-demande-corps" ref={corpsRef}>
        {messages === null && <p className="fil-demande-vide">…</p>}
        {messages?.length === 0 && <p className="fil-demande-vide">{t("fil_vide")}</p>}
        {messages?.map((m) => (
          <div className={"fil-msg" + (m.deMoi ? " moi" : "") + (m.deEquipe ? " equipe" : "")} key={m.id}>
            {!m.deMoi && <small>{m.nomAuteur || (m.deEquipe ? "Équipe ASM" : "")}</small>}
            <span>{m.texte}</span>
          </div>
        ))}
      </div>
      <div className="fil-demande-saisie">
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && envoyer()}
          placeholder={t("fil_ph")}
          maxLength={1000}
        />
        <button className="btn-action" style={{ padding: "10px 16px" }} disabled={envoi || !saisie.trim()} onClick={envoyer}>
          {t("fil_envoyer")}
        </button>
      </div>
    </div>
  );
}
