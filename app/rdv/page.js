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

// Prise de rendez-vous : la demande part dans la base et l'équipe
// rappelle en moins de 30 minutes.
export default function PriseRdv() {
  const { t, serviceEnCours, espaceChoisi } = useAsm();
  const service = serviceEnCours || "transport";

  const [typeTrajet, setTypeTrajet] = useState("simple");
  const [depart, setDepart] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [recurrence, setRecurrence] = useState("une");
  const [telephone, setTelephone] = useState("");
  const [notes, setNotes] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [confirme, setConfirme] = useState(false);

  const RECURRENCES = {
    une: t("rec_une"),
    dialyse: t("rec_dialyse"),
    choix: t("rec_choix"),
    conseiller: t("rec_conseiller"),
  };

  async function confirmer() {
    setErreur("");
    if (telephone.trim().length < 9) {
      setErreur(t("err_tel"));
      return;
    }
    setEnvoi(true);
    try {
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
          espace: espaceChoisi,
        }),
      });
      if (!r.ok) throw new Error();
      // Mémorise la demande sur l'appareil pour l'afficher dans « Mes rendez-vous »
      // (en attendant les comptes réels, où l'historique viendra du serveur)
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
            <Link className="btn-secondaire" style={{ marginTop: 10 }} href="/tableau">
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
          <input
            type="text"
            placeholder={t("depart_ph")}
            value={depart}
            onChange={(e) => setDepart(e.target.value)}
          />
        </div>
        <div className="champ">
          <label>{t("dest_l")}</label>
          <input
            type="text"
            placeholder={t("dest_ph")}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
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
          <input
            type="tel"
            placeholder={t("tel_ph")}
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
          />
        </div>
        <div className="champ">
          <label>{t("notes_l")}</label>
          <textarea
            rows={3}
            placeholder={t("notes_ph")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <button className="btn-action" onClick={confirmer} disabled={envoi}>
          {envoi ? t("envoi") : t("rdv_b")}
        </button>
        {erreur && <p className="erreur">{erreur}</p>}
      </div>
    </div>
  );
}
