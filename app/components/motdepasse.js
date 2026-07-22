"use client";
import { useState } from "react";

// Champ mot de passe avec œil pour afficher / masquer la saisie.
// S'utilise EXACTEMENT comme un <input> (mêmes props : value, onChange,
// placeholder, autoFocus, onKeyDown…) — elles sont transmises telles quelles.
export default function ChampMotDePasse(props) {
  const [voir, setVoir] = useState(false);
  return (
    <span className="champ-mdp">
      <input {...props} type={voir ? "text" : "password"} />
      <button
        type="button"
        className="mdp-oeil"
        onClick={() => setVoir((v) => !v)}
        aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={voir}
        tabIndex={-1}
      >
        {voir ? (
          // œil barré
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          // œil
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </span>
  );
}
