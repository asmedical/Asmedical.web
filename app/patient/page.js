"use client";
import { useState } from "react";
import Link from "next/link";

const SERVICES = {
  transport: { nom: "Transport médical", desc: "Hôpital, dialyse, consultation", emoji: "🚗" },
  domicile: { nom: "Aide à domicile", desc: "Aide-soignant diplômé chez vous", emoji: "🏠" },
  medicaments: { nom: "Livraison de médicaments", desc: "Depuis votre pharmacie", emoji: "💊" },
};

export default function EspacePatient() {
  const [etape, setEtape] = useState(1);
  const [service, setService] = useState("transport");
  const [telephone, setTelephone] = useState("");
  const [date, setDate] = useState("");
  const [recurrence, setRecurrence] = useState("Une seule fois");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function envoyer() {
    setErreur("");
    if (telephone.trim().length < 9) {
      setErreur("Merci d'indiquer un numéro de téléphone valide.");
      return;
    }
    setEnvoi(true);
    try {
      const r = await fetch("/api/demandes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, telephone, date, recurrence }),
      });
      if (!r.ok) throw new Error();
      setEtape(3);
    } catch {
      setErreur("Une erreur est survenue. Appelez-nous directement au 0X XX XX XX XX.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <div className="bandeau-info">
        Besoin d&apos;aide ?{" "}
        <a href="tel:+213000000000">0X&nbsp;XX&nbsp;XX&nbsp;XX&nbsp;XX</a> · 7j/7
      </div>
      <header className="header">
        <Link href="/" className="marque">
          <span className="mini-logo">+</span> ASM
        </Link>
        <Link href="/" className="lien">
          Changer d&apos;espace
        </Link>
      </header>

      <main className="accueil-centre">
        <div className="devise-ar">دائماً قريبون منكم</div>
        <h1>
          {etape === 1 && "De quoi avez-vous besoin ?"}
          {etape === 2 && "Quand souhaitez-vous être aidé ?"}
          {etape === 3 && "Merci !"}
        </h1>

        <div className="carte">
          {etape === 1 && (
            <div className="choix">
              {Object.entries(SERVICES).map(([cle, s]) => (
                <button
                  key={cle}
                  onClick={() => {
                    setService(cle);
                    setEtape(2);
                  }}
                >
                  <span className="emoji">{s.emoji}</span>
                  <span>
                    <strong>{s.nom}</strong>
                    <small>{s.desc}</small>
                  </span>
                </button>
              ))}
            </div>
          )}

          {etape === 2 && (
            <div>
              <button className="btn-retour" onClick={() => setEtape(1)}>
                ← Retour
              </button>
              <div className="titre-etape">{SERVICES[service].nom}</div>
              <div className="champ">
                <label htmlFor="tel">Votre téléphone</label>
                <input
                  id="tel"
                  type="tel"
                  placeholder="0550 00 00 00"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                />
              </div>
              <div className="champ">
                <label htmlFor="date">Date souhaitée</label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              {service === "transport" && (
                <div className="champ">
                  <label htmlFor="recur">Répéter ce transport ?</label>
                  <select
                    id="recur"
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value)}
                  >
                    <option>Une seule fois</option>
                    <option>Chaque semaine — dialyse (lun · mer · ven)</option>
                    <option>Chaque semaine — je choisis les jours</option>
                    <option>Je verrai avec le conseiller</option>
                  </select>
                </div>
              )}
              <button className="btn-action" onClick={envoyer} disabled={envoi}>
                {envoi ? "Envoi en cours…" : "Être rappelé gratuitement"}
              </button>
              {erreur && <p className="erreur">{erreur}</p>}
            </div>
          )}

          {etape === 3 && (
            <div className="confirmation">
              <div className="rond-ok">✓</div>
              <h2 style={{ fontSize: 21, marginBottom: 6 }}>C&apos;est noté !</h2>
              <p style={{ color: "var(--gris)" }}>
                <strong>Nous vous appelons dans moins de 30 minutes.</strong>
              </p>
              <p style={{ color: "var(--gris)", fontSize: 14 }}>
                Sans paiement en ligne, sans compte.
              </p>
              <button
                className="btn-action"
                style={{ marginTop: 16 }}
                onClick={() => {
                  setTelephone("");
                  setDate("");
                  setEtape(1);
                }}
              >
                Nouvelle demande
              </button>
            </div>
          )}
        </div>

        <p className="rassurance">Rappel en 30 min · 7j/7 sur Alger</p>
      </main>
    </>
  );
}