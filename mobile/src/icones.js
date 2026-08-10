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

// --- Services et actions : mêmes tracés que le site (app/components/icones.js).
// Les émojis 🚑 🏠 💊 donnaient à l'application un air d'ébauche là où le site
// inspire confiance. Sur une plateforme médicale, ce n'est pas un détail.
export function IcoVehicule({ couleur, taille = 24 }) {
  return (
    <Svg {...base(couleur, 1.7)} width={taille} height={taille}>
      <Path d="M3 16v-4l2-5h10l2 3h3a1 1 0 0 1 1 1v5h-2" />
      <Circle cx="7.5" cy="16.5" r="1.8" />
      <Circle cx="16.5" cy="16.5" r="1.8" />
      <Path d="M9.3 16.5h5.4M3 16h2.7" />
    </Svg>
  );
}

export function IcoMaison({ couleur, taille = 24 }) {
  return (
    <Svg {...base(couleur, 1.7)} width={taille} height={taille}>
      <Path d="M3 11.5 12 4l9 7.5" />
      <Path d="M5.5 10v9h13v-9" />
      <Path d="M12 12v4M10 14h4" />
    </Svg>
  );
}

export function IcoMedicaments({ couleur, taille = 24 }) {
  return (
    <Svg {...base(couleur, 1.7)} width={taille} height={taille}>
      <Rect x="4.5" y="9" width="15" height="11" rx="2" />
      <Path d="M9 9V6.5A2.5 2.5 0 0 1 11.5 4h1A2.5 2.5 0 0 1 15 6.5V9" />
      <Path d="M12 12.5v4M10 14.5h4" />
    </Svg>
  );
}

export function IcoCorbeille({ couleur, taille = 22 }) {
  return (
    <Svg {...base(couleur, 1.8)} width={taille} height={taille}>
      <Path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" />
    </Svg>
  );
}

export function IcoOuvrir({ couleur, taille = 22 }) {
  return (
    <Svg {...base(couleur, 1.8)} width={taille} height={taille}>
      <Path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </Svg>
  );
}

export function IcoTelephone({ couleur, taille = 18 }) {
  return (
    <Svg {...base(couleur, 2)} width={taille} height={taille}>
      <Path d="M6.5 3h3l1.5 4-2 1.5a11 11 0 0 0 4.5 4.5L15 11l4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3z" />
    </Svg>
  );
}
