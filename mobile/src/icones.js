// Icônes de la barre de navigation — MÊMES tracés que le site
// (app/components/icones.js), pour que les deux supports se ressemblent
// vraiment au lieu d'utiliser des émojis d'un côté et des dessins de l'autre.
import React from "react";
import Svg, { Path, Circle, Rect } from "react-native-svg";

const base = (couleur, epaisseur = 1.9) => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: couleur,
  strokeWidth: epaisseur,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});

export function IcoPersonne({ couleur, taille = 24 }) {
  return (
    <Svg {...base(couleur)} width={taille} height={taille}>
      <Circle cx="12" cy="8" r="3.8" />
      <Path d="M4.5 20.5c0-3.8 3.4-5.7 7.5-5.7s7.5 1.9 7.5 5.7" />
    </Svg>
  );
}

export function IcoBulle({ couleur, taille = 24 }) {
  return (
    <Svg {...base(couleur)} width={taille} height={taille}>
      <Path d="M21 11.5a8.38 8.38 0 0 1-9 8.4 8.5 8.5 0 0 1-3.4-.7L3 21l1.8-4.6a8.4 8.4 0 1 1 16.2-4.9z" />
    </Svg>
  );
}

export function IcoDocumentLignes({ couleur, taille = 24 }) {
  return (
    <Svg {...base(couleur)} width={taille} height={taille}>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6M9 13h6M9 17h6" />
    </Svg>
  );
}

export function IcoCalendrier({ couleur, taille = 24 }) {
  return (
    <Svg {...base(couleur)} width={taille} height={taille}>
      <Rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <Path d="M8 3v4M16 3v4M3.5 10h17" />
    </Svg>
  );
}

export function IcoPlus({ couleur, taille = 26 }) {
  return (
    <Svg {...base(couleur, 2.4)} width={taille} height={taille}>
      <Path d="M12 4.5v15M4.5 12h15" />
    </Svg>
  );
}

export function IcoStethoscope({ couleur, taille = 24 }) {
  return (
    <Svg {...base(couleur)} width={taille} height={taille}>
      <Path d="M6 3v6a4 4 0 0 0 8 0V3" />
      <Path d="M10 17v-4" />
      <Circle cx="17.5" cy="17.5" r="2.5" />
      <Path d="M10 17a5 5 0 0 0 5 0.5" />
    </Svg>
  );
}

export function IcoEtablissement({ couleur, taille = 24 }) {
  return (
    <Svg {...base(couleur)} width={taille} height={taille}>
      <Path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5" />
    </Svg>
  );
}
