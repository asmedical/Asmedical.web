"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { supabase } from "@/lib/supabase";
import FilDemande from "@/app/components/fil-demande";

// « Mes proches » — tableau de bord Famille : les patients pour lesquels je
// suis autorisé(e) à réserver et suivre les prestations. L'autre sens (qui a
// accès à MON compte) reste dans « Autorisations ».

async function apiProches(options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch("/api/proches", {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
      ...(options.headers || {}),
    },
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) {
    const e = new Error(d?.erreur || "erreur");
    e.code = d?.erreur;
    throw e;
  }
  return d;
}

const LIB_SERVICE = { transport: "🚑", domicile: "🏠", medicaments: "💊" };

export default function MesProches() {
  const { t, connecte } = useAsm();
  const routeur = useRouter();
  const [d, setD] = useState(undefined);
  const [mode, setMode] = useState("code"); // code | invitation
  const [code, setCode] = useState("");
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState("");

  const charger = () => apiProches().then(setD).catch(() => setD(null));
  useEffect(() => { charger(); }, []);

  async function ajouter() {
    setMsg("");
    setOccupe(true);
    try {
      if (mode === "code") {
        if (!code.trim()) return;
        await apiProches({ method: "POST", body: JSON.stringify({ mode: "code", code }) });
        setMsg(t("pr_code_ok"));
        setCode("");
      } else {
        if (!nom.trim() || tel.replace(/\D/g, "").length < 8) {
          setMsg(t("err_champs"));
          setOccupe(false);
          return;
        }
        await apiProches({ method: "POST", body: JSON.stringify({ mode: "invitation", nom, telephone: tel }) });
        setMsg(t("pr_invit_ok"));
        setNom(""); setTel("");
      }
      await charger();
    } catch (e) {
      const ERREURS = {
        code_invalide: t("pr_err_code"), code_expire: t("pr_err_code_expire"),
        deja_rattache: t("pr_err_deja"), telephone_invalide: t("err_tel_format"),
      };
      setMsg(ERREURS[e.code] || t("pr_err"));
    }
    setOccupe(false);
  }

  async function retirer(lien) {
    if (!window.confirm(t("pr_retirer_conf"))) return;
    try {
      await apiProches({ method: "POST", body: JSON.stringify({ action: "retirer", id: lien.id }) });
      await charger();
    } catch {
      setMsg(t("pr_err"));
    }
  }

  function reserverPour(lien) {
    try {
      sessionStorage.setItem("asm_pour_patient", JSON.stringify({ tel: lien.patientTel, nom: lien.patientNom || lien.patientTel }));
    } catch {}
    routeur.push("/accueil");
  }

  if (d === undefined) return <div className="page"><div className="contenu-page"><p className="sous-page">{t("compte_charge")}</p></div></div>;
  if (d === null || !connecte) {
    return (
      <div className="page"><div className="contenu-page" style={{ maxWidth: 480 }}>
        <h2 className="titre-page">{t("pr_t")}</h2>
        <p className="sous-page">{t("pf_connexion")}</p>
        <Link className="btn-action" href="/connexion">{t("connexion_t")}</Link>
      </div></div>
    );
  }

  const STATUTS = {
    ACCEPTE: { lib: t("pr_st_ok"), classe: "ok" },
    EN_ATTENTE: { lib: t("pr_st_attente"), classe: "" },
    REFUSE: { lib: t("pr_st_refuse"), classe: "ko" },
    REVOQUE: { lib: t("pr_st_revoque"), classe: "ko" },
  };
  const D_STATUTS = {
    A_RAPPELER: t("st_a_rappeler"), CONFIRMEE: t("st_confirmee"), AFFECTEE: t("st_affectee"),
    EN_COURS: t("st_en_cours"), TERMINEE: t("st_terminee"), ABSENT: t("st_absent"), ANNULEE: t("st_annulee"),
  };

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 640 }}>
        <Link className="btn-retour" href="/compte">{t("retour")}</Link>
        <h2 className="titre-page">{t("pr_t")}</h2>
        <p className="sous-page">{t("pr_s")}</p>

        {/* ---- Ajouter un proche ---- */}
        <div className="carte-compte">
          <div className="titre-section">{t("pr_ajouter_t")}</div>
          <div className="chips" style={{ marginBottom: 10 }}>
            <button className={"chip" + (mode === "code" ? " actif" : "")} onClick={() => setMode("code")}>{t("pr_mode_code")}</button>
            <button className={"chip" + (mode === "invitation" ? " actif" : "")} onClick={() => setMode("invitation")}>{t("pr_mode_invit")}</button>
          </div>
          {mode === "code" ? (
            <>
              <p className="fe-aide" style={{ marginTop: 0 }}>{t("pr_code_aide")}</p>
              <div className="champ">
                <input placeholder="ASM-XXXX00" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              </div>
            </>
          ) : (
            <>
              <p className="fe-aide" style={{ marginTop: 0 }}>{t("pr_invit_aide")}</p>
              <div className="champ">
                <label>{t("pr_nom_l")}</label>
                <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t("pr_nom_ph")} />
              </div>
              <div className="champ">
                <label>{t("tel_l")}</label>
                <input inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="0550 12 34 56" />
              </div>
            </>
          )}
          <button className="btn-action" onClick={ajouter} disabled={occupe}>
            {occupe ? t("otp_envoi") : t("pr_ajouter_b")}
          </button>
          {msg && <p className="adm-msg" style={{ marginTop: 10 }}>{msg}</p>}
        </div>

        {/* ---- Mes proches ---- */}
        {d.proches.length === 0 && <p className="sous-page">{t("pr_vide")}</p>}
        {d.proches.map((p) => {
          const st = STATUTS[p.statut] || { lib: p.statut, classe: "" };
          return (
            <div className="carte-compte" key={p.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <strong style={{ fontSize: 16 }}>{p.patientNom || p.patientTel}</strong>
                  <div style={{ color: "var(--gris)", fontSize: 13 }}>{p.patientTel}{p.expiration ? ` · ${t("pr_jusquau")} ${p.expiration}` : ""}</div>
                </div>
                <span className={"fin-statut" + (st.classe === "ko" ? " ko" : "")} style={st.classe === "ok" ? { color: "var(--vert-fonce)" } : undefined}>
                  {st.lib}
                </span>
              </div>

              {p.statut === "ACCEPTE" && !p.expiree && (
                <>
                  <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
                    <button className="btn-action" style={{ padding: "10px 16px" }} onClick={() => reserverPour(p)}>
                      {t("pr_reserver_b")} {p.patientNom ? p.patientNom.split(" ")[0] : ""}
                    </button>
                    <button className="fin-lien" onClick={() => retirer(p)}>{t("pr_retirer_b")}</button>
                  </div>
                  {p.demandes.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--ligne)", paddingTop: 8 }}>
                      {p.demandes.map((dm) => (
                        <div key={dm.id} style={{ padding: "7px 0", borderBottom: "1px solid var(--ligne)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <span>
                              {LIB_SERVICE[dm.service] || "•"} <strong>{String(dm.date || "").slice(0, 10)}</strong>
                              <span style={{ color: "var(--gris)" }}> · {String(dm.date || "").slice(11, 16)}</span>
                            </span>
                            <span style={{ fontWeight: 700, color: dm.statut === "TERMINEE" ? "var(--vert-fonce)" : "var(--gris)" }}>
                              {D_STATUTS[dm.statut] || dm.statut}
                            </span>
                          </div>
                          {dm.transporteur && (
                            <div style={{ color: "var(--gris)", fontSize: 13 }}>
                              {dm.transporteur.nom}
                              {dm.transporteur.vehicule ? ` · ${dm.transporteur.vehicule}` : ""}
                              {dm.transporteur.vehiculeCouleur ? ` ${dm.transporteur.vehiculeCouleur}` : ""}
                              {dm.transporteur.vehiculeImmat ? ` · ${dm.transporteur.vehiculeImmat}` : ""}
                            </div>
                          )}
                          {dm.compteRendu && (
                            <div style={{ fontSize: 13.5, marginTop: 3 }}>
                              <strong>{t("pr_cr")} :</strong> {dm.compteRendu}
                            </div>
                          )}
                          {/* Fil partagé avec le patient et l'équipe. */}
                          <FilDemande demandeId={dm.id} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {p.statut === "EN_ATTENTE" && (
                <p className="fe-aide" style={{ marginBottom: 0 }}>{t("pr_attente_aide")}</p>
              )}
              {["EN_ATTENTE"].includes(p.statut) && (
                <button className="fin-lien" onClick={() => retirer(p)}>{t("pr_annuler_b")}</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
