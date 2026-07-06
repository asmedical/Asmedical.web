"use client";
import Link from "next/link";
import { useState } from "react";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE } from "@/lib/i18n";

const CLES_SERVICE = {
  transport: "rdv_service_transport",
  domicile: "rdv_service_domicile",
  medicaments: "rdv_service_medicaments",
};

// Besoins particuliers proposés en « chips » (multi-sélection).
const BESOINS = [
  "b_fauteuil", "b_oxygene", "b_marche", "b_alite", "b_accompagnateur",
  "b_infirmier", "b_age", "b_dialyse", "b_chimio", "b_postop", "b_enfant",
];

// Prise de rendez-vous : la demande part dans la base et l'équipe
// rappelle en moins de 30 minutes.
export default function PriseRdv() {
  const { t, serviceEnCours, espaceChoisi } = useAsm();
  const service = serviceEnCours || "transport";
  // Après confirmation, retour vers l'espace d'où l'on vient
  const monEspace = espaceChoisi === "pro" ? "/pro" : "/tableau";

  const [typeTrajet, setTypeTrajet] = useState("simple");
  const [depart, setDepart] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [recurrence, setRecurrence] = useState("une");
  const [telephone, setTelephone] = useState("");
  const [notes, setNotes] = useState("");

  // Précisions structurées
  const [besoins, setBesoins] = useState([]);
  const [acces, setAcces] = useState("");
  const [code, setCode] = useState("");
  const [prevenirNom, setPrevenirNom] = useState("");
  const [prevenirTel, setPrevenirTel] = useState("");

  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [confirme, setConfirme] = useState(false);

  const RECURRENCES = {
    une: t("rec_une"),
    dialyse: t("rec_dialyse"),
    choix: t("rec_choix"),
    conseiller: t("rec_conseiller"),
  };

  const basculerBesoin = (cle) =>
    setBesoins((b) => (b.includes(cle) ? b.filter((x) => x !== cle) : [...b, cle]));

  async function confirmer() {
    setErreur("");
    if (telephone.trim().length < 9) {
      setErreur(t("err_tel"));
      return;
    }
    setEnvoi(true);
    try {
      // Précisions structurées sérialisées (libellés FR pour lisibilité back-office)
      const details = {
        besoins: besoins.map((cle) => t(cle)),
        acces: acces.trim() || undefined,
        code: code.trim() || undefined,
        prevenirNom: prevenirNom.trim() || undefined,
        prevenirTel: prevenirTel.trim() || undefined,
      };
      const aDesDetails =
        details.besoins.length || details.acces || details.code || details.prevenirNom || details.prevenirTel;

      const r = await fetch("/api/demandes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service,
          typeTrajet: service === "transport" ? typeTrajet : null,
          depart,
          destination,
          date,
          recurrence: RECURRENCES[recurrence],
          telephone,
          notes,
          details: aDesDetails ? JSON.stringify(details) : null,
          espace: espaceChoisi,
        }),
      });
      if (!r.ok) throw new Error();
      try {
        const liste = JSON.parse(localStorage.getItem("asm_demandes") || "[]");
        liste.unshift({ service, date, destination, recurrence: RECURRENCES[recurrence] });
        localStorage.setItem("asm_demandes", JSON.stringify(liste.slice(0, 10)));
      } catch {}
      setConfirme(true);
    } catch {
      setErreur(`${t("err_serveur")} ${TEL_AFFICHE}.`);
    } finally {
      setEnvoi(false);
    }
  }

  if (confirme) {
    return (
      <div className="page">
        <div className="contenu-page" style={{ maxWidth: 460 }}>
          <div className="confirmation">
            <div className="rond-ok">✓</div>
            <h2 style={{ fontSize: 21, marginBottom: 6 }}>{t("rdv_ok_t")}</h2>
            <p style={{ color: "var(--gris)" }}>{t("rdv_ok_p")}</p>
            <Link className="btn-action" style={{ marginTop: 18 }} href="/suivi">
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
        <div className="champ">
          <label>{t("depart_l")}</label>
          <input type="text" placeholder={t("depart_ph")} value={depart} onChange={(e) => setDepart(e.target.value)} />
        </div>
        <div className="champ">
          <label>{t("dest_l")}</label>
          <input type="text" placeholder={t("dest_ph")} value={destination} onChange={(e) => setDestination(e.target.value)} />
        </div>
        <div className="champ">
          <label>{t("date_l")}</label>
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {service === "transport" && (
          <div className="champ">
            <label>{t("rec_l")}</label>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              {Object.entries(RECURRENCES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
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
            <label>{t("code_l")}</label>
            <input type="text" placeholder={t("code_ph")} value={code} onChange={(e) => setCode(e.target.value)} />
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
