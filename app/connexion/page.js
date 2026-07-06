"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";
import {
  envoyerCode,
  verifierCode,
  normaliserTel,
  chargerProfil,
  connexionIdentifiant,
  deconnexion,
  supabaseConfigured,
} from "@/lib/supabase";

function FormulaireConnexion() {
  const { t, espaceChoisi, serviceEnCours, seConnecter } = useAsm();
  const routeur = useRouter();
  const params = useSearchParams();
  const gate = params.get("gate") === "1";

  const [mode, setMode] = useState(params.get("mode") === "identifiant" ? "identifiant" : "sms"); // sms | identifiant
  const [intention, setIntention] = useState("connexion"); // connexion | creer
  const [etape, setEtape] = useState("tel"); // tel | code | nouveau (mode sms)
  const [tel, setTel] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [code, setCode] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  // Après connexion : nouveau compte → écran de confirmation (pour éviter la
  // création accidentelle sur un numéro mal saisi) ; sinon → app.
  async function apresConnexion(user) {
    const type = espaceChoisi === "pro" ? "pro" : "patient";
    const profil = await chargerProfil(user?.id);
    if (!profil) {
      setEtape("nouveau");
      return;
    }
    seConnecter(type);
    if (type === "pro") routeur.push("/pro");
    else if (serviceEnCours) routeur.push("/rdv");
    else routeur.push("/tableau");
  }

  // Confirme la création de compte pour le numéro vérifié.
  function creerMonCompte() {
    routeur.push(espaceChoisi === "pro" ? "/inscription/pro" : "/inscription/patient");
  }

  // « Ce n'est pas mon numéro » : on ferme la session et on recommence.
  async function annulerNouveau() {
    try {
      await deconnexion();
    } catch {}
    setEtape("tel");
    setCode("");
    setPhoneE164("");
    setErreur("");
  }

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

  async function validerCode() {
    setErreur("");
    setOccupe(true);
    try {
      const user = await verifierCode(phoneE164, code.trim());
      await apresConnexion(user);
    } catch {
      setErreur(t("err_code"));
    } finally {
      setOccupe(false);
    }
  }

  async function validerIdentifiant() {
    setErreur("");
    if (!identifiant.trim() || !motDePasse) {
      setErreur(t("err_champs"));
      return;
    }
    setOccupe(true);
    try {
      const user = await connexionIdentifiant(identifiant, motDePasse);
      await apresConnexion(user);
    } catch {
      setErreur(t("err_identifiant"));
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

        <div className="onglets-connexion">
          <button
            className={mode === "sms" ? "actif" : ""}
            onClick={() => {
              setMode("sms");
              setErreur("");
            }}
          >
            {t("onglet_sms")}
          </button>
          <button
            className={mode === "identifiant" ? "actif" : ""}
            onClick={() => {
              setMode("identifiant");
              setErreur("");
            }}
          >
            {t("onglet_id")}
          </button>
        </div>

        {/* ---- Connexion par SMS ---- */}
        {mode === "sms" && etape === "tel" && (
          <>
            {intention === "creer" && <h3 className="titre-nouveau">{t("nouveau_t")}</h3>}
            <p className="sous-page">{intention === "creer" ? t("creer_sous") : sousTitre}</p>
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
              {occupe ? t("otp_envoi") : intention === "creer" ? t("nouveau_b") : t("otp_envoyer")}
            </button>

            {intention === "connexion" ? (
              <p className="creer-compte-ligne">
                {t("creer_hint")}{" "}
                <a
                  onClick={() => {
                    setIntention("creer");
                    setErreur("");
                  }}
                >
                  {t("creer_cta")}
                </a>
              </p>
            ) : (
              <p className="lien-bas">
                <a
                  onClick={() => {
                    setIntention("connexion");
                    setErreur("");
                  }}
                >
                  {t("retour_connexion")}
                </a>
              </p>
            )}
          </>
        )}

        {mode === "sms" && etape === "code" && (
          <>
            <p className="sous-page">
              {t("otp_envoye_a")} <strong dir="ltr">{phoneE164}</strong>
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
                onKeyDown={(e) => e.key === "Enter" && validerCode()}
                autoFocus
              />
            </div>
            <button className="btn-action" onClick={validerCode} disabled={occupe || code.length < 4}>
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

        {/* ---- Nouveau numéro : confirmation avant création de compte ---- */}
        {mode === "sms" && etape === "nouveau" && (
          <>
            <h3 className="titre-nouveau">{t("nouveau_t")}</h3>
            <p className="sous-page">
              <strong dir="ltr">{phoneE164}</strong> {t("nouveau_p")}
            </p>
            <p className="sous-page">{t("nouveau_q")}</p>
            <button className="btn-action" onClick={creerMonCompte}>
              {t("nouveau_b")}
            </button>
            <p className="lien-bas">
              <a onClick={annulerNouveau}>{t("nouveau_pasmoi")}</a>
            </p>
          </>
        )}

        {/* ---- Connexion par identifiant ---- */}
        {mode === "identifiant" && (
          <>
            <div className="champ">
              <label>{t("id_l")}</label>
              <input
                type="text"
                placeholder={t("id_ph")}
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
              />
            </div>
            <div className="champ">
              <label>{t("mdp2_l")}</label>
              <input
                type="password"
                placeholder={t("mdp2_ph")}
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && validerIdentifiant()}
              />
            </div>
            <button className="btn-action" onClick={validerIdentifiant} disabled={occupe}>
              {occupe ? t("otp_verif") : t("connexion_b")}
            </button>
          </>
        )}

        {erreur && <p className="erreur">{erreur}</p>}
        {!supabaseConfigured && <p className="erreur">{t("err_config")}</p>}

        {etape !== "nouveau" && (
          <p className="lien-probleme">
            <Link href="/aide-connexion">{t("pb_lien")}</Link>
          </p>
        )}

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
