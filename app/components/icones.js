// Icônes SVG de la maquette V10 — trait vert, style « calme clinique ».

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IcoPersonne(props) {
  return (
    <svg {...base} strokeWidth="1.7" {...props}>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.5 20.5c0-3.8 3.4-5.7 7.5-5.7s7.5 1.9 7.5 5.7" />
    </svg>
  );
}

export function IcoEtablissement(props) {
  return (
    <svg {...base} strokeWidth="1.7" {...props}>
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5" />
      <path d="M9 10h.01M15 10h.01M12 10h.01" />
    </svg>
  );
}

export function IcoVehicule(props) {
  return (
    <svg {...base} strokeWidth="1.7" {...props}>
      <path d="M3 16v-4l2-5h10l2 3h3a1 1 0 0 1 1 1v5h-2" />
      <circle cx="7.5" cy="16.5" r="1.8" />
      <circle cx="16.5" cy="16.5" r="1.8" />
      <path d="M9.3 16.5h5.4M3 16h2.7" />
    </svg>
  );
}

export function IcoMaison(props) {
  return (
    <svg {...base} strokeWidth="1.7" {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9h13v-9" />
      <path d="M12 12v4M10 14h4" />
    </svg>
  );
}

export function IcoMedicaments(props) {
  return (
    <svg {...base} strokeWidth="1.7" {...props}>
      <rect x="4.5" y="9" width="15" height="11" rx="2" />
      <path d="M9 9V6.5A2.5 2.5 0 0 1 11.5 4h1A2.5 2.5 0 0 1 15 6.5V9" />
      <path d="M12 12.5v4M10 14.5h4" />
    </svg>
  );
}

export function IcoTelephone(props) {
  return (
    <svg {...base} strokeWidth="2" {...props}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

export function IcoBulle(props) {
  return (
    <svg {...base} strokeWidth="1.7" {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-9 8.4 8.5 8.5 0 0 1-3.4-.7L3 21l1.8-4.6a8.4 8.4 0 1 1 16.2-4.9z" />
    </svg>
  );
}

export function IcoBulleAssistant(props) {
  return (
    <svg {...base} strokeWidth="1.9" {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-9 8.4 8.5 8.5 0 0 1-3.4-.7L3 21l1.8-4.6a8.4 8.4 0 1 1 16.2-4.9z" />
      <path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" />
    </svg>
  );
}

export function IcoDocument(props) {
  return (
    <svg {...base} strokeWidth="1.7" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

export function IcoDocumentLignes(props) {
  return (
    <svg {...base} strokeWidth="1.7" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </svg>
  );
}

export function IcoCalendrier(props) {
  return (
    <svg {...base} strokeWidth="1.9" {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  );
}

export function IcoPlus(props) {
  return (
    <svg {...base} strokeWidth="3" {...props}>
      <path d="M12 4.5v15M4.5 12h15" />
    </svg>
  );
}

export function IcoEnvoyer(props) {
  return (
    <svg {...base} strokeWidth="2" {...props}>
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

export function IcoDossier(props) {
  return (
    <svg {...base} strokeWidth="1.7" {...props}>
      <path d="M4 5.5h5l2 2.5h9a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17.5v-10A2 2 0 0 1 4.5 5.5z" />
    </svg>
  );
}

export function IcoPhoto(props) {
  return (
    <svg {...base} strokeWidth="1.7" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.7" />
      <path d="M21 16l-5-5-9 8" />
    </svg>
  );
}

export function IcoCamera(props) {
  return (
    <svg {...base} strokeWidth="1.7" {...props}>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2l1.5-2h8L17.5 7h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  );
}

export function IcoCorbeille(props) {
  return (
    <svg {...base} strokeWidth="1.8" {...props}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" />
    </svg>
  );
}

export function IcoOuvrir(props) {
  return (
    <svg {...base} strokeWidth="1.8" {...props}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

export function IcoReglages(props) {
  return (
    <svg {...base} strokeWidth="1.7" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.85a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01A1.7 1.7 0 0 0 10.05 3V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01c.26.63.87 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.95Z" />
    </svg>
  );
}

export function IcoSortie(props) {
  return (
    <svg {...base} strokeWidth="1.8" {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
