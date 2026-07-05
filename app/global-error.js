"use client";

// Filet de sécurité ultime : erreur dans la mise en page racine elle-même.
// Remplace toute la page → styles en ligne (globals.css peut ne pas être chargé).
export default function ErreurGlobale({ error, reset }) {
  const btn = {
    display: "inline-block",
    padding: "14px 22px",
    fontSize: 16,
    fontWeight: 800,
    background: "#0E6B3F",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    textDecoration: "none",
  };
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#fff",
          color: "#22332C",
          fontFamily: "system-ui,-apple-system,sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ color: "#0A5230", fontSize: 23, margin: "0 0 8px" }}>
            Site momentanément indisponible
          </h1>
          <p style={{ color: "#6B7A72", lineHeight: 1.6 }}>
            Nous rencontrons un problème technique. Merci de réessayer dans un instant.
          </p>
          <button style={btn} onClick={() => reset()}>Réessayer</button>
          <p style={{ marginTop: 18 }}>
            <a href="tel:+33665390504" style={{ color: "#0E6B3F", fontWeight: 800, textDecoration: "none" }}>
              Appeler ASM — +33 6 65 39 05 04
            </a>
          </p>
        </div>
      </body>
    </html>
  );
}
