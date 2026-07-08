"use client";
import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useEmploye } from "./layout";

const SERVICES = { transport: "Transport", domicile: "Aide à domicile", medicaments: "Médicaments" };
const STATUT_LIB = {
  A_RAPPELER: "À confirmer", CONFIRMEE: "Confirmée", AFFECTEE: "À faire", EN_COURS: "En cours",
  TERMINEE: "Terminée", ABSENT: "Patient absent", ANNULEE: "Annulée",
};
const DISPO = { DISPONIBLE: "Disponible", OCCUPE: "Occupé", ABSENT: "Absent" };

function jourISO(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export default function TableauEmploye() {
  const { moi, rafraichir } = useEmploye();
  const [occupe, setOccupe] = useState(0); // id en cours de mise à jour
  const [err, setErr] = useState("");
  if (!moi) return null;

  const { intervenant, interventions = [], estChauffeur, prenom } = moi;
  const auj = jourISO();
  const duJour = interventions.filter((i) => (i.date || "").slice(0, 10) === auj && i.statut !== "ANNULEE");
  const aVenir = interventions.filter((i) => (i.date || "").slice(0, 10) > auj && !["ANNULEE", "TERMINEE"].includes(i.statut));
  const passees = interventions.filter((i) => (i.date || "").slice(0, 10) < auj || i.statut === "TERMINEE").slice(-10).reverse();

  async function majStatut(id, statut) {
    setErr("");
    setOccupe(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/employe/intervention", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ id, statut }),
      });
      if (!r.ok) throw new Error();
      await rafraichir();
    } catch {
      setErr("Action impossible. Réessayez.");
    }
    setOccupe(0);
  }

  const motTournee = estChauffeur ? "tournée" : "interventions";

  return (
    <>
      <h1 className="emp-titre">Bonjour {prenom || ""} 👋</h1>
      <p className="emp-sous">Voici votre {estChauffeur ? "tournée" : "journée"} et vos {motTournee}.</p>

      {/* Bandeau intervenant */}
      {intervenant ? (
        <div className="emp-bandeau">
          <div>
            <strong>{intervenant.nom}</strong>
            <small>
              {estChauffeur ? intervenant.vehicule || "Véhicule non renseigné" : intervenant.qualification === "infirmier" ? "Infirmier(ère)" : "Aide-soignant(e)"}
              {" · "}{intervenant.heureDebut}h – {intervenant.heureFin}h
            </small>
          </div>
          <span className={"fe-dispo d-" + (intervenant.dispo || "DISPONIBLE")}>{DISPO[intervenant.dispo] || "Disponible"}</span>
        </div>
      ) : (
        <p className="emp-alerte">Votre compte n'est pas encore relié à une fiche {estChauffeur ? "transporteur" : "soignant"}. Contactez la coordination ASM.</p>
      )}

      {/* Accès rapides */}
      <div className="emp-acces">
        <Link href="/employe/messagerie" className="emp-tuile"><span>💬</span>Messagerie</Link>
        <Link href="/employe/messagerie" className="emp-tuile"><span>🔔</span>Notifications</Link>
        <Link href="/employe/documents" className="emp-tuile"><span>📄</span>Mes documents</Link>
        <Link href="/employe/profil" className="emp-tuile"><span>👤</span>Mon profil</Link>
      </div>

      {err && <p className="erreur">{err}</p>}

      {/* Aujourd'hui */}
      <h2 className="emp-section">Aujourd&apos;hui — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</h2>
      {duJour.length === 0 && <p className="adm-vide">Aucune {estChauffeur ? "course" : "intervention"} prévue aujourd&apos;hui.</p>}
      {duJour.map((i) => (
        <CarteIntervention key={i.id} i={i} estChauffeur={estChauffeur} occupe={occupe === i.id} onStatut={majStatut} />
      ))}

      {/* À venir */}
      {aVenir.length > 0 && (
        <>
          <h2 className="emp-section">À venir</h2>
          {aVenir.map((i) => (
            <CarteIntervention key={i.id} i={i} estChauffeur={estChauffeur} occupe={occupe === i.id} onStatut={majStatut} futur />
          ))}
        </>
      )}

      {/* Historique récent */}
      {passees.length > 0 && (
        <>
          <h2 className="emp-section">Historique récent</h2>
          {passees.map((i) => (
            <div className="emp-carte-i passee" key={i.id}>
              <span className="emp-i-txt">
                <strong>{SERVICES[i.service] || i.service}{i.destination ? ` · ${i.destination}` : ""}</strong>
                <small>{i.date?.replace("T", " à ")}</small>
              </span>
              <span className="emp-i-statut">{STATUT_LIB[i.statut] || i.statut}</span>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function CarteIntervention({ i, estChauffeur, occupe, onStatut, futur }) {
  return (
    <div className={"emp-carte-i" + (i.prioritaire ? " urgente" : "")}>
      <div className="emp-i-tete">
        <span className="emp-i-txt">
          <strong>
            {i.prioritaire ? "🔴 " : ""}
            {i.date ? new Date(i.date.replace(" ", "T")).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}
            {" · "}{SERVICES[i.service] || i.service}
          </strong>
          <small>
            {estChauffeur && i.depart ? `${i.depart} → ` : ""}{i.destination || "Adresse communiquée par l'équipe"}
            {i.fenetre ? ` · ${i.fenetre}` : ""}
          </small>
          {i.nom && <small>Patient : {i.nom}{i.telephone ? " · " : ""}{i.telephone && <a href={`tel:${i.telephone}`}>{i.telephone}</a>}</small>}
        </span>
        <span className="emp-i-statut">{STATUT_LIB[i.statut] || i.statut}</span>
      </div>
      {!futur && i.statut !== "TERMINEE" && (
        <div className="emp-i-actions">
          {i.statut !== "EN_COURS" && (
            <button className={"adm-btn secondaire" + (occupe ? " btn-charge" : "")} disabled={occupe} onClick={() => onStatut(i.id, "EN_COURS")}>
              {estChauffeur ? "Prise en charge" : "Démarrer"}
            </button>
          )}
          <button className={"adm-btn" + (occupe ? " btn-charge" : "")} disabled={occupe} onClick={() => onStatut(i.id, "TERMINEE")}>
            {estChauffeur ? "Déposé / terminé" : "Terminée"}
          </button>
          <button className="adm-btn secondaire" disabled={occupe} onClick={() => onStatut(i.id, "ABSENT")}>Patient absent</button>
        </div>
      )}
    </div>
  );
}
