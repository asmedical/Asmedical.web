"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { supabase } from "@/lib/supabase";

const LIB_STATUT = { EN_ATTENTE: "rat_attente", ACCEPTE: "rat_actif", REFUSE: "aut_refusee", REVOQUE: "aut_revoquee" };

async function jeton() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// « Mes patients rattachés » (espace établissement) : liste, rattachement
// par invitation ou par code, et réservation au nom d'un patient autorisé.
export default function PatientsRattaches() {
  const { t } = useAsm();
  const routeur = useRouter();
  const [liens, setLiens] = useState(null);
  const [ouvert, setOuvert] = useState(false); // formulaire raccorder
  const [mode, setMode] = useState("code"); // code | invitation
  const [code, setCode] = useState("");
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState("");

  async function charger() {
    const token = await jeton();
    if (!token) return setLiens([]);
    try {
      const r = await fetch("/api/pro/rattachements", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setLiens(d.rattachements || []);
    } catch { setLiens([]); }
  }
  useEffect(() => { charger(); }, []);

  async function envoyer() {
    setOccupe(true); setMsg("");
    try {
      const token = await jeton();
      const corps = mode === "code" ? { mode: "code", code: code.trim() } : { mode: "invitation", nom: nom.trim(), telephone: tel.trim() };
      const r = await fetch("/api/pro/rattachements", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corps),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(d.erreur === "code_invalide" ? t("rat_code_invalide") : d.erreur === "code_expire" ? t("rat_code_expire") : t("err_serveur_court"));
      } else {
        setMsg(mode === "code" ? t("rat_code_ok") : t("rat_invit_ok"));
        setCode(""); setNom(""); setTel(""); setOuvert(false);
        await charger();
      }
    } catch { setMsg(t("err_serveur_court")); }
    setOccupe(false);
  }

  function reserverPour(r) {
    try {
      sessionStorage.setItem("asm_pour_patient", JSON.stringify({ tel: r.patientTel, nom: r.patientNom || r.patientTel }));
    } catch {}
    routeur.push("/accueil");
  }

  return (
    <div style={{ marginTop: 26 }}>
      <div className="titre-section">{t("rat_t")}</div>
      <p className="precisions-aide">{t("rat_s")}</p>

      <button className="btn-secondaire" onClick={() => setOuvert(!ouvert)}>
        {ouvert ? t("annuler") : t("rat_raccorder")}
      </button>

      {ouvert && (
        <div className="fe-carte" style={{ marginTop: 12 }}>
          <div className="chips" style={{ marginBottom: 10 }}>
            <button type="button" className={"chip" + (mode === "code" ? " actif" : "")} onClick={() => setMode("code")}>{t("rat_par_code")}</button>
            <button type="button" className={"chip" + (mode === "invitation" ? " actif" : "")} onClick={() => setMode("invitation")}>{t("rat_par_invit")}</button>
          </div>
          {mode === "code" ? (
            <>
              <p className="fe-aide">{t("rat_code_aide")}</p>
              <div className="champ" style={{ marginTop: 8 }}>
                <input type="text" placeholder="ASM-XXXX00" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              </div>
            </>
          ) : (
            <>
              <p className="fe-aide">{t("rat_invit_aide")}</p>
              <div className="champ" style={{ marginTop: 8 }}>
                <input type="text" placeholder={t("rat_nom_ph")} value={nom} onChange={(e) => setNom(e.target.value)} />
              </div>
              <div className="champ">
                <input type="tel" placeholder={t("tel_ph")} value={tel} onChange={(e) => setTel(e.target.value)} />
              </div>
            </>
          )}
          <button className={"btn-action" + (occupe ? " btn-charge" : "")} disabled={occupe || (mode === "code" ? !code.trim() : !tel.trim())} onClick={envoyer}>
            {t("rat_valider")}
          </button>
        </div>
      )}

      {msg && <p className="adm-msg" style={{ marginTop: 10 }}>{msg}</p>}

      {liens === null && <p className="sous-page" style={{ marginTop: 12 }}>{t("compte_charge")}</p>}
      {liens?.length === 0 && <div className="etat-vide" style={{ marginTop: 12 }}><p>{t("rat_aucun")}</p></div>}
      {liens?.map((r) => (
        <div className="fe-carte doc-emp" key={r.id} style={{ marginTop: 10 }}>
          <div className="doc-emp-tete">
            <span className="doc-emp-txt">
              <strong>{r.patientNom || r.patientTel}</strong>
              <small>{r.patientTel}{r.expiration ? ` · ${t("aut_expire")} ${r.expiration}` : ""}</small>
            </span>
            <span className={"doc-badge" + (r.statut === "ACCEPTE" ? " ok" : ["REFUSE", "REVOQUE"].includes(r.statut) ? " ko" : "")}>
              {t(LIB_STATUT[r.statut] || r.statut)}
            </span>
          </div>
          {r.statut === "ACCEPTE" && (
            <div className="doc-emp-actions">
              <button className="adm-btn" onClick={() => reserverPour(r)}>{t("rat_reserver")}</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
