"use client";
import { useEffect, useRef, useState } from "react";
import { useAsm } from "@/app/providers";

// Champ d'adresse intelligent (Google Places New via NOTRE serveur — la clé
// ne quitte jamais le serveur). Suggestions en temps réel : rues, villes,
// établissements de santé, coordonnées GPS. Sans clé configurée, le champ
// reste un champ libre ordinaire (aucune régression).
//
// Coûts maîtrisés : saisie « debouncée » (400 ms), minimum 3 caractères,
// jeton de session Places (suggestions + détail = une seule session facturée).

let PLACES_ACTIF = null; // mémo global : évite de re-tester à chaque champ

export default function ChampAdresse({ label, valeur, onChange, onLieu, placeholder, requis }) {
  const { langue } = useAsm();
  const [suggestions, setSuggestions] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const jeton = useRef(null);
  const minuteur = useRef(null);
  const ref = useRef(null);

  // Fermeture au clic extérieur.
  useEffect(() => {
    const fermer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOuvert(false);
    };
    document.addEventListener("pointerdown", fermer);
    return () => document.removeEventListener("pointerdown", fermer);
  }, []);

  function saisir(texte) {
    onChange(texte);
    onLieu?.(null); // toute retouche invalide les coordonnées précédentes
    if (PLACES_ACTIF === false) return;
    clearTimeout(minuteur.current);
    if (texte.trim().length < 3) {
      setSuggestions(null);
      setOuvert(false);
      return;
    }
    minuteur.current = setTimeout(async () => {
      try {
        if (!jeton.current) jeton.current = crypto.randomUUID();
        const r = await fetch(
          `/api/geo?type=suggestions&q=${encodeURIComponent(texte.trim())}&jeton=${jeton.current}&langue=${langue}`
        );
        const d = await r.json();
        if (d.actif === false) {
          PLACES_ACTIF = false;
          return;
        }
        PLACES_ACTIF = true;
        setSuggestions(d.suggestions || []);
        setOuvert((d.suggestions || []).length > 0);
      } catch {}
    }, 400);
  }

  async function choisir(s) {
    setOuvert(false);
    const texte = [s.principal, s.secondaire].filter(Boolean).join(", ");
    onChange(texte);
    if (s.coords) {
      onLieu?.(s.coords);
      jeton.current = null;
      return;
    }
    try {
      const r = await fetch(`/api/geo?type=lieu&id=${encodeURIComponent(s.id)}&jeton=${jeton.current}&langue=${langue}`);
      const d = await r.json();
      if (d.lieu) {
        onLieu?.(d.lieu);
        if (d.lieu.adresse) onChange(d.lieu.adresse);
      }
    } catch {}
    jeton.current = null; // la session Places se termine au choix du lieu
  }

  return (
    <div className="champ champ-adresse" ref={ref}>
      <label>{label}{requis ? " *" : ""}</label>
      <input
        value={valeur}
        onChange={(e) => saisir(e.target.value)}
        onFocus={() => suggestions?.length && setOuvert(true)}
        placeholder={placeholder}
        autoComplete="off"
        required={requis}
      />
      {ouvert && suggestions?.length > 0 && (
        <div className="adresse-suggestions" role="listbox">
          {suggestions.map((s, i) => (
            <button type="button" key={s.id || i} role="option" onClick={() => choisir(s)}>
              <strong>{s.principal}</strong>
              {s.secondaire && <small>{s.secondaire}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
