"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";
import { envoyerCode, verifierCode, normaliserTel, supabaseConfigured } from "@/lib/supabase";

function FormulaireConnexion() {
  const { t, espaceChoisi, serviceEnCours, seConnecter } = useAsm();
  const routeur = useRouter();
  const params = useSearchParams();
  const gate = params.get("gate") === "1";

  const [etape, setEtape] = useState("tel"); // tel | code
  const [tel, setTel] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [code, setCode] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  async function demanderCode() {
    setErreur("");
    const p = normaliserTel(tel);
    if (p.replace(/\D/g, "").length < 11) {
      setErreur(t("err_tel_format"));
      return;
    }
    setOccupe(true);
    try {
      await envoyerCode(p);
      setPhoneE164(p);
      setEtape("code");
    } catch {
      setErreur(t("err_sms"));
    } finally {
      setOccupe(false);
    }
  }

  async function valider() {
    setErreur("");
    setOccupe(true);
    try {
      await verifierCode(phoneE164, code.trim());
      const type = espaceChoisi === "pro" ? "pro" : "patient";
      seConnecter(type);
      if (type === "pro") routeur.push("/pro");
      else if (serviceEnCours) routeur.push("/rdv");
      else routeur.push("/tableau");
    } catch {
      setErreur(t("err_code"));
    } finally {
      setOccupe(false);
    }
  }

  const sousTitre = gate
    ? t("connexion_s_gate")
    : espaceChoisi === "pro"
    ? t("connexion_s_pro")
    : t("otp_sous_tel");

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 420 }}>
        <h2 className="titre-page">{t("connexion_t")}</h2>

        {etape === "tel" && (
          <>
            <p className="sous-page">{sousTitre}</p>
            <div className="champ">
              <label>{t("tel_l")}</label>
              <input
                type="tel"
                inputMode="tel"
                placeholder={t("tel_ph")}
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && demanderCode()}
              />
            </div>
            <button className="btn-action" onClick={demanderCode} disabled={occupe}>
              {occupe ? t("otp_envoi") : t("otp_envoyer")}
            </button>
          </>
        )}

        {etape === "code" && (
          <>
            <p className="sous-page">
              {t("otp_envoye_a")}{" "}
              <strong dir="ltr">{phoneE164}</strong>
            </p>
            <div className="champ">
              <label>{t("code_l")}</label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={6}
                className="champ-code"
                placeholder={t("code_ph")}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && valider()}
                autoFocus
              />
            </div>
            <button className="btn-action" onClick={valider} disabled={occupe || code.length < 4}>
              {occupe ? t("otp_verif") : t("otp_valider")}
            </button>
            <p className="lien-bas">
              <a
                onClick={() => {
                  setEtape("tel");
                  setCode("");
                  setErreur("");
                }}
              >
                {t("otp_changer")}
              </a>
              {" · "}
              <a onClick={demanderCode}>{t("otp_renvoyer")}</a>
            </p>
          </>
        )}

        {erreur && <p className="erreur">{erreur}</p>}
        {!supabaseConfigured && <p className="erreur">{t("err_config")}</p>}

        <div className="info-appel">
          <span>{t("urgence")}</span> <a href={TEL_LIEN}>{TEL_AFFICHE}</a>
        </div>
      </div>
    </div>
  );
}

export default function Connexion() {
  return (
    <Suspense>
      <FormulaireConnexion />
    </Suspense>
  );
}
