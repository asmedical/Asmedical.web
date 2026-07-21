"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE } from "@/lib/i18n";

const CLES_SERVICE = {
  transport: "rdv_service_transport",
  domicile: "rdv_service_domicile",
  medicaments: "rdv_service_medicaments",
};

function isoJour(d) {
  return d.toISOString().slice(0, 10);
}

// Besoins particuliers proposés en « chips » (multi-sélection).
const BESOINS = [
  "b_fauteuil", "b_oxygene", "b_marche", "b_alite", "b_accompagnateur",
  "b_infirmier", "b_age", "b_dialyse", "b_chimio", "b_postop", "b_enfant",
];

// Types d'actes proposés par défaut (Mode A) si le back-office n'en a pas
// encore configuré dans la table TypeActe.
const ACTES_DEFAUT = [
  { id: "toilette", cle: "acte_toilette", dureeMin: 60 },
  { id: "pansement", cle: "acte_pansement", dureeMin: 30 },
  { id: "injection", cle: "acte_injection", dureeMin: 20 },
  { id: "perfusion", cle: "acte_perfusion", dureeMin: 60 },
  { id: "prise_sang", cle: "acte_prise_sang", dureeMin: 20 },
  { id: "garde", cle: "acte_garde", dureeMin: 180 },
  { id: "autre", cle: "acte_autre", dureeMin: 60 },
];

// Fenêtres de livraison (Mode C). `fr` = valeur stockée, lisible en back-office.
const FENETRES = [
  { id: "asap", cle: "f_asap", fr: "au plus tôt" },
  { id: "matin", cle: "f_matin", fr: "matin (8h–12h)" },
  { id: "midi", cle: "f_midi", fr: "midi (12h–15h)" },
  { id: "soir", cle: "f_soir", fr: "après-midi (15h–19h)" },
];

const JOURS_SEMAINE = ["j_lun", "j_mar", "j_mer", "j_jeu", "j_ven", "j_sam", "j_dim"];

