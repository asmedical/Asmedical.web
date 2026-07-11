"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAsm } from "@/app/providers";
import { supabase } from "@/lib/supabase";

const LIB_SCOPE = { transport: "aut_sc_transport", domicile: "aut_sc_domicile", medicaments: "aut_sc_medic" };

async function jeton() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// « Établissements autorisés » : le patient contrôle qui peut réserver
// pour lui (accepter / refuser / révoquer) et génère un code de
// rattachement à transmettre à son établissement.
export default function Autorisations() {
  const { t } = useAsm();
  const [donnees, setDonnees] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState("");

  async function charger() {
    const token = await jeton();
    if (!token) { setDonnees({ rattachements: [], anonyme: true }); return; }
    try {
      const r = await fetch("/api/rattachements", { headers: { Authorization: `Bearer ${token}` } });
      setDonnees(await r.json());
    } catch { setDonnees({ rattachements: [] }); }
  }
  useEffect(() => { charger(); }, []);

  async function agir(action, id) {
    setOccupe(true); setMsg("");
    try {
      const token = await jeton();
      const r = await fetch("/api/rattachements", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, id }),
      });
      if (!r.ok) throw new Error();
      if (action === "code") {
        const d = await r.json();
        setMsg(`${t("aut_code_pret")} : ${d.code}`);
      } else {
        setMsg(t("aut_fait"));
      }
      await charger();
    } catch { setMsg(t("err_serveur_court")); }
    setOccupe(false);
  }

  const scopesLisibles = (csv) =>
    String(csv || "").split(",").filter(Boolean).map((s) => t(LIB_SCOPE[s.trim()] || s)).join(" · ");

  if (!donnees) return <div className="page"><div className="contenu-page"><p className="sous-page">{t("compte_charge")}</p></div></div>;

  const enAttente = donnees.rattachements?.filter((r) => r.statut === "EN_ATTENTE") || [];
  const actifs = donnees.rattachements?.filter((r) => r.statut === "ACCEPTE") || [];
  const passes = donnees.rattachements?.filter((r) => ["REFUSE", "REVOQUE"].includes(r.statut)) || [];

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 520 }}>
        <Link className="btn-retour" href="/compte">{t("retour")}</Link>
        <h2 className="titre-page">{t("aut_t")}</h2>
        <p className="sous-page">{t("aut_s")}</p>

        {donnees.anonyme && (
          <div className="etat-vide">
            <p>{t("msg_connexion")}</p>
            <Link className="btn-action" style={{ marginTop: 14 }} href="/connexion">{t("connexion_t")}</Link>
          </div>
        )}

        {!donnees.anonyme && (
          <>
            {msg && <p className="adm-msg">{msg}</p>}

            {/* Code de rattachement */}
            <div className="fe-carte" style={{ marginBottom: 16 }}>
              <strong>{t("aut_code_t")}</strong>
              <p className="fe-aide" style={{ marginTop: 4 }}>{t("aut_code_s")}</p>
              {donnees.codeActif ? (
                <p className="aut-code">{donnees.codeActif.code}</p>
              ) : null}
              <button className={"adm-btn" + (occupe ? " btn-charge" : "")} style={{ marginTop: 10 }} disabled={occupe} onClick={() => agir("code")}>
                {donnees.codeActif ? t("aut_code_regen") : t("aut_code_btn")}
              </button>
            </div>

            {/* Demandes en attente */}
            {enAttente.length > 0 && (
              <>
                <div className="titre-section">{t("aut_attente")}</div>
                {enAttente.map((r) => (
                  <div className="fe-carte doc-emp" key={r.id}>
                    <div className="doc-emp-tete">
                      <span className="doc-emp-txt">
                        <strong>{r.etabNom || "Établissement"}</strong>
                        <small>{t("aut_droits")} : {scopesLisibles(r.scopes)}</small>
                        {r.expiration && <small>{t("aut_expire")} {r.expiration}</small>}
                      </span>
                    </div>
                    <div className="doc-emp-actions">
                      <button className="adm-btn" disabled={occupe} onClick={() => agir("accepter", r.id)}>{t("aut_accepter")}</button>
                      <button className="adm-btn secondaire" disabled={occupe} onClick={() => agir("refuser", r.id)}>{t("aut_refuser")}</button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Autorisations actives */}
            <div className="titre-section">{t("aut_actives")}</div>
            {actifs.length === 0 && <div className="etat-vide"><p>{t("aut_aucune")}</p></div>}
            {actifs.map((r) => (
              <div className="fe-carte doc-emp" key={r.id}>
                <div className="doc-emp-tete">
                  <span className="doc-emp-txt">
                    <strong>{r.etabNom || "Établissement"}</strong>
                    <small>{t("aut_droits")} : {scopesLisibles(r.scopes)}</small>
                    <small>{t("aut_depuis")} {new Date(r.creeLe).toLocaleDateString("fr-FR")}{r.expiration ? ` · ${t("aut_expire")} ${r.expiration}` : ""}</small>
                  </span>
                  <span className="doc-badge ok">{t("aut_active")}</span>
                </div>
                <div className="doc-emp-actions">
                  <button className="adm-btn secondaire doc-emp-suppr" disabled={occupe}
                    onClick={() => window.confirm(t("aut_conf_revoc")) && agir("revoquer", r.id)}>
                    {t("aut_revoquer")}
                  </button>
                </div>
              </div>
            ))}

            {passes.length > 0 && (
              <>
                <div className="titre-section">{t("aut_histo")}</div>
                {passes.map((r) => (
                  <div className="fe-carte doc-emp" key={r.id} style={{ opacity: 0.7 }}>
                    <div className="doc-emp-tete">
                      <span className="doc-emp-txt"><strong>{r.etabNom || "Établissement"}</strong></span>
                      <span className="doc-badge ko">{r.statut === "REFUSE" ? t("aut_refusee") : t("aut_revoquee")}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
