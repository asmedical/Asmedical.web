"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE } from "@/lib/i18n";
import { libelleAction, CIBLES_ACTION } from "@/lib/assistantScenarios";
import { IcoBulleAssistant, IcoEnvoyer } from "@/app/components/icones";

// Assistant conversationnel ASM. Il parle à l'API /api/assistant : côté serveur,
// une vraie IA (Claude) répond en comprenant le langage libre ET le contexte
// réel du client (ses demandes) ; si la clé IA n'est pas configurée, le serveur
// bascule tout seul sur un moteur guidé. Le composant ne connaît aucune clé.
export function Assistant() {
  const { t, langue, connecte, choisirService } = useAsm();
  const routeur = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [messages, setMessages] = useState([]);
  const [saisie, setSaisie] = useState("");
  const [chargement, setChargement] = useState(false);
  const corpsRef = useRef(null);
  // Mémoire de conversation envoyée à l'IA pour qu'elle garde le fil.
  const histoRef = useRef([]);

  const defiler = () => {
    requestAnimationFrame(() => {
      if (corpsRef.current) corpsRef.current.scrollTop = corpsRef.current.scrollHeight;
    });
  };

  const ajouter = (msg) => {
    setMessages((m) => [...m, msg]);
    defiler();
  };

  const reserver = (service) => {
    setOuvert(false);
    choisirService(service);
    routeur.push(connecte ? "/rdv" : "/connexion?gate=1");
  };

  const jeton = async () => {
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || "";
    } catch {
      return "";
    }
  };

  // Envoie le message à l'IA (le serveur choisit IA ou repli guidé). Le caller
  // affiche déjà la bulle « moi » ; ici on gère le contexte + la réponse.
  const demander = async (texte) => {
    const historique = histoRef.current.slice(-8);
    histoRef.current.push({ role: "user", content: texte });
    setChargement(true);
    defiler();
    let rep = null;
    try {
      const token = await jeton();
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: texte, historique, langue }),
      });
      rep = await r.json();
    } catch {}
    setChargement(false);

    if (!rep || !rep.reponse) {
      ajouter({
        type: "bot",
        txt:
          langue === "ar"
            ? `عذراً، تعذّر الرد الآن. اتصلوا بنا على ${TEL_AFFICHE}، على مدار الأسبوع.`
            : `Désolé, je n'ai pas pu répondre à l'instant. Appelez-nous au ${TEL_AFFICHE}, 7j/7.`,
      });
      ajouter({ type: "rapides" });
      return;
    }
    histoRef.current.push({ role: "assistant", content: rep.reponse });
    ajouter({ type: "bot", txt: rep.reponse });
    // Bouton d'action utile sous la réponse (jamais pour « appeler » : le
    // numéro figure déjà dans le texte).
    if (rep.action && rep.action !== "appeler") ajouter({ type: "action", action: rep.action });
    ajouter({ type: "rapides" });
  };

  const reponsesRapides = () => [
    {
      txt: langue === "ar" ? "حجز نقل" : "Réserver un transport",
      action: () => reserver("transport"),
    },
    {
      txt: langue === "ar" ? "مساعدة منزلية" : "Aide à domicile",
      action: () => reserver("domicile"),
    },
    {
      txt: langue === "ar" ? "توصيل الأدوية" : "Livraison de médicaments",
      action: () => reserver("medicaments"),
    },
    {
      txt: langue === "ar" ? "تتبع طلبي" : "Suivre ma demande",
      action: () => {
        setOuvert(false);
        routeur.push("/suivi");
      },
    },
    {
      txt: langue === "ar" ? "التسعيرة" : "Les tarifs",
      action: () => demander(langue === "ar" ? "ما هي الأسعار؟" : "Quels sont vos tarifs ?"),
    },
    {
      txt: langue === "ar" ? "الحجز لقريب" : "Réserver pour un proche",
      action: () =>
        demander(langue === "ar" ? "كيف أحجز لقريب؟" : "Comment réserver pour un proche ?"),
    },
    {
      txt: langue === "ar" ? "التحدث إلى شخص" : "Parler à quelqu'un",
      action: () =>
        ajouter({
          type: "bot",
          txt:
            langue === "ar"
              ? `بالطبع! اتصلوا بنا على ${TEL_AFFICHE}، على مدار الأسبوع.`
              : `Bien sûr ! Appelez-nous au ${TEL_AFFICHE}, 7j/7.`,
        }),
    },
  ];

  const ouvrir = () => {
    setOuvert(true);
    if (messages.length === 0) {
      setMessages([
        {
          type: "bot",
          txt:
            langue === "ar"
              ? "سلام، مرحباً! 👋 أنا مساعد ASM. كيف أساعدك؟"
              : "Salam, bonjour ! 👋 Je suis l'assistant ASM. Comment puis-je vous aider ?",
        },
        { type: "rapides" },
      ]);
    }
    defiler();
  };

  const choisirRapide = (r) => {
    if (r.txt) ajouter({ type: "moi", txt: r.txt });
    setTimeout(r.action, 300);
  };

  const envoyer = () => {
    const texte = saisie.trim();
    if (!texte || chargement) return;
    ajouter({ type: "moi", txt: texte });
    setSaisie("");
    demander(texte);
  };

  const suivreAction = (action) => {
    setOuvert(false);
    const cible = CIBLES_ACTION[action];
    if (!cible) return;
    routeur.push(
      connecte || ["packs", "abonnements", "devis", "connexion"].includes(action)
        ? cible
        : "/connexion?gate=1"
    );
  };

  return (
    <>
      {!ouvert && (
        <button className="bulle-assistant" onClick={ouvrir} aria-label="Ouvrir l'assistant ASM">
          <IcoBulleAssistant />
        </button>
      )}
      <div
        className={"fenetre-chat" + (ouvert ? " ouverte" : "")}
        role="dialog"
        aria-label="Assistant ASM"
      >
        <div className="chat-tete">
          <span className="avatar" aria-hidden="true">
            <Image src="/logo-asm.jpg" alt="" width={38} height={38} />
          </span>
          <span>
            <strong>Assistant ASM</strong>
            <small>{t("en_ligne")}</small>
          </span>
          <button className="chat-fermer" onClick={() => setOuvert(false)} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="chat-corps" ref={corpsRef}>
          {messages.map((m, i) =>
            m.type === "rapides" ? (
              <div className="reponses-rapides" key={i}>
                {reponsesRapides().map((r) => (
                  <button key={r.txt} onClick={() => choisirRapide(r)}>
                    {r.txt}
                  </button>
                ))}
              </div>
            ) : m.type === "action" ? (
              <div className="reponses-rapides" key={i}>
                <button onClick={() => suivreAction(m.action)}>
                  → {libelleAction(m.action, langue)}
                </button>
              </div>
            ) : (
              <div className={"msg " + m.type} key={i}>
                {m.txt}
              </div>
            )
          )}
          {chargement && (
            <div className="msg bot" aria-live="polite">
              <span className="chat-ecrit">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          )}
        </div>
        <div className="chat-saisie">
          <input
            type="text"
            placeholder={t("chat_ph")}
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && envoyer()}
            disabled={chargement}
          />
          <button onClick={envoyer} aria-label="Envoyer" disabled={chargement}>
            <IcoEnvoyer />
          </button>
        </div>
      </div>
    </>
  );
}
