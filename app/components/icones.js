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
