"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE } from "@/lib/i18n";
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
      txt: langue === "ar" ? "التسعيرة" : "Les tarifs",
      action: () =>
        ajouter({
          type: "bot",
          txt:
            langue === "ar"
              ? "تعتمد الأسعار على المسافة والخدمة. يعطيك المستشار السعر الدقيق عند معاودة الاتصال المجانية. بعض الرحلات تغطيها CNAS."
              : "Les tarifs dépendent du trajet et du service. Un conseiller vous donne le prix exact lors du rappel gratuit. Certains transports sont remboursés par la CNAS.",
        }),
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
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          type: "bot",
          txt:
            langue === "ar"
              ? `سجّلت سؤالك! للحصول على رد دقيق، اتصل على ${TEL_AFFICHE} أو اترك رقمك — نعاود الاتصال خلال أقل من 30 دقيقة.`
              : `Je note votre question ! Pour une réponse précise, appelez le ${TEL_AFFICHE} ou laissez votre numéro — un conseiller vous rappelle en moins de 30 minutes.`,
        },
        { type: "rapides" },
      ]);
      defiler();
    }, 500);
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
