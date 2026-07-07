"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAsm } from "@/app/providers";
import { supabase } from "@/lib/supabase";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";
import { IcoBulle, IcoEnvoyer, IcoDocument, IcoCalendrier, IcoCloche } from "@/app/components/icones";

// « Ma messagerie » : centre de messages officiels ASM (notifications,
// demandes de documents, infos rendez-vous) + chat instantané avec
// l'équipe (design conservé), accessible via la carte dédiée.
async function jeton() {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

const ICO_TYPE = { message: IcoBulle, document: IcoDocument, rdv: IcoCalendrier, rappel: IcoCloche };

export default function Messagerie() {
  const { t, connecte, nonLus, rafraichirNonLus } = useAsm();
  const [vue, setVue] = useState("centre"); // centre | chat
  const [etat, setEtat] = useState("chargement"); // chargement | anonyme | pret | erreur
  const [notifications, setNotifications] = useState([]);
  const [ouverte, setOuverte] = useState(null); // id notification dépliée

  async function chargerNotifs() {
    const token = await jeton();
    if (!token) {
      setEtat("anonyme");
      return;
    }
    try {
      const r = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setNotifications(d.notifications || []);
      setEtat("pret");
    } catch {
      setEtat((e) => (e === "pret" ? "pret" : "erreur"));
    }
  }

  useEffect(() => {
    chargerNotifs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecte]);

  async function ouvrir(n) {
    setOuverte(ouverte === n.id ? null : n.id);
    if (n.statut === "NON_LU") {
      const token = await jeton();
      try {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: n.id }),
        });
        setNotifications((liste) =>
          liste.map((x) => (x.id === n.id ? { ...x, statut: "LU" } : x))
        );
        rafraichirNonLus();
      } catch {}
    }
  }

  if (vue === "chat") {
    return <Chat retour={() => { setVue("centre"); rafraichirNonLus(); }} t={t} />;
  }

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 520 }}>
        <h2 className="titre-page">{t("mamsg_t")}</h2>
        <p className="sous-page">{t("mamsg_s")}</p>

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
            {/* ---- Carte d'accès au chat instantané (design conservé) ---- */}
            <button className="carte-chat" onClick={() => setVue("chat")}>
              <span className="ico-service">
                <IcoBulle />
              </span>
              <span>
                <strong>{t("chat_carte_t")}</strong>
                <small>{t("chat_carte_s")}</small>
              </span>
              {(nonLus?.chat || 0) > 0 && <span className="badge-nonlu">{nonLus.chat}</span>}
            </button>

            {/* ---- Messages officiels ASM ---- */}
            <div className="titre-section">{t("notif_section")}</div>
            {notifications.length === 0 && (
              <div className="etat-vide">
                <p>{t("notif_vide")}</p>
              </div>
            )}
            {notifications.map((n) => {
              const Icone = ICO_TYPE[n.type] || IcoBulle;
              const nonLue = n.statut === "NON_LU";
              return (
                <div
                  className={"carte-notif" + (nonLue ? " nonlue" : "")}
                  key={n.id}
                  onClick={() => ouvrir(n)}
                >
                  <span className="ico-service">
                    <Icone />
                  </span>
                  <span className="notif-corps">
                    <strong>
                      {nonLue && <span className="point-nonlu" aria-hidden="true" />}
                      {n.titre}
                    </strong>
                    <small>
                      {new Date(n.creeLe).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      {n.type === "document" ? ` · ${t("notif_doc_tag")}` : ""}
                    </small>
                    {ouverte === n.id && (
                      <span className="notif-detail">
                        {n.corps && <p>{n.corps}</p>}
                        {n.type === "document" && (
                          <Link className="btn-action" style={{ marginTop: 10 }} href="/documentation">
                            {t("notif_envoyer_doc")}
                          </Link>
                        )}
                        {n.statut === "TRAITEE" && <p className="notif-traitee">{t("notif_traitee")} ✓</p>}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}

            <p className="msg-note">
              {t("msg_urgence")} <a href={TEL_LIEN}>{TEL_AFFICHE}</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ---- Chat instantané — design et logique conservés à l'identique ----
function Chat({ retour, t }) {
  const [etat, setEtat] = useState("chargement");
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
  }, []);

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
        <button className="btn-retour" onClick={retour}>
          {t("retour")}
        </button>
        <h2 className="titre-page">{t("msg_t")}</h2>
        <p className="sous-page">{t("msg_s")}</p>

        {etat === "chargement" && <p className="sous-page">{t("compte_charge")}</p>}
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
