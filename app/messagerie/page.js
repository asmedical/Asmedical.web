"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAsm } from "@/app/providers";
import { supabase } from "@/lib/supabase";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";
import { IcoBulle, IcoEnvoyer } from "@/app/components/icones";

// Messagerie réelle patient/établissement ↔ équipe ASM.
// Le fil est rattaché au compte connecté ; rafraîchi automatiquement.
async function jeton() {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export default function Messagerie() {
  const { t, connecte } = useAsm();
  const [etat, setEtat] = useState("chargement"); // chargement | anonyme | pret | erreur
  const [messages, setMessages] = useState([]);
  const [saisie, setSaisie] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState("");
  const finRef = useRef(null);
  const nbRef = useRef(0);

  async function charger(defile) {
    const token = await jeton();
    if (!token) {
      setEtat("anonyme");
      return;
    }
    try {
      const r = await fetch("/api/messages", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setMessages(d.messages || []);
      setEtat("pret");
      if (defile || (d.messages || []).length !== nbRef.current) {
        nbRef.current = (d.messages || []).length;
        requestAnimationFrame(() => finRef.current?.scrollIntoView({ block: "end" }));
      }
    } catch {
      setEtat((e) => (e === "pret" ? "pret" : "erreur"));
    }
  }

  useEffect(() => {
    charger(true);
    const minuteur = setInterval(() => charger(false), 15000);
    return () => clearInterval(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecte]);

  async function envoyer() {
    const texte = saisie.trim();
    if (!texte || envoi) return;
    setEnvoi(true);
    setErreurEnvoi("");
    try {
      const token = await jeton();
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ texte }),
      });
      if (!r.ok) throw new Error();
      setSaisie("");
      await charger(true);
    } catch {
      setErreurEnvoi(t("msg_err_envoi"));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 520 }}>
        <h2 className="titre-page">{t("msg_t")}</h2>
        <p className="sous-page">{t("msg_s")}</p>

        {etat === "chargement" && <p className="sous-page">{t("compte_charge")}</p>}

        {etat === "anonyme" && (
          <div className="etat-vide">
            <p>{t("msg_connexion")}</p>
            <Link className="btn-action" style={{ marginTop: 14 }} href="/connexion">
              {t("connexion_t")}
            </Link>
          </div>
        )}

        {etat === "erreur" && (
          <div className="etat-vide">
            <p>{t("err_serveur")} {TEL_AFFICHE}.</p>
          </div>
        )}

        {etat === "pret" && (
          <>
            <div className="fil-messages">
              {messages.length === 0 && (
                <div className="etat-vide" style={{ margin: "auto 0" }}>
                  <span className="ico-service" style={{ margin: "0 auto 12px" }}>
                    <IcoBulle />
                  </span>
                  <p>{t("msg_bienvenue")}</p>
                </div>
              )}
              {messages.map((m) => (
                <div className={"bulle-msg" + (m.deEquipe ? " equipe" : " moi")} key={m.id}>
                  {m.deEquipe && <small className="bulle-auteur">{t("equipe")}</small>}
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
                placeholder={t("msg_ph")}
                value={saisie}
                maxLength={1000}
                onChange={(e) => setSaisie(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && envoyer()}
              />
              <button onClick={envoyer} disabled={envoi || !saisie.trim()} aria-label={t("msg_envoyer")}>
                <IcoEnvoyer />
              </button>
            </div>
            {erreurEnvoi && <p className="erreur">{erreurEnvoi}</p>}
            <p className="msg-note">
              {t("msg_urgence")} <a href={TEL_LIEN}>{TEL_AFFICHE}</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
