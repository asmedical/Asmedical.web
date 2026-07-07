"use client";
import { useEffect, useState } from "react";

// Réglages du moteur de créneaux — réutilise l'API /api/reglages existante.
const CHAMPS = [
  ["heureDebut", "Heure d'ouverture (ex. 7)"],
  ["heureFin", "Heure de fermeture (ex. 19)"],
  ["joursHorizon", "Jours réservables à l'avance"],
  ["capaciteTransport", "Transports en parallèle"],
  ["capaciteDomicile", "Aides à domicile en parallèle"],
  ["capaciteMedicaments", "Livraisons en parallèle"],
];

export default function PageReglages() {
  const [reglage, setReglage] = useState(null);
  const [msg, setMsg] = useState("");
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    fetch("/api/reglages")
      .then((r) => r.json())
      .then(setReglage)
      .catch(() => setMsg("Impossible de charger les réglages."));
  }, []);

  async function enregistrer() {
    setOccupe(true);
    setMsg("");
    try {
      const r = await fetch("/api/reglages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reglage),
      });
      if (!r.ok) throw new Error();
      setMsg("Réglages enregistrés ✓");
    } catch {
      setMsg("Erreur : enregistrement impossible.");
    }
    setOccupe(false);
  }

  if (!reglage) return <p className="adm-vide">{msg || "Chargement…"}</p>;

  return (
    <>
      <h1 className="adm-titre">Réglages du calendrier</h1>
      <p className="adm-vide" style={{ textAlign: "start" }}>
        Horaires par défaut de l&apos;activité (7h–19h, 7j/7) et capacités simultanées. Les horaires
        propres à chaque soignant se règlent dans sa fiche (section Soignants).
      </p>
      <div className="adm-fiche">
        <div className="adm-grille-form">
          {CHAMPS.map(([k, l]) => (
            <label className="adm-champ-reglage" key={k}>
              {l}
              <input
                type="number"
                value={reglage[k] ?? ""}
                onChange={(e) => setReglage({ ...reglage, [k]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <button className="adm-btn" style={{ marginTop: 12 }} onClick={enregistrer} disabled={occupe}>
          {occupe ? "Enregistrement…" : "Enregistrer"}
        </button>
        {msg && <p className="adm-msg">{msg}</p>}
      </div>
    </>
  );
}
