"use client";
import { useEffect, useState } from "react";
import { fetchAdmin } from "../ui";

// Statistiques avancées — chiffres réels sur 12 mois (aucune donnée
// inventée). Couleurs des séries validées (daltonisme + contraste) :
// transport #0E6B3F · domicile #B8860B · médicaments #3B5FC0.
const SERIES = [
  ["transport", "Transport", "#0E6B3F"],
  ["domicile", "Aide à domicile", "#B8860B"],
  ["medicaments", "Médicaments", "#3B5FC0"],
];

const MOIS_COURT = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
const libMois = (m) => `${MOIS_COURT[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const kDA = (n) => (n >= 1000000 ? `${Math.round(n / 100000) / 10} M` : n >= 1000 ? `${Math.round(n / 100) / 10} k` : String(n));

// Barres empilées par mois (activité par service). Légende toujours
// affichée, infobulle native par segment, écart de 2 px entre segments.
function GraphActivite({ mois }) {
  const max = Math.max(1, ...mois.map((m) => m.transport + m.domicile + m.medicaments));
  return (
    <div className="adm-fiche">
      <strong>Activité — demandes par mois et par service</strong>
      <div className="stat-legende">
        {SERIES.map(([k, lib, coul]) => (
          <span key={k}><i style={{ background: coul }} /> {lib}</span>
        ))}
      </div>
      <div className="stat-barres" role="img" aria-label="Demandes par mois et par service">
        {mois.map((m) => {
          const total = m.transport + m.domicile + m.medicaments;
          return (
            <div className="stat-col" key={m.mois} title={`${libMois(m.mois)} : ${total} demande${total > 1 ? "s" : ""} (${m.transport} transport · ${m.domicile} domicile · ${m.medicaments} médicaments)`}>
              <div className="stat-pile">
                {SERIES.map(([k, , coul]) =>
                  m[k] > 0 ? (
                    <div key={k} style={{ height: `${(m[k] / max) * 100}%`, background: coul }} />
                  ) : null
                )}
              </div>
              <small>{libMois(m.mois)}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Deux séries côte à côte (même unité DZD, même axe) : facturé / encaissé.
function GraphFinances({ mois }) {
  const max = Math.max(1, ...mois.map((m) => Math.max(m.facture || 0, m.encaisse || 0)));
  return (
    <div className="adm-fiche">
      <strong>Finances — facturé et encaissé par mois (DZD)</strong>
      <div className="stat-legende">
        <span><i style={{ background: "#0E6B3F" }} /> Facturé</span>
        <span><i style={{ background: "#B8860B" }} /> Encaissé</span>
      </div>
      <div className="stat-barres" role="img" aria-label="Facturé et encaissé par mois">
        {mois.map((m) => (
          <div className="stat-col" key={m.mois} title={`${libMois(m.mois)} : facturé ${(m.facture || 0).toLocaleString("fr-FR")} DZD · encaissé ${(m.encaisse || 0).toLocaleString("fr-FR")} DZD`}>
            <div className="stat-duo">
              <div style={{ height: `${((m.facture || 0) / max) * 100}%`, background: "#0E6B3F" }} />
              <div style={{ height: `${((m.encaisse || 0) / max) * 100}%`, background: "#B8860B" }} />
            </div>
            <small>{libMois(m.mois)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

// Communes les plus servies : une seule teinte (magnitude), étiquettes directes.
function GraphCommunes({ topCommunes }) {
  if (!topCommunes?.length) return null;
  const max = Math.max(...topCommunes.map((c) => c.demandes));
  return (
    <div className="adm-fiche">
      <strong>Communes les plus servies (12 mois)</strong>
      <div style={{ marginTop: 10 }}>
        {topCommunes.map((c) => (
          <div className="stat-hbar" key={c.commune}>
            <span className="stat-hbar-nom">{c.commune}</span>
            <span className="stat-hbar-piste">
              <i style={{ width: `${(c.demandes / max) * 100}%` }} />
            </span>
            <b>{c.demandes}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PageStats() {
  const [donnees, setDonnees] = useState(null);
  useEffect(() => {
    fetchAdmin("/api/admin/stats?vue=avancee").then(setDonnees).catch(() => setDonnees({ erreur: true }));
  }, []);

  if (!donnees) return <p className="adm-vide">Chargement des statistiques…</p>;
  if (donnees.erreur) return <p className="adm-vide">Statistiques indisponibles.</p>;

  const t = donnees.totaux;
  return (
    <>
      <h1 className="adm-titre">Statistiques</h1>
      <p className="adm-vide" style={{ textAlign: "start" }}>
        Activité et finances des 12 derniers mois — chiffres réels de la base.
      </p>

      <div className="stat-tuiles">
        <div className="stat-tuile"><b>{t.demandes}</b><span>demandes (12 mois)</span></div>
        <div className="stat-tuile"><b>{t.terminees}</b><span>terminées</span></div>
        <div className="stat-tuile"><b>{t.tauxAnnulation} %</b><span>taux d&apos;annulation</span></div>
        <div className="stat-tuile"><b>{t.noteMoyenne ?? "—"}{t.noteMoyenne ? " / 5" : ""}</b><span>note moyenne ({t.nbAvis} avis)</span></div>
      </div>

      <GraphActivite mois={donnees.mois} />
      {donnees.voitFinances && <GraphFinances mois={donnees.mois} />}
      <GraphCommunes topCommunes={donnees.topCommunes} />

      {/* Vue tableau (accessibilité / vérification des chiffres exacts) */}
      <details className="adm-fiche">
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Voir les chiffres exacts (tableau)</summary>
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Mois</th><th>Transport</th><th>Domicile</th><th>Médicaments</th>
                {donnees.voitFinances && <><th>Facturé (DZD)</th><th>Encaissé (DZD)</th></>}
              </tr>
            </thead>
            <tbody>
              {donnees.mois.map((m) => (
                <tr key={m.mois}>
                  <td>{libMois(m.mois)}</td><td>{m.transport}</td><td>{m.domicile}</td><td>{m.medicaments}</td>
                  {donnees.voitFinances && <><td>{(m.facture || 0).toLocaleString("fr-FR")}</td><td>{(m.encaisse || 0).toLocaleString("fr-FR")}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fe-aide">Montants abrégés sur les graphiques : {kDA(1500)} = 1 500 · {kDA(2400000)} = 2 400 000.</p>
      </details>
    </>
  );
}
