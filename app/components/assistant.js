"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE } from "@/lib/i18n";
import { repondreAssistant, libelleAction, CIBLES_ACTION } from "@/lib/assistantScenarios";
import { IcoBulleAssistant, IcoEnvoyer } from "@/app/components/icones";

// Assistant conversationnel (réponses guidées, bilingue, repli vers l'appel).
// L'abstraction reste simple pour pouvoir brancher une vraie IA plus tard.
export function Assistant() {
  const { t, langue, connecte, choisirService } = useAsm();
  const routeur = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [messages, setMessages] = useState([]);
  const [saisie, setSaisie] = useState("");
  const corpsRef = useRef(null);

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

  // Une réponse du moteur de scénarios → bulle + bouton d'action éventuel.
  const repondre = (texteUtilisateur) => {
    const rep = repondreAssistant(texteUtilisateur, langue);
    ajouter({ type: "bot", txt: rep.txt });
    if (rep.action && rep.action !== "appeler" && CIBLES_ACTION[rep.action]) {
      ajouter({ type: "action", action: rep.action });
    }
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
      action: () => repondre(langue === "ar" ? "سعر" : "prix"),
    },
    {
      txt: langue === "ar" ? "الحجز لقريب" : "Réserver pour un proche",
      action: () => repondre(langue === "ar" ? "قريب" : "proche"),
    },
    {
      txt: langue === "ar" ? "التحدث إلى شخص" : "Parler à quelqu'un",
      action: () =>
        ajouter({
          type: "bot",
          txt:
            langue === "ar"
              ? `بالطبع! اتصل بنا على ${TEL_AFFICHE}، على مدار الأسبوع.`
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
    ajouter({ type: "moi", txt: r.txt });
    setTimeout(r.action, 350);
  };

  const envoyer = () => {
    const texte = saisie.trim();
    if (!texte) return;
    ajouter({ type: "moi", txt: texte });
    setSaisie("");
    // Le moteur de scénarios reconnaît l'intention (FR/AR) et propose
    // l'action utile ; sans correspondance, il oriente vers un humain.
    setTimeout(() => repondre(texte), 450);
  };

  const suivreAction = (action) => {
    setOuvert(false);
    routeur.push(connecte || ["packs", "devis", "connexion"].includes(action) ? CIBLES_ACTION[action] : "/connexion?gate=1");
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
        </div>
        <div className="chat-saisie">
          <input
            type="text"
            placeholder={t("chat_ph")}
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && envoyer()}
          />
          <button onClick={envoyer} aria-label="Envoyer">
            <IcoEnvoyer />
          </button>
        </div>
      </div>
    </>
  );
}
