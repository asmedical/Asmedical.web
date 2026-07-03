"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const SERVICES = {
  transport: "🚗 Transport médical",
  domicile: "🏠 Aide à domicile",
  medicaments: "💊 Livraison médicaments",
};
const STATUTS = {
  A_RAPPELER: "🟡 À rappeler",
  CONFIRMEE: "🟢 Confirmée",
  AFFECTEE: "✅ Affectée",
  ANNULEE: "❌ Annulée",
};
const CHAUFFEURS = ["Karim B. — V1 Berline", "Mounir S. — V2 Minibus", "Sofiane A. — V3 Break"];

export default function EspacePro() {
  const [autorise, setAutorise] = useState(false);
  const [code, setCode] = useState("");
  const [demandes, setDemandes] = useState(null);
  const [erreur, setErreur] = useState("");

  const codeAttendu = process.env.NEXT_PUBLIC_CODE_PRO || "asm2026";

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
      const t = setInterval(charger, 30000); // rafraîchit toutes les 30 s
      return () => clearInterval(t);
    }
  }, [autorise]);

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
      <>
        <div className="header-pro">
          <div className="inner">
            <strong>
              ASM <span className="badge-pro">PRO</span>
            </strong>
            <Link href="/patient">Espace patient →</Link>
          </div>
        </div>
        <div className="porte-code">
          <h1 style={{ color: "var(--emeraude-fonce)", marginBottom: 8 }}>Accès équipe</h1>
          <p style={{ color: "var(--gris)", marginBottom: 20 }}>
            Espace réservé à l&apos;équipe ASM et aux établissements partenaires.
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
        </div>
      </>
    );
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const nbAujourdhui = demandes?.filter((d) => d.creeLe.slice(0, 10) === aujourdhui).length ?? 0;
  const nbARappeler = demandes?.filter((d) => d.statut === "A_RAPPELER").length ?? 0;

  return (
    <>
      <div className="header-pro">
        <div className="inner">
          <strong>
            ASM <span className="badge-pro">PRO</span>
          </strong>
          <Link href="/patient">Espace patient →</Link>
        </div>
      </div>

      <main className="pro-contenu">
        <h1>Tableau de bord</h1>
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
                </strong>
                <small>
                  Souhaité : {d.date || "date à définir"} · {d.recurrence} · Reçu le{" "}
                  {new Date(d.creeLe).toLocaleString("fr-FR")}
                </small>
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
    </>
  );
}
