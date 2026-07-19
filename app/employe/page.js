"use client";
import Link from "next/link";
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
  const { moi } = useEmploye();
  if (!moi) return null;

  const { intervenant, interventions = [], estChauffeur, prenom } = moi;
  const auj = jourISO();
  const duJour = interventions.filter((i) => (i.date || "").slice(0, 10) === auj && i.statut !== "ANNULEE");
  const aVenir = interventions.filter((i) => (i.date || "").slice(0, 10) > auj && !["ANNULEE", "TERMINEE"].includes(i.statut));
  const passees = interventions.filter((i) => (i.date || "").slice(0, 10) < auj || i.statut === "TERMINEE").slice(-10).reverse();

  return (
    <>
      <h1 className="emp-titre">Bonjour {prenom || ""} 👋</h1>
      <p className="emp-sous">Voici votre {estChauffeur ? "tournée" : "journée"} et vos {estChauffeur ? "courses" : "interventions"}.</p>

      {intervenant ? (
        <div className="emp-bandeau">
          <div>
            <strong>{intervenant.nom}</strong>
            <small>
              {estChauffeur ? intervenant.vehicule || "Véhicule non renseigné" : intervenant.qualification === "infirmier" ? "Infirmier(ère)" : "Auxiliaire de santé"}
              {" · "}{intervenant.heureDebut}h – {intervenant.heureFin}h
            </small>
          </div>
          <span className={"fe-dispo d-" + (intervenant.dispo || "DISPONIBLE")}>{DISPO[intervenant.dispo] || "Disponible"}</span>
        </div>
      ) : (
        <p className="emp-alerte">Votre compte n&apos;est pas encore relié à une fiche {estChauffeur ? "transporteur" : "soignant"}. Contactez la coordination ASM.</p>
      )}

      <div className="emp-acces">
        <Link href="/employe/messagerie" className="emp-tuile"><span>💬</span>Messagerie</Link>
        <Link href="/employe/messagerie" className="emp-tuile"><span>🔔</span>Notifications</Link>
        <Link href="/employe/documents" className="emp-tuile"><span>📄</span>Mes documents</Link>
        <Link href="/employe/profil" className="emp-tuile"><span>👤</span>Mon profil</Link>
      </div>

      {/* Info véhicule (chauffeur) */}
      {estChauffeur && intervenant && (
        <div className="emp-vehicule">
          <span className="emp-veh-ico" aria-hidden="true">🚐</span>
          <div>
            <strong>{[intervenant.vehicule, intervenant.vehiculeCouleur].filter(Boolean).join(" · ") || "Véhicule non renseigné"}</strong>
            {intervenant.vehiculeImmat && <span className="suivi-plaque" dir="ltr">{intervenant.vehiculeImmat}</span>}
            <small>
              {({ simple: "Transport simple", accompagne: "Accompagné (fauteuil)", medicalise: "Médicalisé" }[intervenant.typeTransport]) || "Transport"}
              {intervenant.communes ? ` · zone : ${intervenant.communes}` : ""}
            </small>
          </div>
        </div>
      )}

      <h2 className="emp-section">
        {estChauffeur ? "Ma tournée du jour" : "Aujourd'hui"} — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
      </h2>
      {duJour.length === 0 && <p className="adm-vide">Aucune {estChauffeur ? "course" : "intervention"} prévue aujourd&apos;hui.</p>}
      {estChauffeur
        ? duJour.map((i, n) => <CarteCourse key={i.id} i={i} n={n + 1} />)
        : duJour.map((i) => <CarteIntervention key={i.id} i={i} estChauffeur={estChauffeur} />)}

      {aVenir.length > 0 && (
        <>
          <h2 className="emp-section">À venir</h2>
          {estChauffeur
            ? aVenir.map((i) => <CarteCourse key={i.id} i={i} />)
            : aVenir.map((i) => <CarteIntervention key={i.id} i={i} estChauffeur={estChauffeur} />)}
        </>
      )}

      {passees.length > 0 && (
        <>
          <h2 className="emp-section">Historique récent</h2>
          {passees.map((i) => (
            <Link className="emp-carte-i passee" href={`/employe/interventions/${i.id}`} key={i.id}>
              <span className="emp-i-txt">
                <strong>{SERVICES[i.service] || i.service}{i.destination ? ` · ${i.destination}` : ""}</strong>
                <small>{i.date?.replace("T", " à ")}</small>
              </span>
              <span className="emp-i-statut">{STATUT_LIB[i.statut] || i.statut}</span>
            </Link>
          ))}
        </>
      )}
    </>
  );
}

// Carte « course » du chauffeur : arrêt numéroté, trajet départ → destination.
function CarteCourse({ i, n }) {
  const heure = i.date ? new Date(i.date.replace(" ", "T")).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";
  return (
    <Link className={"emp-course cliquable" + (i.prioritaire ? " urgente" : "")} href={`/employe/interventions/${i.id}`}>
      <span className="emp-course-num" aria-hidden="true">{n || "•"}</span>
      <span className="emp-course-corps">
        <strong>{i.prioritaire ? "🔴 " : ""}{heure}{i.fenetre ? ` · ${i.fenetre}` : ""}</strong>
        <span className="emp-trajet">
          <span className="emp-trajet-lieu">{i.depart || "Prise en charge"}</span>
          <span className="emp-trajet-fleche" aria-hidden="true">→</span>
          <span className="emp-trajet-lieu">{i.destination || "Destination"}</span>
        </span>
        {i.nom && <small>Patient : {i.nom}</small>}
      </span>
      <span className="emp-i-droite">
        <span className="emp-i-statut">{STATUT_LIB[i.statut] || i.statut}</span>
        <span className="emp-chevron" aria-hidden="true">›</span>
      </span>
    </Link>
  );
}

// Carte cliquable → fiche mission complète.
function CarteIntervention({ i, estChauffeur }) {
  return (
    <Link className={"emp-carte-i cliquable" + (i.prioritaire ? " urgente" : "")} href={`/employe/interventions/${i.id}`}>
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
  );
}
