"use client";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";
import { FENETRES, validerEtape, etapeSuivante } from "@/lib/parcours";
import { Stepper, useParcours } from "@/app/components/parcours";

// Étape 3 — date et heure.
//
// L'ancien formulaire proposait une bande de jours à faire défiler : on ne
// voyait pas la semaine suivante et rien ne disait, avant de cliquer, si un
// jour était ouvrable. Ici le mois entier est visible d'un coup, et les jours
// sans aucune place sont grisés — /api/disponibilites les calcule avec le
// MÊME moteur que les créneaux, donc le calendrier ne promet jamais un jour
// que la réservation refuserait.
//
// Pour les médicaments, aucune heure précise : le coursier enchaîne des
// tournées, on choisit une fenêtre.

const JOURS_COURTS = ["j_lun", "j_mar", "j_mer", "j_jeu", "j_ven", "j_sam", "j_dim"];

const isoJour = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function EtapeCreneau() {
  const { t, langue } = useAsm();
  const routeur = useRouter();
  const { service } = useParams();
  const [d, maj] = useParcours();

  const aujourdhui = useMemo(() => new Date(), []);
  const [mois, setMois] = useState(() => new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1));
  const [jours, setJours] = useState(null);      // disponibilité du mois
  const [creneaux, setCreneaux] = useState(null); // créneaux du jour choisi
  const [fenetres, setFenetres] = useState(null); // fenêtres de livraison
  const [charge, setCharge] = useState(false);
  const [manque, setManque] = useState([]);
  const [erreur, setErreur] = useState("");

  const livraison = service === "medicaments";
  const cleMois = `${mois.getFullYear()}-${String(mois.getMonth() + 1).padStart(2, "0")}`;
  const jourChoisi = d?.jour || "";

  // --- Disponibilité du mois affiché.
  useEffect(() => {
    if (!d) return;
    let annule = false;
    const u = new URLSearchParams({ service, mois: cleMois });
    if (d.commune) u.set("commune", d.commune);
    if (d.typeTrajet) u.set("typeTrajet", d.typeTrajet);
    // La durée de la prestation change les jours ouvrables : une garde de
    // trois heures ne tient pas dans les mêmes journées qu'une injection.
    if (d.duree) u.set("duree", String(d.duree));
    setJours(null);
    setErreur("");
    fetch(`/api/disponibilites?${u}`)
      .then((r) => r.json())
      .then((j) => { if (!annule) setJours(j.jours || []); })
      .catch(() => { if (!annule) { setJours([]); setErreur(t("err_serveur")); } });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleMois, service, d?.commune, d?.typeTrajet, d?.duree, !!d]);

  // --- Créneaux (ou fenêtres) du jour choisi.
  const chargerJour = useCallback(
    async (iso) => {
      setCharge(true);
      setErreur("");
      try {
        const u = new URLSearchParams({ service, jour: iso });
        if (d?.commune) u.set("commune", d.commune);
        if (d?.typeTrajet) u.set("typeTrajet", d.typeTrajet);
        if (d?.duree) u.set("duree", String(d.duree));
        const r = await fetch(`/api/creneaux?${u}`);
        const j = await r.json();
        setCreneaux(j.creneaux || null);
        setFenetres(j.fenetres || null);
      } catch {
        setErreur(t("err_serveur"));
      } finally {
        setCharge(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [service, d?.commune, d?.typeTrajet, d?.duree]
  );

  useEffect(() => {
    if (jourChoisi) chargerJour(jourChoisi);
  }, [jourChoisi, chargerJour]);

  if (!d) return <div className="page"><div className="contenu-page" /></div>;

  const dispoDe = (iso) => jours?.find((x) => x.date === iso);

  function choisirJour(iso) {
    setManque([]);
    maj({ jour: iso, iso: "", fenetre: "" });
  }

  // Premier jour ouvrable à venir : évite de faire chercher à la main quand
  // le début du mois est complet.
  const prochainDispo = (jours || []).find((j) => j.dispo && j.date >= isoJour(aujourdhui));

  function continuer() {
    const erreurs = validerEtape("creneau", { ...d, service });
    if (erreurs.length) return setManque(erreurs);
    routeur.push(`/reserver/${service}/${etapeSuivante("creneau")}`);
  }

  // --- Grille du mois, lundi en première colonne.
  const premier = new Date(mois.getFullYear(), mois.getMonth(), 1);
  const decalage = (premier.getDay() + 6) % 7;
  const nbJours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate();
  const cases = [
    ...Array.from({ length: decalage }, () => null),
    ...Array.from({ length: nbJours }, (_, i) => new Date(mois.getFullYear(), mois.getMonth(), i + 1)),
  ];
  const moisPrecedentPossible =
    mois.getFullYear() > aujourdhui.getFullYear() ||
    (mois.getFullYear() === aujourdhui.getFullYear() && mois.getMonth() > aujourdhui.getMonth());
  const loc = langue === "ar" ? "ar" : "fr-FR";

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 560 }}>
        <Link className="btn-retour" href={`/reserver/${service}/lieux`}>{t("pc_retour")}</Link>
        <h2 className="titre-page">{t("pc_calendrier_t")}</h2>
        <Stepper etape="creneau" />

        <div className="pc-mois">
          <button
            type="button"
            className="pc-fleche"
            onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))}
            disabled={!moisPrecedentPossible}
            aria-label={t("pc_retour")}
          >‹</button>
          <strong>{mois.toLocaleDateString(loc, { month: "long", year: "numeric" })}</strong>
          <button
            type="button"
            className="pc-fleche"
            onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))}
            aria-label={t("pc_suivant")}
          >›</button>
        </div>

        <div className="pc-calendrier">
          {JOURS_COURTS.map((j) => <span className="pc-entete-jour" key={j}>{t(j).slice(0, 3)}</span>)}
          {cases.map((date, i) => {
            if (!date) return <span key={`v${i}`} />;
            const iso = isoJour(date);
            const info = dispoDe(iso);
            // Tant que le mois charge, aucun jour n'est présenté comme
            // réservable : mieux vaut une grille neutre qu'une promesse.
            const ouvrable = !!info?.dispo;
            return (
              <button
                type="button"
                key={iso}
                className={"pc-jour" + (ouvrable ? "" : " ferme") + (iso === jourChoisi ? " actif" : "")}
                disabled={!ouvrable}
                aria-pressed={iso === jourChoisi}
                onClick={() => choisirJour(iso)}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>

        {jours === null && <p className="pc-attente">{t("pc_chargement")}</p>}
        {jours !== null && !jours.some((j) => j.dispo) && (
          <p className="pc-attente">{t("pc_aucun_creneau")}</p>
        )}
        {prochainDispo && !jourChoisi && (
          <button type="button" className="pc-lien" onClick={() => choisirJour(prochainDispo.date)}>
            {t("pc_prochain_jour")}
          </button>
        )}

        {/* --- Heures, ou fenêtres pour une livraison --- */}
        {jourChoisi && (
          <div className="champ" style={{ marginTop: 18 }}>
            <label>{livraison ? t("pc_fenetres_l") : t("pc_heures_l")}</label>
            {charge && <p className="pc-attente">{t("pc_chargement")}</p>}

            {!charge && livraison && (
              <div className="chips">
                {(fenetres || []).map((f) => {
                  const def = FENETRES.find((x) => x.cle === f.id);
                  return (
                    <button
                      type="button"
                      key={f.id}
                      className={"chip" + (d.fenetre === f.id ? " actif" : "")}
                      disabled={f.complet}
                      aria-pressed={d.fenetre === f.id}
                      onClick={() => { setManque([]); maj({ fenetre: f.id, fenetreFr: f.fr }); }}
                    >
                      {def ? t(def.libelle) : f.fr}
                      {f.complet ? ` · ${t("pc_complet")}` : f.presqueComplet ? ` · ${t("pc_bientot_complet")}` : ""}
                    </button>
                  );
                })}
              </div>
            )}

            {!charge && !livraison && (
              <div className="chips">
                {(creneaux || []).filter((c) => c.dispo).map((c) => (
                  <button
                    type="button"
                    key={c.iso}
                    className={"chip" + (d.iso === c.iso ? " actif" : "")}
                    aria-pressed={d.iso === c.iso}
                    onClick={() => { setManque([]); maj({ iso: c.iso, heure: c.heure }); }}
                  >
                    {c.heure}
                    {c.restant === 1 ? ` · ${t("pc_bientot_complet")}` : ""}
                  </button>
                ))}
              </div>
            )}

            {/* Journée vide : on ne laisse pas l'utilisateur sans issue. Un
                appel obtient une réponse tout de suite, là où un formulaire
                de plus ne ferait que reporter le problème. */}
            {!charge && !livraison && (creneaux || []).every((c) => !c.dispo) && (
              <>
                <p className="pc-attente">{t("pc_aucun_creneau")}</p>
                <a className="pc-lien" href={TEL_LIEN}>
                  {t("pc_urgent_asm")} · {TEL_AFFICHE}
                </a>
              </>
            )}
          </div>
        )}

        {erreur && <p className="erreur">{erreur}</p>}
        {manque.map((cle) => <p className="erreur" key={cle}>{t(cle)}</p>)}
        <button className="btn-action" onClick={continuer}>{t("pc_suivant")}</button>
      </div>
    </div>
  );
}
