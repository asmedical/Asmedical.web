"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAdmin } from "../ui";

// Planning calendrier : les rendez-vous de chaque soignant / chauffeur en
// colonnes (vue jour) ou en grille intervenants × jours (vue semaine).
// Un clic sur un rendez-vous ouvre la demande complète.

const H_DEB = 7; // heure de début affichée
const H_FIN = 20; // heure de fin affichée
const PX_HEURE = 52; // hauteur d'une heure en pixels (vue jour)

const LIB_SERVICE = { transport: "Transport", domicile: "Aide à domicile", medicaments: "Médicaments" };
const LIB_QUALIF = { infirmier: "Infirmier·ère", aide_soignant: "Aide-soignant·e" };
const JOURS_COURTS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

// ---- Petites fonctions de dates (locales, format AAAA-MM-JJ) ----
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function ajouterJours(jour, n) {
  const d = new Date(jour + "T12:00");
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}
function lundiDe(jour) {
  const d = new Date(jour + "T12:00");
  return ajouterJours(jour, -((d.getDay() + 6) % 7)); // 0 = lundi
}
function indexJour(jour) {
  return (new Date(jour + "T12:00").getDay() + 6) % 7; // 0=lun … 6=dim
}
function libelleJour(jour) {
  return new Date(jour + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

// Indisponibilité d'un intervenant pour un jour donné (repos hebdo, congé, absence).
function indispo(col, jour) {
  if (col.cle === "na") return null;
  if (col.dispo === "ABSENT") return "Absent";
  if ((col.conges || "").split(",").map((s) => s.trim()).includes(jour)) return "Congé";
  if ((col.joursOff || "").split(",").map((s) => s.trim()).includes(String(indexJour(jour)))) return "Repos";
  return null;
}

export default function PagePlanning() {
  const routeur = useRouter();
  const [jour, setJour] = useState(() => isoLocal(new Date()));
  const [vue, setVue] = useState("jour"); // jour | semaine
  const [type, setType] = useState("tous"); // tous | soignants | transporteurs
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");

  const debut = vue === "semaine" ? lundiDe(jour) : jour;
  const fin = vue === "semaine" ? ajouterJours(debut, 6) : jour;

  useEffect(() => {
    let annule = false;
    setErreur("");
    fetchAdmin(`/api/admin/planning?debut=${debut}&fin=${fin}`)
      .then((d) => !annule && setData(d))
      .catch(() => !annule && setErreur("Impossible de charger le planning."));
    return () => {
      annule = true;
    };
  }, [debut, fin]);

  // Colonnes du calendrier : « Non affecté » + intervenants actifs filtrés.
  const colonnes = useMemo(() => {
    const cols = [{ cle: "na", titre: "Non affecté", sous: "à répartir" }];
    if (type !== "transporteurs") {
      (data?.soignants || []).forEach((s) =>
        cols.push({
          cle: `s${s.id}`, genre: "soignant", id: s.id,
          titre: [s.prenom, s.nom].filter(Boolean).join(" "),
          sous: LIB_QUALIF[s.qualification] || s.qualification,
          heureDebut: s.heureDebut, heureFin: s.heureFin,
          joursOff: s.joursOff, conges: s.conges, dispo: s.dispo,
        })
      );
    }
    if (type !== "soignants") {
      (data?.transporteurs || []).forEach((t) =>
        cols.push({
          cle: `t${t.id}`, genre: "transporteur", id: t.id,
          titre: t.nom, sous: t.vehicule || "Transport",
          heureDebut: t.heureDebut, heureFin: t.heureFin,
          joursOff: t.joursOff, conges: t.conges, dispo: t.dispo,
        })
      );
    }
    return cols;
  }, [data, type]);

  function evenements(col, j) {
    return (data?.demandes || []).filter((d) => {
      if (!d.date?.startsWith(j)) return false;
      if (col.cle === "na") return !d.soignantId && !d.transporteurId;
      return col.genre === "soignant" ? d.soignantId === col.id : d.transporteurId === col.id;
    });
  }

  const nonAffectees = (data?.demandes || []).filter((d) => !d.soignantId && !d.transporteurId && d.statut !== "ANNULEE").length;
  const pas = vue === "semaine" ? 7 : 1;
  const jours = vue === "semaine" ? [...Array(7)].map((_, i) => ajouterJours(debut, i)) : [jour];

  return (
    <>
      <h1 className="adm-titre">Planning</h1>

      {/* ---- Barre d'outils ---- */}
      <div className="adm-plan-outils">
        <div className="adm-plan-nav">
          <button className="adm-btn secondaire" onClick={() => setJour(ajouterJours(jour, -pas))} aria-label="Période précédente">‹</button>
          <button className="adm-btn secondaire" onClick={() => setJour(isoLocal(new Date()))}>Aujourd&apos;hui</button>
          <button className="adm-btn secondaire" onClick={() => setJour(ajouterJours(jour, pas))} aria-label="Période suivante">›</button>
          <input type="date" value={jour} onChange={(e) => e.target.value && setJour(e.target.value)} />
          <strong className="adm-plan-periode">
            {vue === "jour" ? libelleJour(jour) : `Semaine du ${new Date(debut + "T12:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`}
          </strong>
        </div>
        <div className="adm-plan-nav">
          <div className="adm-plan-bascule">
            <button className={vue === "jour" ? "actif" : ""} onClick={() => setVue("jour")}>Jour</button>
            <button className={vue === "semaine" ? "actif" : ""} onClick={() => setVue("semaine")}>Semaine</button>
          </div>
          <div className="adm-plan-bascule">
            <button className={type === "tous" ? "actif" : ""} onClick={() => setType("tous")}>Tous</button>
            <button className={type === "soignants" ? "actif" : ""} onClick={() => setType("soignants")}>Soignants</button>
            <button className={type === "transporteurs" ? "actif" : ""} onClick={() => setType("transporteurs")}>Transport</button>
          </div>
        </div>
      </div>

      {/* ---- Légende + alerte non affectés ---- */}
      <div className="adm-plan-legende">
        <span><i className="pl-point transport" /> Transport</span>
        <span><i className="pl-point domicile" /> Aide à domicile</span>
        <span><i className="pl-point medicaments" /> Médicaments</span>
        {nonAffectees > 0 && <span className="adm-plan-alerte">⚠ {nonAffectees} rendez-vous non affecté{nonAffectees > 1 ? "s" : ""} sur la période</span>}
      </div>

      {erreur && <p className="adm-vide">{erreur}</p>}
      {!data && !erreur && <p className="adm-vide">Chargement…</p>}

      {/* ================= VUE JOUR ================= */}
      {data && vue === "jour" && (
        <div className="adm-plan-defile">
          <div className="adm-plan-jour" style={{ "--h-grille": `${(H_FIN - H_DEB) * PX_HEURE}px` }}>
            {/* Gouttière des heures */}
            <div className="adm-plan-heures">
              <div className="adm-plan-entete-col" />
              <div className="adm-plan-heures-corps">
                {[...Array(H_FIN - H_DEB)].map((_, i) => (
                  <span key={i} style={{ top: i * PX_HEURE }}>{String(H_DEB + i).padStart(2, "0")}h</span>
                ))}
              </div>
            </div>
            {colonnes.map((col) => {
              const evts = evenements(col, jour);
              const off = indispo(col, jour);
              return (
                <div className={"adm-plan-col" + (col.cle === "na" ? " na" : "")} key={col.cle}>
                  <div className="adm-plan-entete-col">
                    <strong>{col.titre}</strong>
                    <small>{off || col.sous}{evts.length ? ` · ${evts.length} rdv` : ""}</small>
                  </div>
                  <div className={"adm-plan-corps" + (off ? " off" : "")}>
                    {off && <span className="adm-plan-off-lib">{off}</span>}
                    {/* Hors horaires de travail : zones grisées */}
                    {!off && col.heureDebut > H_DEB && (
                      <div className="adm-plan-horszone" style={{ top: 0, height: (col.heureDebut - H_DEB) * PX_HEURE }} />
                    )}
                    {!off && col.heureFin < H_FIN && (
                      <div className="adm-plan-horszone" style={{ top: (col.heureFin - H_DEB) * PX_HEURE, height: (H_FIN - col.heureFin) * PX_HEURE }} />
                    )}
                    {evts.map((d) => {
                      const h = Number(d.date.slice(11, 13)), m = Number(d.date.slice(14, 16));
                      const haut = Math.max(0, (h * 60 + m - H_DEB * 60) / 60 * PX_HEURE);
                      const hauteur = Math.max(26, ((d.dureeMin || 60) / 60) * PX_HEURE - 2);
                      return (
                        <button
                          key={d.id}
                          className={`adm-plan-evt ${d.service}${d.statut === "TERMINEE" ? " fini" : ""}${d.statut === "ANNULEE" ? " annule" : ""}${d.problemeLe ? " probleme" : ""}`}
                          style={{ top: haut, height: hauteur }}
                          onClick={() => routeur.push(`/admin/demandes?id=${d.id}`)}
                          title={`n°${d.id} · ${LIB_SERVICE[d.service] || d.service} · ${d.nom || d.telephone}`}
                        >
                          <strong>{d.date.slice(11, 16)}{d.prioritaire ? " ⚡" : ""}{d.problemeLe ? " ⚠" : ""}</strong>
                          <span>{d.nom || d.telephone}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= VUE SEMAINE ================= */}
      {data && vue === "semaine" && (
        <div className="adm-plan-defile">
          <table className="adm-plan-semaine">
            <thead>
              <tr>
                <th />
                {jours.map((j, i) => (
                  <th key={j} className={j === isoLocal(new Date()) ? "auj" : ""}>
                    <button onClick={() => { setJour(j); setVue("jour"); }} title="Ouvrir la vue jour">
                      {JOURS_COURTS[i]} <strong>{Number(j.slice(8, 10))}</strong>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colonnes.map((col) => (
                <tr key={col.cle} className={col.cle === "na" ? "na" : ""}>
                  <th>
                    <strong>{col.titre}</strong>
                    <small>{col.sous}</small>
                  </th>
                  {jours.map((j) => {
                    const off = indispo(col, j);
                    const evts = evenements(col, j);
                    return (
                      <td key={j} className={off ? "off" : ""}>
                        {off && !evts.length && <span className="adm-plan-off-lib">{off}</span>}
                        {evts.map((d) => (
                          <button
                            key={d.id}
                            className={`adm-plan-puce ${d.service}${d.statut === "ANNULEE" ? " annule" : ""}${d.problemeLe ? " probleme" : ""}`}
                            onClick={() => routeur.push(`/admin/demandes?id=${d.id}`)}
                            title={`n°${d.id} · ${LIB_SERVICE[d.service] || d.service} · ${d.nom || d.telephone}`}
                          >
                            {d.date.slice(11, 16)} {d.nom || d.telephone}
                          </button>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
