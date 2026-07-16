"use client";
import { useState } from "react";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE, TEL_LIEN, WHATSAPP_LIEN } from "@/lib/i18n";

// Bouton « Appelez-nous » avec logo WhatsApp : un appui ouvre le choix
// entre l'appel téléphonique classique et WhatsApp (appel/message).
// S'utilise partout où figurait le simple lien tel: — même rendu texte,
// icône WhatsApp en plus.

export function IcoWhatsApp({ taille = 17 }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" style={{ verticalAlign: "-3px" }}>
      <path
        fill="#25D366"
        d="M12 2a9.9 9.9 0 0 0-8.5 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2Z"
      />
      <path
        fill="#25D366"
        d="M16.6 14.5c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.1-.7l.4-.5c.1-.2.2-.3.3-.5v-.5c0-.1-.5-1.4-.7-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.4-.4Z"
      />
    </svg>
  );
}

export default function ChoixAppel({ children, className, style }) {
  const { t } = useAsm();
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className={className}
        style={{
          // Sans classe : rendu « lien » qui hérite du texte. Avec classe
          // (btn-action, aide-option…) : on laisse la classe habiller.
          ...(className
            ? { cursor: "pointer", font: "inherit" }
            : {
                background: "none", border: "none", padding: 0, cursor: "pointer",
                font: "inherit", color: "inherit", textDecoration: "underline",
                display: "inline-flex", alignItems: "center", gap: 5,
              }),
          ...style,
        }}
      >
        {children || TEL_AFFICHE} <IcoWhatsApp />
      </button>

      {ouvert && (
        <div
          onClick={() => setOuvert(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(20,30,25,.45)",
            zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--blanc, #fff)", borderRadius: "18px 18px 0 0",
              padding: "20px 18px 26px", width: "100%", maxWidth: 480,
              boxShadow: "0 -8px 30px rgba(0,0,0,.18)",
            }}
          >
            <p style={{ textAlign: "center", fontWeight: 800, margin: "0 0 14px", color: "var(--encre, #22332C)" }}>
              {t("appel_t")}
            </p>
            <a
              href={WHATSAPP_LIEN}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOuvert(false)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                background: "#25D366", color: "#fff", fontWeight: 800, fontSize: 16,
                borderRadius: 12, padding: "14px 16px", textDecoration: "none", marginBottom: 10,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#fff" d="M12 2a9.9 9.9 0 0 0-8.5 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm4.6 12.5c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.1-.7l.4-.5c.1-.2.2-.3.3-.5v-.5c0-.1-.5-1.4-.7-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.4-.4Z" />
              </svg>
              {t("appel_whatsapp")}
            </a>
            <a
              href={TEL_LIEN}
              onClick={() => setOuvert(false)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                background: "var(--vert, #0E6B3F)", color: "#fff", fontWeight: 800, fontSize: 16,
                borderRadius: 12, padding: "14px 16px", textDecoration: "none", marginBottom: 10,
              }}
            >
              📞 {t("appel_normal")} · {TEL_AFFICHE}
            </a>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              style={{
                display: "block", width: "100%", background: "none", border: "none",
                color: "var(--gris, #6B7A72)", fontWeight: 700, fontSize: 15, padding: 10, cursor: "pointer",
              }}
            >
              {t("annuler")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
