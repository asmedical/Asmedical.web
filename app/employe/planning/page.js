"use client";
import Link from "next/link";
import { useEmploye } from "../layout";

const SERVICES = { transport: "Transport", domicile: "Aide à domicile", medicaments: "Médicaments" };
const STATUT_LIB = {
  A_RAPPELER: "À confirmer", CONFIRMEE: "Confirmée", AFFECTEE: "À faire", EN_COURS: "En cours",
  TERMINEE: "Terminée", ABSENT: "Absent", ANNULEE: "Annulée",
};
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function libJour(iso) {
  const d = new Date(iso + "T12:00");
  const auj = new Date().toISOString().slice(0, 10);
  const dem = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (iso === auj) return "Aujourd'hui";
  if (iso === dem) return "Demain";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export default function PlanningEmploye() {
  const { moi } = useEmploye();
  if (!moi) return null;
  const { intervenant, interventions = [], estChauffeur } = moi;
  const auj = new Date().toISOString().slice(0, 10);

  // Interventions à venir (aujourd'hui inclus), groupées par jour.
  const aVenir = interventions
    .filter((i) => (i.date || "").slice(0, 10) >= auj && i.statut !== "ANNULEE")
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const parJour = {};
  for (const i of aVenir) {
    const j = (i.date || "").slice(0, 10);
    (parJour[j] = parJour[j] || []).push(i);
  }
  const jours = Object.keys(parJour).sort();
  const repos = String(intervenant?.joursOff || "").split(",").filter((x) => x !== "").map((n) => JOURS[Number(n)]).join(" · ");

  return (
    <>
      <h1 className="emp-titre">Mon planning</h1>
      <p className="emp-sous">Vos {estChauffeur ? "tournées" : "interventions"} à venir.</p>

      {intervenant && (
        <div className="fe-carte" style={{ marginBottom: 16 }}>
          <div className="fe-ligne"><span className="fe-label">Horaires</span><span className="fe-valeur">{intervenant.heureDebut}h – {intervenant.heureFin}h</span></div>
          <div className="fe-ligne"><span className="fe-label">Jours de repos</span><span className="fe-valeur">{repos || "—"}</span></div>
          {intervenant.conges && <div className="fe-ligne"><span className="fe-label">Congés</span><span className="fe-valeur">{intervenant.conges}</span></div>}
          <div className="fe-ligne"><span className="fe-label">{estChauffeur ? "Zone" : "Communes"}</span><span className="fe-valeur">{intervenant.communes || "—"}</span></div>
        </div>
      )}

      {jours.length === 0 && <p className="adm-vide">Aucune {estChauffeur ? "tournée" : "intervention"} programmée pour le moment.</p>}

      {jours.map((j) => (
        <div key={j} style={{ marginBottom: 18 }}>
          <h2 className="emp-section" style={{ textTransform: "capitalize", marginTop: 8 }}>{libJour(j)}</h2>
          {parJour[j].map((i) => (
            <Link className={"emp-carte-i cliquable" + (i.prioritaire ? " urgente" : "")} href={`/employe/interventions/${i.id}`} key={i.id}>
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
                  {i.nom && <small>Patient : {i.nom}</small>}
                </span>
                <span className="emp-i-droite">
                  <span className="emp-i-statut">{STATUT_LIB[i.statut] || i.statut}</span>
                  <span className="emp-chevron" aria-hidden="true">›</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      ))}

      <Link className="adm-btn secondaire" href="/employe" style={{ marginTop: 8, display: "inline-block" }}>← Retour au tableau de bord</Link>
    </>
  );
}
