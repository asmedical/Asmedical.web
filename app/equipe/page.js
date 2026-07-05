"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

// Back-office équipe ASM (dispatch) : demandes reçues, statuts, chauffeurs.
// Accès par code (NEXT_PUBLIC_CODE_PRO) en attendant la vraie authentification.
const SERVICES = {
  transport: "🚗 Transport médical",
  domicile: "🏠 Aide à domicile",
  medicaments: "💊 Livraison médicaments",
};
const TRAJETS = {
  simple: "simple (assis)",
  accompagne: "accompagné (fauteuil)",
  medicalise: "médicalisé (infirmier)",
};
const STATUTS = {
  A_RAPPELER: "🟡 À rappeler",
  CONFIRMEE: "🟢 Confirmée",
  AFFECTEE: "✅ Affectée",
  TERMINEE: "🏁 Terminée",
  ANNULEE: "❌ Annulée",
};
const CHAUFFEURS = ["Karim B. — V1 Berline", "Mounir S. — V2 Minibus", "Sofiane A. — V3 Break"];

export default function BackOfficeEquipe() {
  const [autorise, setAutorise] = useState(false);
  const [code, setCode] = useState("");
  const [demandes, setDemandes] = useState(null);
  const [erreur, setErreur] = useState("");
  const [reglage, setReglage] = useState(null);
  const [reglageMsg, setReglageMsg] = useState("");

  const codeAttendu = process.env.NEXT_PUBLIC_CODE_PRO || "asm2026";

  async function chargerReglage() {
    try {
      const r = await fetch("/api/reglages");
      if (r.ok) setReglage(await r.json());
    } catch {}
  }

  async function enregistrerReglage() {
    setReglageMsg("");
    const r = await fetch("/api/reglages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reglage),
    });
    setReglageMsg(r.ok ? "Réglages enregistrés ✓" : "Échec de l'enregistrement");
  }

  async function charger() {
    try {
      const r = await fetch("/api/demandes");
      if (!r.ok) throw new Error();
      setDemandes(await r.json());
    } catch {
      setErreur("Impossible de charger les demandes. Vérifiez la base de données.");
    }
  }

  useEffect(() => {
    if (autorise) {
      charger();
      chargerReglage();
      const t = setInterval(charger, 30000); // rafraîchit toutes les 30 s
      return () => clearInterval(t);
    }
  }, [autorise]);

  const majReglage = (k, v) => setReglage((r) => ({ ...r, [k]: v }));

  async function majDemande(id, champ, valeur) {
    await fetch("/api/demandes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [champ]: valeur }),
    });
    charger();
  }

  if (!autorise) {
    return (
      <div className="page">
        <div className="porte-code">
          <h1 style={{ color: "var(--vert-fonce)", marginBottom: 8 }}>Accès équipe</h1>
          <p style={{ color: "var(--gris)", marginBottom: 20 }}>
            Espace réservé à l&apos;équipe ASM.
          </p>
          <div className="champ">
            <input
              type="password"
              placeholder="Code d'accès"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && code === codeAttendu && setAutorise(true)}
            />
          </div>
          <button
            className="btn-action"
            onClick={() => (code === codeAttendu ? setAutorise(true) : setErreur("Code incorrect"))}
          >
            Entrer
          </button>
          {erreur && <p className="erreur">{erreur}</p>}
          <p className="lien-bas">
            <Link href="/">← Retour au site</Link>
          </p>
        </div>
      </div>
    );
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const nbAujourdhui = demandes?.filter((d) => d.creeLe.slice(0, 10) === aujourdhui).length ?? 0;
  const nbARappeler = demandes?.filter((d) => d.statut === "A_RAPPELER").length ?? 0;

  return (
    <div className="page">
      <main className="pro-contenu">
        <h1>Tableau de dispatch</h1>
        <p className="sous">Demandes reçues depuis le site — rafraîchi automatiquement.</p>

        <div className="stats-ligne">
          <div className="stat">
            <div className="chiffre">{nbAujourdhui}</div>
            <small>Demandes aujourd&apos;hui</small>
          </div>
          <div className="stat">
            <div className="chiffre">{nbARappeler}</div>
            <small>À rappeler</small>
          </div>
          <div className="stat">
            <div className="chiffre">{demandes?.length ?? "…"}</div>
            <small>Total demandes</small>
          </div>
        </div>

        {reglage && (
          <details className="reglages-bloc">
            <summary>Réglages du calendrier de créneaux</summary>
            <div className="reglages-grille">
              <label>
                Ouverture (h)
                <input type="number" min="0" max="23" value={reglage.heureDebut}
                  onChange={(e) => majReglage("heureDebut", e.target.value)} />
              </label>
              <label>
                Fermeture (h)
                <input type="number" min="1" max="24" value={reglage.heureFin}
                  onChange={(e) => majReglage("heureFin", e.target.value)} />
              </label>
              <label>
                Jours à l&apos;avance
                <input type="number" min="1" max="90" value={reglage.joursHorizon}
                  onChange={(e) => majReglage("joursHorizon", e.target.value)} />
              </label>
              <label>
                Transports en //
                <input type="number" min="0" max="99" value={reglage.capaciteTransport}
                  onChange={(e) => majReglage("capaciteTransport", e.target.value)} />
              </label>
              <label>
                Aide à domicile en //
                <input type="number" min="0" max="99" value={reglage.capaciteDomicile}
                  onChange={(e) => majReglage("capaciteDomicile", e.target.value)} />
              </label>
              <label>
                Livraisons en //
                <input type="number" min="0" max="99" value={reglage.capaciteMedicaments}
                  onChange={(e) => majReglage("capaciteMedicaments", e.target.value)} />
              </label>
            </div>
            <button className="btn-action" style={{ maxWidth: 260 }} onClick={enregistrerReglage}>
              Enregistrer les réglages
            </button>
            {reglageMsg && <p className="reglage-msg">{reglageMsg}</p>}
          </details>
        )}

        {erreur && <p className="erreur">{erreur}</p>}
        {demandes === null && !erreur && <div className="vide">Chargement…</div>}
        {demandes?.length === 0 && (
          <div className="vide">
            Aucune demande pour l&apos;instant.
            <br />
            Faites un test depuis l&apos;espace patient !
          </div>
        )}

        {demandes?.map((d) => (
          <div className="demande-admin" key={d.id}>
            <div className="entete">
              <span>
                <strong>
                  {SERVICES[d.service] || d.service} — {d.telephone}
                  {d.espace === "pro" ? " · PRO" : ""}
                </strong>
                <small>
                  {d.typeTrajet ? `Trajet ${TRAJETS[d.typeTrajet] || d.typeTrajet} · ` : ""}
                  {d.depart || d.destination
                    ? `${d.depart || "?"} → ${d.destination || "?"} · `
                    : ""}
                  Souhaité : {d.date ? d.date.replace("T", " ") : "date à définir"} ·{" "}
                  {d.recurrence} · Reçu le {new Date(d.creeLe).toLocaleString("fr-FR")}
                </small>
                {d.notes && <small>Notes : {d.notes}</small>}
              </span>
              <span className={"pastille" + (d.statut !== "A_RAPPELER" ? " verte" : "")}>
                {STATUTS[d.statut] || d.statut}
              </span>
            </div>
            <div className="actions">
              <select value={d.statut} onChange={(e) => majDemande(d.id, "statut", e.target.value)}>
                {Object.entries(STATUTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={d.chauffeur || ""}
                onChange={(e) => majDemande(d.id, "chauffeur", e.target.value)}
              >
                <option value="">Affecter un chauffeur…</option>
                {CHAUFFEURS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
