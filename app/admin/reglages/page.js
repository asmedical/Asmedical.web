"use client";
import { useEffect, useState } from "react";
import { fetchAdmin } from "../ui";

// Réglages du moteur de créneaux — réutilise l'API /api/reglages existante.
const CHAMPS = [
  ["heureDebut", "Heure d'ouverture (ex. 7)"],
  ["heureFin", "Heure de fermeture (ex. 19)"],
  ["joursHorizon", "Jours réservables à l'avance"],
  ["capaciteTransport", "Transports en parallèle (repli)"],
  ["capaciteDomicile", "Aides à domicile en parallèle (repli)"],
  ["capaciteMedicaments", "Livraisons en parallèle (repli)"],
  ["tamponMin", "Tampon après intervention (min)"],
  ["trajetDefautMin", "Trajet estimé entre 2 missions (min)"],
  ["capaciteFenetre", "Livraisons max par fenêtre"],
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
      await fetchAdmin("/api/reglages", {
        method: "PATCH",
        body: JSON.stringify(reglage),
      });
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
        <label className="case-ligne" style={{ marginTop: 14 }}>
          <input
            type="checkbox"
            checked={!!reglage.affectationAuto}
            onChange={(e) => setReglage({ ...reglage, affectationAuto: e.target.checked })}
          />
          Affectation automatique : assigner l&apos;intervenant éligible le moins chargé dès la réservation
        </label>
        <p className="fe-aide" style={{ marginTop: 4 }}>
          Décoché : les nouvelles demandes restent « à affecter » et l&apos;équipe choisit l&apos;intervenant.
          Les capacités « repli » ne servent que si aucun soignant/transporteur validé n&apos;est configuré.
        </p>
        <button className="adm-btn" style={{ marginTop: 12 }} onClick={enregistrer} disabled={occupe}>
          {occupe ? "Enregistrement…" : "Enregistrer"}
        </button>
        {msg && <p className="adm-msg">{msg}</p>}
      </div>
    </>
  );
}
