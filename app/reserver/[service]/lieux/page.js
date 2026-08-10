"use client";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAsm } from "@/app/providers";
import ChampAdresse from "@/app/components/adresse";
import CarteTrajet from "@/app/components/carte";
import { BESOINS, COMMUNES, validerEtape, etapeSuivante, vehiculePour } from "@/lib/parcours";
import { Stepper, useParcours } from "@/app/components/parcours";

// Étape 2 — lieux et précisions.
//
// Tout ce que l'équipe doit savoir AVANT de choisir une heure : où venir, dans
// quelle commune (c'est elle qui décide des véhicules et des soignants
// éligibles), et ce qui change la prise en charge sur place.
//
// Trois redondances de l'ancien formulaire disparaissent ici :
//   — le « type de trajet » n'est plus demandé : il découle du besoin choisi
//     à l'étape 1 (vehiculePour) ;
//   — la commune n'est plus un champ libre : les orthographes multiples d'une
//     même commune empêchaient le moteur de disponibilités de la reconnaître ;
//   — les besoins particuliers n'apparaissent qu'ici, une seule fois.

const HEURES_RETOUR = Array.from({ length: 13 }, (_, i) => `${String(8 + i).padStart(2, "0")}:00`);

export default function EtapeLieux() {
  const { t } = useAsm();
  const routeur = useRouter();
  const { service } = useParams();
  const [d, maj] = useParcours();
  const [manque, setManque] = useState([]);
  const [itineraire, setItineraire] = useState(null);

  // Itinéraire réel entre les deux points choisis dans les suggestions.
  // La distance est ce qui permet de tarifer la course au kilomètre plutôt
  // qu'au forfait ; sans coordonnées, on reste au forfait, sans rien
  // afficher — une distance inventée serait pire que pas de distance.
  const dLat = d?.departLat, dLng = d?.departLng, aLat = d?.destLat, aLng = d?.destLng;
  useEffect(() => {
    setItineraire(null);
    if (service !== "transport" || !dLat || !aLat) return;
    let annule = false;
    fetch(`/api/geo?type=itineraire&deLat=${dLat}&deLng=${dLng}&aLat=${aLat}&aLng=${aLng}`)
      .then((r) => r.json())
      .then((j) => { if (!annule && j.itineraire) setItineraire(j.itineraire); })
      .catch(() => {});
    return () => { annule = true; };
  }, [service, dLat, dLng, aLat, aLng]);

  // useParcours ne lit la session qu'après le montage : tant qu'on n'a rien,
  // on n'affiche pas de champs vides qui seraient écrasés au premier rendu.
  if (!d) return <div className="page"><div className="contenu-page" /></div>;

  const transport = service === "transport";
  const livraison = service === "medicaments";
  const besoins = d.besoins || [];

  const champ = (nom) => (e) => {
    setManque([]);
    maj({ [nom]: e.target.value });
  };

  const basculerBesoin = (cle) =>
    maj({ besoins: besoins.includes(cle) ? besoins.filter((x) => x !== cle) : [...besoins, cle] });

  function continuer() {
    const suivant = { ...d, service };
    const erreurs = validerEtape("lieux", suivant);
    if (erreurs.length) {
      setManque(erreurs);
      return;
    }
    // La classe de véhicule se déduit du besoin : on l'enregistre ici pour que
    // l'étape 3 ne propose que des créneaux réellement tenables.
    maj({ service, typeTrajet: vehiculePour(service, d.type), km: itineraire?.km });
    routeur.push(`/reserver/${service}/${etapeSuivante("lieux")}`);
  }

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 560 }}>
        <Link className="btn-retour" href={`/reserver/${service}/besoin`}>{t("pc_retour")}</Link>
        <h2 className="titre-page">{t("pc_lieux_q")}</h2>
        <Stepper etape="lieux" />

        {/* Suggestions d'adresses : elles rapportent aussi les coordonnées,
            seules capables de faire tarifer la course à la distance réelle.
            Sans clé Google configurée, le champ redevient un champ libre. */}
        <ChampAdresse
          label={transport ? t("pc_depart_l") : livraison ? t("pc_adresse_l") : t("pc_domicile_l")}
          placeholder={transport ? t("depart_ph") : t("pc_adresse_ph")}
          valeur={d.depart || ""}
          onChange={(v) => { setManque([]); maj({ depart: v }); }}
          onLieu={(l) => maj({ departLat: l?.lat, departLng: l?.lng })}
        />

        {transport && (
          <>
            <ChampAdresse
              label={t("pc_destination_l")}
              placeholder={t("dest_ph")}
              valeur={d.destination || ""}
              onChange={(v) => { setManque([]); maj({ destination: v }); }}
              onLieu={(l) => maj({ destLat: l?.lat, destLng: l?.lng })}
            />
            {itineraire && (
              <>
                <div className="trajet-resume">
                  <span>📏 <b>{String(itineraire.km).replace(".", ",")} km</b></span>
                  <span>⏱ <b>~{itineraire.minutes} {t("duree_min")}</b></span>
                </div>
                <CarteTrajet
                  depart={{ lat: dLat, lng: dLng }}
                  destination={{ lat: aLat, lng: aLng }}
                  polyline={itineraire.polyline}
                  hauteur={200}
                />
              </>
            )}
          </>
        )}

        {livraison && (
          <div className="champ">
            <label>{t("pharmacie_l")}</label>
            <input value={d.pharmacie || ""} onChange={champ("pharmacie")} placeholder={t("pharmacie_ph")} />
          </div>
        )}

        {/* Liste fermée : le moteur de disponibilités compare la commune aux
            zones couvertes par chaque véhicule et chaque soignant. Une faute
            de frappe rendait la demande introuvable pour toute l'équipe. */}
        <div className="champ">
          <label>{t("pc_commune_l")}</label>
          <select value={d.commune || ""} onChange={champ("commune")}>
            <option value="">{t("pc_commune_ph")}</option>
            {COMMUNES.map((c) => <option value={c} key={c}>{c}</option>)}
          </select>
        </div>

        {transport && (
          <>
            <div className="champ">
              <label>{t("pc_trajet_l")}</label>
              <div className="chips">
                {[false, true].map((ar) => (
                  <button
                    type="button"
                    key={String(ar)}
                    className={"chip" + (!!d.allerRetour === ar ? " actif" : "")}
                    aria-pressed={!!d.allerRetour === ar}
                    onClick={() => { setManque([]); maj({ allerRetour: ar, retourHeure: ar ? d.retourHeure : "" }); }}
                  >
                    {ar ? t("pc_trajet_ar") : t("pc_trajet_simple")}
                  </button>
                ))}
              </div>
            </div>

            {/* Un aller-retour sans heure laisse le véhicule immobilisé sans
                limite. « À la sortie des soins » est une réponse valable —
                pas une absence de réponse. */}
            {d.allerRetour && (
              <div className="champ">
                <label>{t("pc_retour_heure_l")}</label>
                <div className="chips">
                  <button
                    type="button"
                    className={"chip" + (d.retourHeure === "sortie" ? " actif" : "")}
                    aria-pressed={d.retourHeure === "sortie"}
                    onClick={() => { setManque([]); maj({ retourHeure: "sortie" }); }}
                  >
                    {t("pc_retour_sortie")}
                  </button>
                  {HEURES_RETOUR.map((h) => (
                    <button
                      type="button"
                      key={h}
                      className={"chip" + (d.retourHeure === h ? " actif" : "")}
                      aria-pressed={d.retourHeure === h}
                      onClick={() => { setManque([]); maj({ retourHeure: h }); }}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <h3 className="pc-sous-titre">{t("pc_precisions_t")}</h3>

        {/* Préférence d'intervenant(e) : un souhait, jamais une condition.
            S'il ne peut pas être respecté, la demande passe quand même et le
            souhait reste lisible par l'équipe. */}
        {!transport && !livraison && (
          <div className="champ">
            <label>{t("genre_l")}</label>
            <div className="chips">
              {[["", "genre_indif"], ["femme", "genre_femme"], ["homme", "genre_homme"]].map(([v, cle]) => (
                <button
                  type="button"
                  key={cle}
                  className={"chip" + ((d.prefGenre || "") === v ? " actif" : "")}
                  aria-pressed={(d.prefGenre || "") === v}
                  onClick={() => maj({ prefGenre: v })}
                >
                  {t(cle)}
                </button>
              ))}
            </div>
            <p className="fe-aide" style={{ marginBottom: 0 }}>{t("genre_aide")}</p>
          </div>
        )}

        <div className="champ">
          <label>{t("pc_besoins_l")}</label>
          <div className="chips">
            {BESOINS.map((b) => (
              <button
                type="button"
                key={b.cle}
                className={"chip" + (besoins.includes(b.cle) ? " actif" : "")}
                aria-pressed={besoins.includes(b.cle)}
                onClick={() => basculerBesoin(b.cle)}
              >
                {t(b.libelle)}
              </button>
            ))}
          </div>
        </div>

        {/* Étage et ascenseur séparés : « 3e sans ascenseur » saisi en texte
            libre n'était pas exploitable pour décider s'il faut deux porteurs.
            Ici, la réponse est lisible par l'équipe sans interprétation. */}
        <div className="champ">
          <label>{t("pc_acces_l")}</label>
          <div className="pc-duo">
            <input
              inputMode="numeric"
              value={d.etage || ""}
              onChange={champ("etage")}
              placeholder={t("pc_etage_l")}
              aria-label={t("pc_etage_l")}
            />
            <div className="chips">
              <span className="pc-duo-libelle">{t("pc_ascenseur_l")}</span>
              {[true, false].map((v) => (
                <button
                  type="button"
                  key={String(v)}
                  className={"chip" + (d.ascenseur === v ? " actif" : "")}
                  aria-pressed={d.ascenseur === v}
                  onClick={() => maj({ ascenseur: v })}
                >
                  {v ? t("pc_oui") : t("pc_non")}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="champ">
          <label>{t("pc_code_porte_l")}</label>
          <input value={d.code || ""} onChange={champ("code")} />
        </div>

        <div className="champ">
          <label>{t("pc_prevenir_l")}</label>
          <div className="pc-duo">
            <input value={d.prevenirNom || ""} onChange={champ("prevenirNom")} placeholder={t("pc_prevenir_nom")} aria-label={t("pc_prevenir_nom")} />
            <input inputMode="tel" value={d.prevenirTel || ""} onChange={champ("prevenirTel")} placeholder={t("pc_prevenir_tel")} aria-label={t("pc_prevenir_tel")} />
          </div>
        </div>

        {/* Un seul champ libre dans tout le parcours : l'ancien formulaire en
            avait trois, dont deux que personne ne lisait. */}
        <div className="champ">
          <label>{t("pc_precision_l")}</label>
          <textarea rows={3} value={d.notes || ""} onChange={champ("notes")} />
        </div>

        {manque.map((cle) => <p className="erreur" key={cle}>{t(cle)}</p>)}
        <button className="btn-action" onClick={continuer}>{t("pc_suivant")}</button>
      </div>
    </div>
  );
}
