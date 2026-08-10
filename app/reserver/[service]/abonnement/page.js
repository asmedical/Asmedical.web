"use client";
import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useAsm } from "@/app/providers";
import { useParcours } from "@/app/components/parcours";

// Besoin régulier (dialyse, chimiothérapie) → parcours abonnement.
//
// On ne montre AUCUN créneau : un patient dialysé vient trois fois par
// semaine, aux mêmes heures, pendant des mois. Cela se cale avec la
// régulation, pas en cliquant sur une heure isolée — afficher des créneaux
// temps réel ici reviendrait à promettre ce qu'on ne peut pas tenir.
//
// La demande part donc en confirmation humaine, avec rappel sous 30 minutes.

const JOURS = ["j_dim", "j_lun", "j_mar", "j_mer", "j_jeu", "j_ven", "j_sam"];

export default function Abonnement() {
  const { t } = useAsm();
  const { service } = useParams();
  const [d] = useParcours();

  const [jours, setJours] = useState([]);
  const [heure, setHeure] = useState("08:00");
  const [centre, setCentre] = useState("");
  const [domicile, setDomicile] = useState("");
  const [telephone, setTelephone] = useState("");
  const [retour, setRetour] = useState(true);
  const [etat, setEtat] = useState("saisie"); // saisie | envoi | ok
  const [erreur, setErreur] = useState("");

  const basculer = (i) =>
    setJours((l) => (l.includes(i) ? l.filter((x) => x !== i) : [...l, i].sort()));

  async function envoyer() {
    if (etat === "envoi") return;
    setErreur("");
    if (!jours.length) return setErreur(t("err_jours"));
    if (!centre.trim()) return setErreur(t("err_centre"));
    if (telephone.replace(/\D/g, "").length < 9) return setErreur(t("err_tel_format"));

    setEtat("envoi");
    try {
      const r = await fetch("/api/abonnements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telephone,
          jours,
          heure,
          centre,
          domicile,
          retour,
          notes: d?.type ? `Type : ${d.type}` : "",
        }),
      });
      if (!r.ok) throw new Error();
      setEtat("ok");
    } catch {
      setErreur(t("err_serveur"));
      setEtat("saisie");
    }
  }

  if (etat === "ok") {
    return (
      <div className="page">
        <div className="contenu-page" style={{ maxWidth: 520 }}>
          <h2 className="titre-page">{t("pc_succes_t")}</h2>
          <div className="fin-bulle ok">
            <strong>{t("pc_recurrent_t")}</strong>
            <span>{t("pc_succes_p")}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 560 }}>
        <Link className="btn-retour" href={`/reserver/${service}/besoin`}>{t("pc_retour")}</Link>
        <h2 className="titre-page">{t("pc_recurrent_t")}</h2>
        <p className="sous-page">{t("pc_recurrent_p")}</p>

        <div className="champ">
          <label>{t("abo_jours_l")}</label>
          <div className="chips">
            {JOURS.map((cle, i) => (
              <button
                type="button"
                key={cle}
                className={"chip" + (jours.includes(i) ? " actif" : "")}
                aria-pressed={jours.includes(i)}
                onClick={() => basculer(i)}
              >
                {t(cle)}
              </button>
            ))}
          </div>
        </div>

        <div className="champ">
          <label>{t("abo_heure_l")}</label>
          <select value={heure} onChange={(e) => setHeure(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => 7 + i).map((h) => {
              const v = `${String(h).padStart(2, "0")}:00`;
              return <option value={v} key={v}>{h}h00</option>;
            })}
          </select>
        </div>

        <div className="champ">
          <label>{t("abo_centre_l")}</label>
          <input value={centre} onChange={(e) => setCentre(e.target.value)} placeholder={t("dest_ph")} />
        </div>

        <div className="champ">
          <label>{t("depart_l")}</label>
          <input value={domicile} onChange={(e) => setDomicile(e.target.value)} placeholder={t("depart_ph")} />
        </div>

        <div className="champ">
          <label>{t("tel_l")}</label>
          <input inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder={t("tel_ph")} />
        </div>

        <label className="case-ligne">
          <input type="checkbox" checked={retour} onChange={(e) => setRetour(e.target.checked)} />
          <span>{t("abo_retour_l")}</span>
        </label>

        {erreur && <p className="erreur">{erreur}</p>}
        <button className="btn-action" onClick={envoyer} disabled={etat === "envoi"}>
          {etat === "envoi" ? t("otp_envoi") : t("pc_recurrent_b")}
        </button>
      </div>
    </div>
  );
}
