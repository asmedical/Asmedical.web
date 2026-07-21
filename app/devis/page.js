"use client";
import Link from "next/link";
import { useState } from "react";
import { useAsm } from "@/app/providers";

// Demande de devis (besoins récurrents, familles, établissements) :
// l'équipe chiffre puis recontacte — aucun montant automatique.

export default function Devis() {
  const { t } = useAsm();
  const [f, setF] = useState({ nom: "", telephone: "", email: "", service: "", besoin: "" });
  const [etat, setEtat] = useState(""); // "" | envoi | ok | message d'erreur
  const [numero, setNumero] = useState("");

  async function envoyer(e) {
    e.preventDefault();
    setEtat("envoi");
    try {
      const r = await fetch("/api/devis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erreur || "erreur");
      setNumero(d.numero);
      setEtat("ok");
    } catch (err) {
      setEtat(err.message === "besoin_trop_court" ? t("dv_err_besoin") : t("dv_err"));
    }
  }

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 560 }}>
        <Link className="btn-retour" href="/accueil">{t("retour")}</Link>
        <h2 className="titre-page">{t("dv_t")}</h2>
        <p className="sous-page">{t("dv_s")}</p>

        {etat === "ok" ? (
          <div className="fin-bulle ok">
            <strong>{t("dv_ok_t")} ({numero})</strong>
            <span>{t("dv_ok_p")}</span>
          </div>
        ) : (
          <form onSubmit={envoyer}>
            <div className="champ">
              <label>{t("pr_nom_l")} *</label>
              <input required value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
            </div>
            <div className="champ">
              <label>{t("tel_l")} *</label>
              <input required inputMode="tel" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} placeholder="0550 12 34 56" />
            </div>
            <div className="champ">
              <label>{t("email_l")}</label>
              <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div className="champ">
              <label>{t("dv_service_l")}</label>
              <select value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}>
                <option value="">{t("dv_service_tous")}</option>
                <option value="transport">{t("s_transport")}</option>
                <option value="domicile">{t("s_domicile")}</option>
                <option value="medicaments">{t("s_medic")}</option>
              </select>
            </div>
            <div className="champ">
              <label>{t("dv_besoin_l")} *</label>
              <textarea required rows={4} value={f.besoin} onChange={(e) => setF({ ...f, besoin: e.target.value })} placeholder={t("dv_besoin_ph")} />
            </div>
            <button className="btn-action" type="submit" disabled={etat === "envoi"}>
              {etat === "envoi" ? t("otp_envoi") : t("dv_envoyer")}
            </button>
            {etat && etat !== "envoi" && etat !== "ok" && <p className="erreur">{etat}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