// Moteur de réservation unifié :
//  Mode B (transport)   : ponctuel (créneaux) | régulier (abonnement) | urgent
//  Mode A (domicile)    : type d'acte + créneaux
//  Mode C (médicaments) : jour + fenêtre de livraison + pharmacie
export default function PriseRdv() {
  const { t, langue, serviceEnCours, espaceChoisi } = useAsm();
  const service = serviceEnCours || "transport";

  // --- Transport (Mode B) ---
  const [sousMode, setSousMode] = useState("ponctuel"); // ponctuel | abonnement | urgent
  const [typeTrajet, setTypeTrajet] = useState("simple");
  const [depart, setDepart] = useState("");
  const [destination, setDestination] = useState("");
  const [aboJours, setAboJours] = useState([]);
  const [aboHeure, setAboHeure] = useState("08:00");
  const [aboRetour, setAboRetour] = useState(true);
  const [aboDebut, setAboDebut] = useState(isoJour(new Date()));

  // --- Domicile (Mode A) ---
  const [actes, setActes] = useState(null);
  const [acteChoisi, setActeChoisi] = useState(0);

  // --- Médicaments (Mode C) ---
  const [pharmacie, setPharmacie] = useState("");
  const [fenetre, setFenetre] = useState("asap");

  // --- Commun ---
  const [telephone, setTelephone] = useState("");
  const [notes, setNotes] = useState("");
  const [commune, setCommune] = useState(""); // filtre de zone du moteur
  const [communeFiltre, setCommuneFiltre] = useState(""); // appliqué au blur
  const [jours, setJours] = useState([]);
  const [jourChoisi, setJourChoisi] = useState("");
  const [creneaux, setCreneaux] = useState(null);
  const [slotChoisi, setSlotChoisi] = useState("");
  const [fenetres, setFenetres] = useState(null); // livraison : capacité réelle

  // Précisions structurées
  const [besoins, setBesoins] = useState([]);
  const [acces, setAcces] = useState("");
  const [code, setCode] = useState("");
  const [prevenirNom, setPrevenirNom] = useState("");
  const [prevenirTel, setPrevenirTel] = useState("");

  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [confirme, setConfirme] = useState(""); // "" | standard | urgent | abonnement | livraison

  // Réservation AU NOM d'un patient rattaché (établissement) : posée par
  // l'espace pro via sessionStorage, vérifiée côté serveur (procuration).
  const [prefGenre, setPrefGenre] = useState("");
  const [pourPatient, setPourPatient] = useState(null);
  useEffect(() => {
    try {
      const v = sessionStorage.getItem("asm_pour_patient");
      if (v) {
        const p = JSON.parse(v);
        setPourPatient(p);
        if (p.tel) setTelephone(p.tel);
      }
    } catch {}
  }, []);
  function annulerPourPatient() {
    try { sessionStorage.removeItem("asm_pour_patient"); } catch {}
    setPourPatient(null);
    setTelephone("");
  }

  // Sélecteur « Pour qui ? » : proches autorisés du compte connecté
  // (rattachements ACCEPTE) — réserver pour maman/papa en deux touches.
  const [proches, setProches] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const r = await fetch("/api/proches", { headers: { Authorization: `Bearer ${session.access_token}` } });
        const d = await r.json();
        setProches((d.proches || []).filter((p) => p.statut === "ACCEPTE" && !p.expiree));
      } catch {}
    })();
  }, []);
  function choisirProche(p) {
    if (!p) {
      annulerPourPatient();
      return;
    }
    setPourPatient({ tel: p.patientTel, nom: p.patientNom || p.patientTel });
    setTelephone(p.patientTel);
  }

  const besoinCreneau =
    (service === "transport" && sousMode === "ponctuel") || service === "domicile";

  // Liste des jours réservables (selon l'horizon réglé) — sert au calendrier
  // de créneaux ET au choix du jour de livraison.
  useEffect(() => {
    let annule = false;
    const construire = (horizon) => {
      const liste = [];
      const base = new Date();
      base.setHours(0, 0, 0, 0);
      for (let i = 0; i < horizon; i++) {
        const j = new Date(base);
        j.setDate(base.getDate() + i);
        liste.push(isoJour(j));
      }
      setJours(liste);
      setJourChoisi(liste[0]);
    };
    fetch("/api/creneaux")
      .then((r) => r.json())
      .then((d) => !annule && construire(d?.reglage?.joursHorizon || 14))
      .catch(() => !annule && construire(14));
    return () => {
      annule = true;
    };
  }, []);

  // Durée réelle de la prestation (Mode A : durée du soin choisi).
  const dureeActuelle =
    service === "domicile"
      ? (actes?.[acteChoisi]?.dureeMin ?? ACTES_DEFAUT[acteChoisi]?.dureeMin ?? 60)
      : 60;

  // Créneaux du jour choisi — calculés par le moteur de ressources
  // (durée du soin, commune, type de véhicule).
  useEffect(() => {
    if (!jourChoisi || !besoinCreneau) return;
    let annule = false;
    setCreneaux(null);
    setSlotChoisi("");
    const u = new URLSearchParams({ service, jour: jourChoisi, duree: String(dureeActuelle) });
    if (communeFiltre.trim()) u.set("commune", communeFiltre.trim());
    if (service === "transport") u.set("typeTrajet", typeTrajet);
    fetch(`/api/creneaux?${u}`)
      .then((r) => r.json())
      .then((d) => !annule && setCreneaux(d.creneaux || []))
      .catch(() => !annule && setCreneaux([]));
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jourChoisi, service, besoinCreneau, dureeActuelle, communeFiltre, typeTrajet]);

  // Fenêtres de livraison du jour, avec capacité restante.
  useEffect(() => {
    if (service !== "medicaments" || !jourChoisi) return;
    let annule = false;
    setFenetres(null);
    fetch(`/api/creneaux?service=medicaments&jour=${jourChoisi}`)
      .then((r) => r.json())
      .then((d) => !annule && setFenetres(d.fenetres || null))
      .catch(() => !annule && setFenetres(null));
    return () => {
      annule = true;
    };
  }, [service, jourChoisi]);

  // Types d'actes (Mode A) : ceux du back-office, sinon la liste par défaut.
  useEffect(() => {
    if (service !== "domicile") return;
    let annule = false;
    fetch("/api/actes")
      .then((r) => r.json())
      .then((d) => !annule && setActes(d.actes?.length ? d.actes : null))
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [service]);

  const listeActes = actes || ACTES_DEFAUT.map((a) => ({ ...a, libelle: t(a.cle) }));
  const libelleActe = (a) => (langue === "ar" && a.libelleAr ? a.libelleAr : a.libelle);

  function libelleJour(iso) {
    const d = new Date(iso + "T12:00");
    const auj = isoJour(new Date());
    const dem = isoJour(new Date(Date.now() + 86400000));
    if (iso === auj) return { haut: t("aujourdhui"), bas: "" };
    if (iso === dem) return { haut: t("demain"), bas: "" };
    const loc = langue === "ar" ? "ar" : "fr-FR";
    return {
      haut: d.toLocaleDateString(loc, { weekday: "short" }),
      bas: d.toLocaleDateString(loc, { day: "numeric", month: "short" }),
    };
  }

  const basculerBesoin = (cle) =>
    setBesoins((b) => (b.includes(cle) ? b.filter((x) => x !== cle) : [...b, cle]));
  const basculerJourAbo = (i) =>
    setAboJours((l) => (l.includes(i) ? l.filter((x) => x !== i) : [...l, i].sort()));

  function detailsStructures(extra = {}) {
    const d = {
      ...extra,
      besoins: besoins.map((cle) => t(cle)),
      acces: acces.trim() || undefined,
      code: code.trim() || undefined,
      prevenirNom: prevenirNom.trim() || undefined,
      prevenirTel: prevenirTel.trim() || undefined,
    };
    const rempli =
      d.besoins.length || d.acces || d.code || d.prevenirNom || d.prevenirTel || Object.keys(extra).length;
    return rempli ? JSON.stringify(d) : null;
  }

  async function confirmer() {
    setErreur("");
    if (telephone.trim().length < 9) {
      setErreur(t("err_tel"));
      return;
    }

    // --- Abonnement (transport régulier) ---
    if (service === "transport" && sousMode === "abonnement") {
      if (aboJours.length === 0) return setErreur(t("err_jours"));
      if (!destination.trim()) return setErreur(t("err_centre"));
      setEnvoi(true);
      try {
        const r = await fetch("/api/abonnements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telephone, typeTrajet, jours: aboJours, heure: aboHeure,
            centre: destination, domicile: depart, retour: aboRetour,
            debut: aboDebut, notes, espace: espaceChoisi,
          }),
        });
        if (!r.ok) throw new Error();
        setConfirme("abonnement");
      } catch {
        setErreur(`${t("err_serveur")} ${TEL_AFFICHE}.`);
      } finally {
        setEnvoi(false);
      }
      return;
    }

    // --- Demande simple (ponctuel / urgent / domicile / livraison) ---
    const urgent = service === "transport" && sousMode === "urgent";
    const livraison = service === "medicaments";

    let date = slotChoisi;
    if (urgent) date = "au plus tôt";
    if (livraison) date = jourChoisi;
    if (besoinCreneau && !slotChoisi) return setErreur(t("err_creneau"));

    const acte = service === "domicile" ? listeActes[acteChoisi] : null;

    setEnvoi(true);
    try {
      // Réservation au nom d'un patient : jeton requis (contrôle procuration).
      const entetes = { "Content-Type": "application/json" };
      if (pourPatient?.tel) {
        const { supabase } = await import("@/lib/supabase");
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) entetes.Authorization = `Bearer ${session.access_token}`;
      }
      const r = await fetch("/api/demandes", {
        method: "POST",
        headers: entetes,
        body: JSON.stringify({
          service,
          pourPatient: pourPatient?.tel || undefined,
          prefGenre: prefGenre || undefined,
          typeTrajet: service === "transport" ? typeTrajet : null,
          depart,
          destination,
          date,
          telephone,
          notes,
          details: detailsStructures(
            acte ? { acte: `${acte.libelle || t(acte.cle)} (≈ ${acte.dureeMin} min)` } : {}
          ),
          espace: espaceChoisi,
          sousMode: urgent ? "urgent" : livraison ? "fenetre" : "ponctuel",
          fenetre: livraison ? FENETRES.find((f) => f.id === fenetre)?.fr : undefined,
          pharmacie: livraison ? pharmacie.trim() || undefined : undefined,
          duree: dureeActuelle,
          commune: commune.trim() || undefined,
        }),
      });
      if (r.status === 409) {
        const dErr = await r.json().catch(() => ({}));
        if (dErr.erreur === "fenetre_pleine") {
          setErreur(t("err_fenetre_pleine"));
          const rf = await fetch(`/api/creneaux?service=medicaments&jour=${jourChoisi}`);
          const df = await rf.json().catch(() => ({}));
          setFenetres(df.fenetres || null);
          return;
        }
        setErreur(t("err_creneau_pris"));
        const u = new URLSearchParams({ service, jour: jourChoisi, duree: String(dureeActuelle) });
        if (communeFiltre.trim()) u.set("commune", communeFiltre.trim());
        const rc = await fetch(`/api/creneaux?${u}`);
        const dc = await rc.json();
        setCreneaux(dc.creneaux || []);
        setSlotChoisi("");
        return;
      }
      if (r.status === 403) {
        const dErr = await r.json().catch(() => ({}));
        setErreur(
          dErr.erreur === "service_hors_perimetre" ? t("pp_hors_perimetre")
          : dErr.erreur === "procuration_expiree" ? t("pp_expiree")
          : t("pp_refus")
        );
        return;
      }
      if (!r.ok) throw new Error();
      if (pourPatient) {
        try { sessionStorage.removeItem("asm_pour_patient"); } catch {}
      }
      setConfirme(urgent ? "urgent" : livraison ? "livraison" : "standard");
    } catch {
      setErreur(`${t("err_serveur")} ${TEL_AFFICHE}.`);
    } finally {
      setEnvoi(false);
    }
  }

  if (confirme) {
    const monEspace = espaceChoisi === "pro" ? "/pro" : "/tableau";
    const message = {
      standard: t("rdv_ok_p"),
      urgent: t("rdv_ok_urgent"),
      abonnement: t("rdv_ok_abo"),
      livraison: t("rdv_ok_liv"),
    }[confirme];
    return (
      <div className="page">
        <div className="contenu-page" style={{ maxWidth: 460 }}>
          <div className="confirmation">
            <div className="rond-ok">✓</div>
            <h2 style={{ fontSize: 21, marginBottom: 6 }}>{t("rdv_ok_t")}</h2>
            <p style={{ color: "var(--gris)" }}>{message}</p>
            {confirme === "livraison" && (
              <Link className="btn-action" style={{ marginTop: 18 }} href="/documentation">
                {t("rdv_ok_doc")}
              </Link>
            )}
            <Link
              className={confirme === "livraison" ? "btn-secondaire" : "btn-action"}
              style={{ marginTop: confirme === "livraison" ? 10 : 18 }}
              href="/suivi"
            >
              {t("rdv_ok_suivre")}
            </Link>
            <Link className="btn-secondaire" style={{ marginTop: 10 }} href={monEspace}>
              {t("rdv_ok_tableau")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 460 }}>
        <Link className="btn-retour" href="/accueil">
          {t("retour")}
        </Link>
        <h2 className="titre-page">{t("rdv_t")}</h2>
        <p className="sous-page">{t(CLES_SERVICE[service])}</p>

        {pourPatient && (
          <div className="pour-patient">
            <span>👤 {t("pp_bandeau")} <strong>{pourPatient.nom}</strong></span>
            <button type="button" onClick={annulerPourPatient}>{t("annuler")}</button>
          </div>
        )}

        {/* ---- Pour qui ? (proches autorisés du compte connecté) ---- */}
        {!pourPatient && proches.length > 0 && (
          <div className="champ">
            <label>{t("pr_pour_qui")}</label>
            <div className="chips">
              <button type="button" className="chip actif">{t("pr_moi")}</button>
              {proches.map((p) => (
                <button type="button" className="chip" key={p.id} onClick={() => choisirProche(p)}>
                  👤 {p.patientNom || p.patientTel}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---- Mode B : choix du type de demande de transport ---- */}
        {service === "transport" && (
          <div className="champ">
            <label>{t("mode_l")}</label>
            <div className="chips">
              {[
                ["ponctuel", "mode_ponctuel"],
                ["abonnement", "mode_abo"],
                ["urgent", "mode_urgent"],
              ].map(([id, cle]) => (
                <button
                  type="button"
                  key={id}
                  className={"chip" + (sousMode === id ? " actif" : "")}
                  aria-pressed={sousMode === id}
                  onClick={() => setSousMode(id)}
                >
                  {t(cle)}
                </button>
              ))}
            </div>
            {sousMode === "urgent" && <p className="precisions-aide" style={{ marginTop: 8 }}>{t("urgent_info")}</p>}
            {sousMode === "abonnement" && <p className="precisions-aide" style={{ marginTop: 8 }}>{t("abo_info")}</p>}
          </div>
        )}

        {service === "transport" && (
          <div className="champ">
            <label>{t("type_trajet_l")}</label>
            <select value={typeTrajet} onChange={(e) => setTypeTrajet(e.target.value)}>
              <option value="simple">{t("tr_simple")}</option>
              <option value="accompagne">{t("tr_accomp")}</option>
              <option value="medicalise">{t("tr_medic")}</option>
            </select>
          </div>
        )}

        {/* ---- Mode A : type de soin ---- */}
        {service === "domicile" && (
          <div className="champ">
            <label>{t("acte_l")}</label>
            <select value={acteChoisi} onChange={(e) => setActeChoisi(Number(e.target.value))}>
              {listeActes.map((a, i) => (
                <option value={i} key={a.id}>
                  {libelleActe(a)} — ≈ {a.dureeMin} {t("duree_min")}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ---- Préférence d'intervenant(e) — respectée si possible ---- */}
        {service === "domicile" && (
          <div className="champ">
            <label>{t("genre_l")}</label>
            <div className="chips">
              {[["", "genre_indif"], ["femme", "genre_femme"], ["homme", "genre_homme"]].map(([v, cle]) => (
                <button type="button" key={cle} className={"chip" + (prefGenre === v ? " actif" : "")} onClick={() => setPrefGenre(v)}>
                  {t(cle)}
                </button>
              ))}
            </div>
            <p className="fe-aide" style={{ marginBottom: 0 }}>{t("genre_aide")}</p>
          </div>
        )}

        {/* ---- Adresses ---- */}
        {service === "transport" ? (
          <>
            <div className="champ">
              <label>{t("depart_l")}</label>
              <input type="text" placeholder={t("depart_ph")} value={depart} onChange={(e) => setDepart(e.target.value)} />
            </div>
            <div className="champ">
              <label>{sousMode === "abonnement" ? t("abo_centre_l") : t("dest_l")}</label>
              <input type="text" placeholder={t("dest_ph")} value={destination} onChange={(e) => setDestination(e.target.value)} />
            </div>
          </>
        ) : (
          <div className="champ">
            <label>{t("adresse_l")}</label>
            <input type="text" placeholder={t("adresse_ph")} value={depart} onChange={(e) => setDepart(e.target.value)} />
          </div>
        )}

        {/* Commune : filtre de zone du moteur (domicile + transport) */}
        {service !== "medicaments" && (
          <div className="champ">
            <label>{t("commune_l")}</label>
            <input
              type="text"
              placeholder={t("commune_ph")}
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              onBlur={() => setCommuneFiltre(commune)}
            />
          </div>
        )}

        {/* ---- Mode C : pharmacie + jour + fenêtre ---- */}
        {service === "medicaments" && (
          <>
            <div className="champ">
              <label>{t("pharmacie_l")}</label>
              <input type="text" placeholder={t("pharmacie_ph")} value={pharmacie} onChange={(e) => setPharmacie(e.target.value)} />
            </div>
            <div className="champ">
              <label>{t("liv_jour_l")}</label>
              <div className="jours-scroll">
                {jours.map((j) => {
                  const l = libelleJour(j);
                  return (
                    <button key={j} className={"jour-chip" + (j === jourChoisi ? " actif" : "")} onClick={() => setJourChoisi(j)}>
                      <strong>{l.haut}</strong>
                      {l.bas && <small>{l.bas}</small>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="champ">
              <label>{t("liv_fenetre_l")}</label>
              <div className="chips">
                {FENETRES.map((f) => {
                  const info = fenetres?.find((x) => x.id === f.id);
                  const complet = Boolean(info?.complet);
                  return (
                    <button
                      type="button"
                      key={f.id}
                      disabled={complet}
                      className={"chip" + (fenetre === f.id ? " actif" : "") + (complet ? " pris" : "")}
                      aria-pressed={fenetre === f.id}
                      onClick={() => setFenetre(f.id)}
                    >
                      {t(f.cle)}
                      {complet ? ` — ${t("complet")}` : info?.presqueComplet ? ` — ${t("presque_complet")}` : ""}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="precisions-aide">{t("ordonnance_info")}</p>
          </>
        )}

        {/* ---- Abonnement : jours + heure + retour + début ---- */}
        {service === "transport" && sousMode === "abonnement" && (
          <>
            <div className="champ">
              <label>{t("abo_jours_l")}</label>
              <div className="chips">
                {JOURS_SEMAINE.map((cle, i) => (
                  <button
                    type="button"
                    key={cle}
                    className={"chip" + (aboJours.includes(i) ? " actif" : "")}
                    aria-pressed={aboJours.includes(i)}
                    onClick={() => basculerJourAbo(i)}
                  >
                    {t(cle)}
                  </button>
                ))}
              </div>
            </div>
            <div className="champ">
              <label>{t("abo_heure_l")}</label>
              <select value={aboHeure} onChange={(e) => setAboHeure(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => 7 + i).map((h) => {
                  const v = `${String(h).padStart(2, "0")}:00`;
                  return (
                    <option value={v} key={v}>
                      {h}h00
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="champ">
              <label>{t("abo_debut_l")}</label>
              <input type="date" min={isoJour(new Date())} value={aboDebut} onChange={(e) => setAboDebut(e.target.value)} />
            </div>
            <label className="case-ligne">
              <input type="checkbox" checked={aboRetour} onChange={(e) => setAboRetour(e.target.checked)} />
              {t("abo_retour_l")}
            </label>
          </>
        )}

        {/* ---- Calendrier de créneaux (ponctuel + domicile) ---- */}
        {besoinCreneau && (
          <div className="champ">
            <label>{t("creneau_titre")}</label>
            <div className="jours-scroll">
              {jours.map((j) => {
                const l = libelleJour(j);
                return (
                  <button key={j} className={"jour-chip" + (j === jourChoisi ? " actif" : "")} onClick={() => setJourChoisi(j)}>
                    <strong>{l.haut}</strong>
                    {l.bas && <small>{l.bas}</small>}
                  </button>
                );
              })}
            </div>

            {creneaux === null && <div className="creneaux-info">{t("creneau_charge")}</div>}
            {creneaux !== null && creneaux.filter((c) => c.dispo).length === 0 && (
              <div className="creneaux-info">{t("creneau_aucun")}</div>
            )}
            {creneaux !== null && creneaux.some((c) => c.dispo) && (
              <div className="creneaux-grille">
                {creneaux.map((c) => (
                  <button
                    key={c.iso}
                    disabled={!c.dispo}
                    className={"creneau-btn" + (slotChoisi === c.iso ? " actif" : "") + (!c.dispo ? " pris" : "")}
                    onClick={() => setSlotChoisi(c.iso)}
                  >
                    {c.heure}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="champ">
          <label>{t("tel_l")}</label>
          <input type="tel" placeholder={t("tel_ph")} value={telephone} onChange={(e) => setTelephone(e.target.value)} />
        </div>

        {/* ---- Précisions structurées (facultatives) ---- */}
        <div className="bloc-precisions">
          <div className="titre-section">{t("precisions_t")}</div>
          <p className="precisions-aide">{t("precisions_s")}</p>

          <label className="mini-label">{t("besoins_t")}</label>
          <div className="chips">
            {BESOINS.map((cle) => (
              <button
                type="button"
                key={cle}
                className={"chip" + (besoins.includes(cle) ? " actif" : "")}
                aria-pressed={besoins.includes(cle)}
                onClick={() => basculerBesoin(cle)}
              >
                {t(cle)}
              </button>
            ))}
          </div>

          <div className="champ" style={{ marginTop: 14 }}>
            <label>{t("acces_l")}</label>
            <input type="text" placeholder={t("acces_ph")} value={acces} onChange={(e) => setAcces(e.target.value)} />
          </div>
          <div className="champ">
            <label>{t("codeporte_l")}</label>
            <input type="text" placeholder={t("codeporte_ph")} value={code} onChange={(e) => setCode(e.target.value)} />
          </div>

          <label className="mini-label" style={{ marginTop: 6 }}>{t("prevenir_t")}</label>
          <div className="champ">
            <input type="text" placeholder={t("prevenir_nom_ph")} value={prevenirNom} onChange={(e) => setPrevenirNom(e.target.value)} aria-label={t("prevenir_nom_l")} />
          </div>
          <div className="champ">
            <input type="tel" placeholder={t("prevenir_tel_ph")} value={prevenirTel} onChange={(e) => setPrevenirTel(e.target.value)} aria-label={t("prevenir_tel_l")} />
          </div>

          <div className="champ">
            <label>{t("notes_l")}</label>
            <textarea rows={2} placeholder={t("notes_ph")} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Prix estimé AVANT confirmation — mêmes règles que la facturation */}
        <EstimationPrix
          t={t}
          service={service}
          jour={jourChoisi}
          heure={service === "transport" && sousMode === "urgent" ? "" : slotChoisi}
          duree={dureeActuelle}
          typeTrajet={service === "transport" ? typeTrajet : undefined}
          prioritaire={service === "transport" && sousMode === "urgent"}
          visible={sousMode !== "abonnement"}
        />

        {/* Message urgence vitale (rassurant, non anxiogène) */}
        <p className="note-urgence">{t("urgence_vitale")}</p>

        <button className="btn-action" onClick={confirmer} disabled={envoi}>
          {envoi ? t("envoi") : t("rdv_b")}
        </button>
        {erreur && <p className="erreur">{erreur}</p>}
      </div>
    </div>
  );
}

// ---- Prix estimé avant réservation ----
// Interroge les tarifs en vigueur (mêmes règles que la facture finale) et la
// remise du client connecté. N'affiche RIEN tant que la grille tarifaire
// n'est pas configurée, ni pendant la saisie incomplète.
function EstimationPrix({ t, service, jour, heure, duree, typeTrajet, prioritaire, visible }) {
  const [est, setEst] = useState(null);

  useEffect(() => {
    let annule = false;
    setEst(null);
    if (!visible || !jour) return;
    (async () => {
      try {
        const u = new URLSearchParams({ service, duree: String(duree || 60) });
        u.set("date", `${jour}T${heure || "09:00"}`);
        if (typeTrajet) u.set("typeTrajet", typeTrajet);
        if (prioritaire) u.set("prioritaire", "1");
        let token = "";
        try {
          const { supabase } = await import("@/lib/supabase");
          const { data: { session } } = await supabase.auth.getSession();
          token = session?.access_token || "";
        } catch {}
        const r = await fetch(`/api/finances/estimation?${u.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const d = await r.json();
        if (!annule && r.ok && d.disponible) setEst(d);
      } catch {}
    })();
    return () => { annule = true; };
  }, [visible, service, jour, heure, duree, typeTrajet, prioritaire]);

  if (!est) return null;
  return (
    <div className="estimation">
      <div className="estimation-tete">
        <strong>{t("est_t")}</strong>
        <strong className="estimation-total">{est.total.toLocaleString("fr-FR")} {est.devise}</strong>
      </div>
      <ul>
        {est.lignes.map((l, i) => (
          <li key={i}>
            <span>{l.libelle}{l.quantite > 1 ? ` × ${l.quantite}` : ""}</span>
            <span>{l.montant.toLocaleString("fr-FR")}</span>
          </li>
        ))}
        {est.remiseTotal > 0 && (
          <li className="estimation-remise">
            <span>{est.remiseDetail || t("est_remise")}</span>
            <span>-{est.remiseTotal.toLocaleString("fr-FR")}</span>
          </li>
        )}
      </ul>
      <small>{t("est_note")}</small>
    </div>
  );
}
