"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAsm } from "@/app/providers";
import { supabase } from "@/lib/supabase";

// Préférences de soin : consignes pratiques transmises UNIQUEMENT à
// l'intervenant affecté (allergies, accès), préférence homme/femme et
// intervenant favori — priorisés par l'affectation automatique.

async function api(options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch("/api/preferences", {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
      ...(options.headers || {}),
    },
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.erreur || "erreur");
  return d;
}

export default function PreferencesSoin() {
  const { t, connecte } = useAsm();
  const [d, setD] = useState(undefined);
  const [f, setF] = useState({ allergies: "", etage: "", codePorte: "", consignes: "", prefGenre: "", soignantFavoriId: "" });
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api()
      .then((r) => {
        setD(r);
        const p = r.preferences;
        if (p) {
          setF({
            allergies: p.allergies || "", etage: p.etage || "", codePorte: p.codePorte || "",
            consignes: p.consignes || "", prefGenre: p.prefGenre || "",
            soignantFavoriId: p.soignantFavoriId ? String(p.soignantFavoriId) : "",
          });
        }
      })
      .catch(() => setD(null));
  }, []);

  async function enregistrer() {
    setOccupe(true);
    setMsg("");
    try {
      await api({
        method: "POST",
        body: JSON.stringify({ ...f, soignantFavoriId: f.soignantFavoriId ? Number(f.soignantFavoriId) : null }),
      });
      setMsg(t("ps_ok"));
    } catch {
      setMsg(t("pr_err"));
    }
    setOccupe(false);
  }

  if (d === undefined) return <div className="page"><div className="contenu-page"><p className="sous-page">{t("compte_charge")}</p></div></div>;
  if (d === null || !connecte) {
    return (
      <div className="page"><div className="contenu-page" style={{ maxWidth: 480 }}>
        <h2 className="titre-page">{t("ps_t")}</h2>
        <p className="sous-page">{t("pf_connexion")}</p>
        <Link className="btn-action" href="/connexion">{t("connexion_t")}</Link>
      </div></div>
    );
  }

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 560 }}>
        <Link className="btn-retour" href="/compte">{t("retour")}</Link>
        <h2 className="titre-page">{t("ps_t")}</h2>
        <p className="sous-page">{t("ps_s")}</p>

        <div className="carte-compte">
          <div className="titre-section">{t("ps_intervenant_t")}</div>
          <div className="champ">
            <label>{t("genre_l")}</label>
            <div className="chips">
              {[["", "genre_indif"], ["femme", "genre_femme"], ["homme", "genre_homme"]].map(([v, cle]) => (
                <button type="button" key={cle} className={"chip" + (f.prefGenre === v ? " actif" : "")} onClick={() => setF({ ...f, prefGenre: v })}>
                  {t(cle)}
                </button>
              ))}
            </div>
          </div>
          {d.soignantsConnus.length > 0 && (
            <div className="champ">
              <label>{t("ps_favori_l")}</label>
              <select value={f.soignantFavoriId} onChange={(e) => setF({ ...f, soignantFavoriId: e.target.value })}>
                <option value="">{t("ps_favori_aucun")}</option>
                {d.soignantsConnus.map((sc) => (
                  <option value={sc.id} key={sc.id}>{sc.nom}</option>
                ))}
              </select>
              <p className="fe-aide" style={{ marginBottom: 0 }}>{t("ps_favori_aide")}</p>
            </div>
          )}
        </div>

        <div className="carte-compte">
          <div className="titre-section">{t("ps_consignes_t")}</div>
          <p className="fe-aide" style={{ marginTop: 0 }}>{t("ps_consignes_aide")}</p>
          <div className="champ">
            <label>{t("ps_allergies_l")}</label>
            <input value={f.allergies} onChange={(e) => setF({ ...f, allergies: e.target.value })} placeholder={t("ps_allergies_ph")} />
          </div>
          <div className="champ">
            <label>{t("ps_etage_l")}</label>
            <input value={f.etage} onChange={(e) => setF({ ...f, etage: e.target.value })} placeholder={t("ps_etage_ph")} />
          </div>
          <div className="champ">
            <label>{t("ps_code_l")}</label>
            <input value={f.codePorte} onChange={(e) => setF({ ...f, codePorte: e.target.value })} placeholder={t("ps_code_ph")} />
          </div>
          <div className="champ">
            <label>{t("ps_autres_l")}</label>
            <textarea rows={3} value={f.consignes} onChange={(e) => setF({ ...f, consignes: e.target.value })} placeholder={t("ps_autres_ph")} />
          </div>
        </div>

        <button className="btn-action" onClick={enregistrer} disabled={occupe}>
          {occupe ? t("otp_envoi") : t("ps_enregistrer")}
        </button>
        {msg && <p className="adm-msg" style={{ marginTop: 10 }}>{msg}</p>}
      </div>
    </div>
  );
}
