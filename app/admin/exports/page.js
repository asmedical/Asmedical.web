"use client";
import { useState } from "react";
import { useGardeAdmin } from "../ui";
import { supabase } from "@/lib/supabase";

// Exports CSV (format Excel français : séparateur ; accents préservés).
// Chaque export est journalisé côté serveur.

function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PageExports() {
  const { role } = useGardeAdmin();
  const auj = new Date();
  const [debut, setDebut] = useState(isoLocal(new Date(auj.getFullYear(), auj.getMonth(), 1)));
  const [fin, setFin] = useState(isoLocal(auj));
  const [service, setService] = useState("");
  const [statut, setStatut] = useState("");
  const [moyen, setMoyen] = useState("");
  const [occupe, setOccupe] = useState("");
  const [msg, setMsg] = useState("");
  const [format, setFormat] = useState("csv"); // csv | xlsx

  function periodeRapide(quoi) {
    const d = new Date();
    if (quoi === "mois") {
      setDebut(isoLocal(new Date(d.getFullYear(), d.getMonth(), 1)));
      setFin(isoLocal(d));
    } else if (quoi === "mois-1") {
      setDebut(isoLocal(new Date(d.getFullYear(), d.getMonth() - 1, 1)));
      setFin(isoLocal(new Date(d.getFullYear(), d.getMonth(), 0)));
    } else if (quoi === "7j") {
      const s = new Date(d);
      s.setDate(s.getDate() - 6);
      setDebut(isoLocal(s));
      setFin(isoLocal(d));
    }
  }

  // Téléchargement authentifié : on récupère le CSV avec le jeton de
  // session, puis on déclenche l'enregistrement du fichier.
  async function telecharger(cle, params) {
    setMsg("");
    setOccupe(cle);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`/api/admin/exports?${params}&format=${format}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      if (!r.ok) throw new Error();
      const nom = (r.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/)?.[1] || "export-asm.csv";
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = nom;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg(`Fichier « ${nom} » téléchargé ✓`);
    } catch {
      setMsg("Export impossible (vérifiez la période et vos droits).");
    }
    setOccupe("");
  }

  const periode = `debut=${debut}&fin=${fin}`;

  // Rapport d'activité imprimable : ouvert dans un nouvel onglet → PDF via
  // « Imprimer / Enregistrer en PDF » (comme les factures et relevés).
  async function ouvrirRapport() {
    setMsg("");
    setOccupe("rapport");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`/api/admin/exports?type=rapport&${periode}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      if (!r.ok) throw new Error();
      const url = URL.createObjectURL(await r.blob());
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setMsg("Rapport impossible (vérifiez la période et vos droits).");
    }
    setOccupe("");
  }

  return (
    <>
      <h1 className="adm-titre">Exports & rapports</h1>
      <p className="adm-vide" style={{ textAlign: "start" }}>
        Fichiers CSV ou Excel (.xlsx) lisibles dans Excel, Numbers ou Google Sheets. Chaque export est journalisé.
      </p>
      {msg && <p className="adm-msg">{msg}</p>}

      {/* ---- Période et format communs ---- */}
      <h2 className="adm-sous-titre">Période & format</h2>
      <div className="adm-filtres" style={{ alignItems: "center" }}>
        <label className="exp-date">du <input type="date" value={debut} onChange={(e) => e.target.value && setDebut(e.target.value)} /></label>
        <label className="exp-date">au <input type="date" value={fin} onChange={(e) => e.target.value && setFin(e.target.value)} /></label>
        <button className="adm-btn secondaire" onClick={() => periodeRapide("mois")}>Ce mois-ci</button>
        <button className="adm-btn secondaire" onClick={() => periodeRapide("mois-1")}>Mois dernier</button>
        <button className="adm-btn secondaire" onClick={() => periodeRapide("7j")}>7 derniers jours</button>
        <select value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Format de fichier">
          <option value="csv">Format : CSV</option>
          <option value="xlsx">Format : Excel (.xlsx)</option>
        </select>
      </div>

      {/* ---- Rapport imprimable (superadmin / admin) ---- */}
      {["superadmin", "admin"].includes(role) && (
        <div className="adm-fiche">
          <p className="fe-aide" style={{ marginTop: 0 }}>
            <strong>Rapport d&apos;activité</strong> : synthèse imprimable de la période (demandes par
            service, facturé, encaissé par moyen, communes les plus servies) — s&apos;ouvre dans un
            onglet, puis « Imprimer / Enregistrer en PDF ».
          </p>
          <button
            className={"adm-btn" + (occupe === "rapport" ? " btn-charge" : "")}
            disabled={!!occupe}
            onClick={ouvrirRapport}
          >
            🖨 Ouvrir le rapport de la période
          </button>
        </div>
      )}

      {/* ---- Demandes ---- */}
      <h2 className="adm-sous-titre">Demandes & rendez-vous</h2>
      <div className="adm-fiche">
        <p className="fe-aide" style={{ marginTop: 0 }}>
          Toutes les demandes de la période : date, service, statut, client, intervenant, durée,
          réservations d&apos;établissements, avis… Idéal pour le suivi d&apos;activité.
        </p>
        <div className="adm-filtres">
          <select value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">Tous les services</option>
            <option value="transport">Transport</option>
            <option value="domicile">Aide à domicile</option>
            <option value="medicaments">Médicaments</option>
          </select>
          <select value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="">Tous les statuts</option>
            {["A_RAPPELER", "CONFIRMEE", "AFFECTEE", "EN_COURS", "TERMINEE", "ABSENT", "ANNULEE"].map((s) => (
              <option value={s} key={s}>{s}</option>
            ))}
          </select>
          <button
            className={"adm-btn" + (occupe === "demandes" ? " btn-charge" : "")}
            disabled={!!occupe}
            onClick={() => telecharger("demandes", `type=demandes&${periode}${service ? `&service=${service}` : ""}${statut ? `&statut=${statut}` : ""}`)}
          >
            ⬇ Télécharger
          </button>
        </div>
      </div>

      {/* ---- Clients ---- */}
      <h2 className="adm-sous-titre">Clients</h2>
      <div className="adm-fiche">
        <p className="fe-aide" style={{ marginTop: 0 }}>
          Annuaire complet (tous les comptes, sans période) : coordonnées, commune, contact famille, date d&apos;inscription.
        </p>
        <div className="adm-filtres">
          <button
            className={"adm-btn" + (occupe === "clients" ? " btn-charge" : "")}
            disabled={!!occupe}
            onClick={() => telecharger("clients", "type=clients")}
          >
            ⬇ Patients
          </button>
          <button
            className={"adm-btn secondaire" + (occupe === "etablissements" ? " btn-charge" : "")}
            disabled={!!occupe}
            onClick={() => telecharger("etablissements", "type=etablissements")}
          >
            ⬇ Établissements
          </button>
        </div>
      </div>

      {/* ---- Finances (superadmin / admin) ---- */}
      {["superadmin", "admin"].includes(role) && (
        <>
          <h2 className="adm-sous-titre">Finances</h2>
          <div className="adm-fiche">
            <p className="fe-aide" style={{ marginTop: 0 }}>
              <strong>Encaissements</strong> : tous les paiements confirmés de la période (reçu, client,
              facture, moyen, encaissé par, remboursements, net). Filtrez par moyen si besoin.
            </p>
            <div className="adm-filtres">
              <select value={moyen} onChange={(e) => setMoyen(e.target.value)}>
                <option value="">Tous les moyens</option>
                <option value="especes">Espèces</option>
                <option value="cib">CIB</option>
                <option value="edahabia">EDAHABIA</option>
                <option value="virement">Virement</option>
              </select>
              <button
                className={"adm-btn" + (occupe === "encaissements" ? " btn-charge" : "")}
                disabled={!!occupe}
                onClick={() => telecharger("encaissements", `type=encaissements&${periode}${moyen ? `&moyen=${moyen}` : ""}`)}
              >
                ⬇ Encaissements
              </button>
            </div>
          </div>
          <div className="adm-fiche">
            <p className="fe-aide" style={{ marginTop: 0 }}>
              <strong>Impayés</strong> : photo du jour de TOUT le restant dû (indépendant de la période) —
              échéance, jours de retard, relances déjà envoyées. <strong>Journal des espèces</strong> :
              chaque encaissement en espèces de la période avec son ticket, le caissier et le point de
              paiement — pour la réconciliation de caisse.
            </p>
            <div className="adm-filtres">
              <button
                className={"adm-btn" + (occupe === "impayes" ? " btn-charge" : "")}
                disabled={!!occupe}
                onClick={() => telecharger("impayes", "type=impayes")}
              >
                ⬇ Impayés du jour
              </button>
              <button
                className={"adm-btn secondaire" + (occupe === "especes" ? " btn-charge" : "")}
                disabled={!!occupe}
                onClick={() => telecharger("especes", `type=especes&${periode}`)}
              >
                ⬇ Journal des espèces
              </button>
            </div>
          </div>
        </>
      )}

      {/* ---- Paie (super admin) ---- */}
      {role === "superadmin" && (
        <>
          <h2 className="adm-sous-titre">Paie des intervenants</h2>
          <div className="adm-fiche">
            <p className="fe-aide" style={{ marginTop: 0 }}>
              Pour chaque soignant et transporteur : missions terminées sur la période, heures,
              mode de rémunération et <strong>montant estimé</strong> (taux × heures ou tarif ×
              missions, + primes − retenues). À vérifier avant paiement — réservé au super admin.
            </p>
            <div className="adm-filtres">
              <button
                className={"adm-btn" + (occupe === "paie" ? " btn-charge" : "")}
                disabled={!!occupe}
                onClick={() => telecharger("paie", `type=paie&${periode}`)}
              >
                ⬇ Télécharger la paie
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
