// Champ d'adresse intelligent (mobile) — suggestions Google Places via NOTRE
// serveur (/api/geo). La clé Google ne quitte jamais le serveur ; aucun SDK
// natif requis. Sans clé configurée, le champ reste un champ texte ordinaire.
// Coûts maîtrisés : saisie « debouncée » (400 ms), minimum 3 caractères, jeton
// de session Places (suggestions + détail = une seule session facturée).
import React, { useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { C, S } from "./theme";
import { useLangue } from "./i18n";
import { apiGet } from "./api";

let PLACES_ACTIF = null; // mémo global : évite de re-tester à chaque champ

function nouveauJeton() {
  return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export default function ChampAdresse({ label, valeur, onChange, onLieu, placeholder, requis }) {
  const { langue } = useLangue();
  const [suggestions, setSuggestions] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const jeton = useRef(null);
  const minuteur = useRef(null);

  function saisir(texte) {
    onChange(texte);
    onLieu?.(null); // toute retouche invalide les coordonnées précédentes
    if (PLACES_ACTIF === false) return;
    clearTimeout(minuteur.current);
    if (texte.trim().length < 3) {
      setSuggestions([]);
      setOuvert(false);
      return;
    }
    minuteur.current = setTimeout(async () => {
      try {
        if (!jeton.current) jeton.current = nouveauJeton();
        const d = await apiGet(
          `/api/geo?type=suggestions&q=${encodeURIComponent(texte.trim())}&jeton=${jeton.current}&langue=${langue}`
        );
        if (d?.actif === false) {
          PLACES_ACTIF = false;
          return;
        }
        PLACES_ACTIF = true;
        const liste = d?.suggestions || [];
        setSuggestions(liste);
        setOuvert(liste.length > 0);
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
      const d = await apiGet(`/api/geo?type=lieu&id=${encodeURIComponent(s.id)}&jeton=${jeton.current}&langue=${langue}`);
      if (d?.lieu) {
        onLieu?.(d.lieu);
        if (d.lieu.adresse) onChange(d.lieu.adresse);
      }
    } catch {}
    jeton.current = null; // la session Places se termine au choix du lieu
  }

  return (
    <View>
      {label ? <Text style={S.label}>{label}{requis ? " *" : ""}</Text> : null}
      <TextInput
        style={[S.champ, ouvert && suggestions.length > 0 && { marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
        value={valeur}
        onChangeText={saisir}
        placeholder={placeholder}
        placeholderTextColor={C.grisClair}
        autoCorrect={false}
      />
      {ouvert && suggestions.length > 0 && (
        <View style={{ borderWidth: 1.5, borderTopWidth: 0, borderColor: C.ligne, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: C.blanc, marginBottom: 12, overflow: "hidden" }}>
          {suggestions.slice(0, 6).map((s, i) => (
            <TouchableOpacity
              key={s.id || i}
              onPress={() => choisir(s)}
              style={{ paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.vertPale }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: C.encre }}>{s.principal}</Text>
              {s.secondaire ? <Text style={{ fontSize: 13, color: C.gris, marginTop: 1 }}>{s.secondaire}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
