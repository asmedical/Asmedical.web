"use client";
import Link from "next/link";
import ChampMotDePasse from "@/app/components/motdepasse";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";
import ChoixAppel from "@/app/components/appel";
import {
  envoyerCode,
  verifierCode,
  envoyerCodeEmailCreation,
  verifierCodeEmail,
  normaliserTel,
  chargerProfil,
  connexionIdentifiant,
  connexionOAuth,
  deconnexion,
  supabase,
  supabaseConfigured,
} from "@/lib/supabase";

// Fournisseurs de connexion externes proposés (activés dans Supabase).
// Ex. NEXT_PUBLIC_OAUTH_PROVIDERS="google,facebook,apple" — vide = masqués.
const OAUTH_PROVIDERS = (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS || "")
  .split(",").map((s) => s.trim().toLowerCase())
  .filter((s) => ["google", "facebook", "apple"].includes(s));

const ICONES_OAUTH = {
  google: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1-.8 2.6-2.4 3.7l3.8 2.9c2.3-2.1 3.6-5.2 3.6-8.8z"/>
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.2 0-5.9-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z"/>
      <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-4-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z"/>
      <path fill="#EA4335" d="M12 4.7c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3c.9-2.8 3.5-4.9 6.7-4.9z"/>
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3v-3.5h3V9.4c0-3 1.8-4.7 4.6-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/>
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M16.4 12.9c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3.1 2.4 1.2-.1 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.6-1-2.7-3.9zM14 5.6c.7-.8 1.1-1.9 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"/>
    </svg>
  ),
};
const NOMS_OAUTH = { google: "Google", facebook: "Facebook", apple: "Apple" };

// Indicatifs proposés (Algérie par défaut ; diaspora + Maghreb + Europe).
const INDICATIFS = [
  { code: "+213", drapeau: "🇩🇿" }, // Algérie
  { code: "+33", drapeau: "🇫🇷" }, // France
  { code: "+216", drapeau: "🇹🇳" }, // Tunisie
  { code: "+212", drapeau: "🇲🇦" }, // Maroc
  { code: "+32", drapeau: "🇧🇪" }, // Belgique
  { code: "+41", drapeau: "🇨🇭" }, // Suisse
  { code: "+49", drapeau: "🇩🇪" }, // Allemagne
  { code: "+44", drapeau: "🇬🇧" }, // Royaume-Uni
  { code: "+1", drapeau: "🇨🇦" }, // Canada / USA
  { code: "+34", drapeau: "🇪🇸" }, // Espagne
  { code: "+39", drapeau: "🇮🇹" }, // Italie
];

function FormulaireConnexion() {
  const { t, espaceChoisi, serviceEnCours, seConnecter } = useAsm();
  const routeur = useRouter();
  const params = useSearchParams();
  const gate = params.get("gate") === "1";

  const [mode, setMode] = useState(params.get("mode") === "identifiant" ? "identifiant" : "sms"); // sms | identifiant
  const [intention, setIntention] = useState("connexion"); // connexion | creer
  const [etape, setEtape] = useState("tel"); // tel | code | nouveau (mode sms)
  const [indicatif, setIndicatif] = useState("+213");
  const [tel, setTel] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [code, setCode] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");
  const [canal, setCanal] = useState("sms"); // sms | whatsapp (réception du code)
  const [viaEmail, setViaEmail] = useState(false); // code par email (création sans SMS)
  const [emailOtp, setEmailOtp] = useState("");
  const [waActif, setWaActif] = useState(false);
  const [oauthEnCours, setOauthEnCours] = useState(params.get("oauth") === "retour");

  // WhatsApp proposé seulement si configuré côté serveur.
  useEffect(() => {
    fetch("/api/otp-canal").then((r) => r.json()).then((d) => setWaActif(!!d?.whatsapp)).catch(() => {});
  }, []);

  // Retour d'une connexion Google / Facebook / Apple : déclenché par le
  // paramètre ?oauth=retour OU par le drapeau posé avant le départ (robuste
  // même si Supabase a redirigé ailleurs puis nous a ramenés ici). La
  // session arrive dans l'URL ; on attend qu'elle soit posée puis on aiguille.
  useEffect(() => {
    if (!supabase) return;
    let drapeau = false;
    try { drapeau = sessionStorage.getItem("asm_oauth_retour") === "1"; } catch {}
    if (params.get("oauth") !== "retour" && !drapeau) return;
    try { sessionStorage.removeItem("asm_oauth_retour"); } catch {}
    setOauthEnCours(true);
    let arret = false;
    (async () => {
      for (let i = 0; i < 25 && !arret; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await apresConnexion(session.user);
          if (!arret) setOauthEnCours(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      if (!arret) {
        setOauthEnCours(false);
        setErreur(t("err_oauth"));
      }
    })();
    return () => { arret = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rôles employé (espace /employe) et internes (espace /admin).
  const ROLES_EMPLOYE = ["aide_soignant", "infirmier", "chauffeur", "transporteur", "coordinateur", "employe_interne"];
  const ROLES_INTERNE = ["superadmin", "admin", "moderateur", "standardiste"];

  // Après connexion : on aiguille selon le rôle. Un employé avec mot de passe
  // temporaire est envoyé changer son mot de passe (obligatoire).
  async function apresConnexion(user) {
    const profil = await chargerProfil(user?.id);
    const role = profil?.role || user?.user_metadata?.role || "";

    if (ROLES_EMPLOYE.includes(role)) {
      seConnecter("patient");
      if (user?.user_metadata?.must_change_password) routeur.push("/employe/mot-de-passe");
      else routeur.push("/employe");
      return;
    }
    if (ROLES_INTERNE.includes(role)) {
      seConnecter("patient");
      routeur.push("/admin");
      return;
    }

    // Compte EXISTANT : c'est le RÔLE du compte qui décide de l'espace,
    // jamais le choix d'entrée (patient / établissement) sur le site.
    // Un compte patient n'entre pas dans l'espace pro, et inversement.
    if (!profil) {
      // Compte tout neuf (SMS ou Google/Facebook/Apple) : proposer la création.
      if (!phoneE164) setPhoneE164(user?.phone || user?.email || "");
      setMode("sms");
      setIntention("connexion");
      setEtape("nouveau");
      return;
    }
    const type = profil.role === "pro" ? "pro" : "patient";
    seConnecter(type);
    // Compte créé par l'équipe : création du mot de passe à la 1re connexion.
    if (user?.user_metadata?.must_create_password) {
      routeur.push("/premiere-connexion");
      return;
    }
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
    if (viaEmail) {
      const em = emailOtp.trim();
      if (!/\S+@\S+\.\S+/.test(em)) {
        setErreur(t("err_email"));
        return;
      }
      setOccupe(true);
      try {
        await envoyerCodeEmailCreation(em);
        setPhoneE164(em);
        setEtape("code");
      } catch {
        setErreur(t("err_envoi_email"));
      } finally {
        setOccupe(false);
      }
      return;
    }
    const p = normaliserTel(tel, indicatif);
    if (p.replace(/\D/g, "").length < 10) {
      setErreur(t("err_tel_format"));
      return;
    }
    setOccupe(true);
    try {
      if (waActif) {
        // Mémorise le canal choisi (SMS / WhatsApp) pour cet envoi.
        try {
          await fetch("/api/otp-canal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: p, canal }),
          });
        } catch {}
      }
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
      const user = viaEmail
        ? await verifierCodeEmail(phoneE164, code.trim())
        : await verifierCode(phoneE164, code.trim());
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

  if (oauthEnCours) {
    return (
      <div className="page">
        <div className="contenu-page" style={{ maxWidth: 420, textAlign: "center" }}>
          <h2 className="titre-page">{t("connexion_t")}</h2>
          <p className="sous-page">{t("oauth_attente")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 420 }}>
        {/* En mode CRÉATION, le titre change et les onglets de connexion
            disparaissent : aucune confusion possible avec « Se connecter ». */}
        {intention === "creer" && mode === "sms" ? (
          <h2 className="titre-page">{t("nouveau_t")}</h2>
        ) : (
          <>
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
          </>
        )}

        {/* ---- Connexion par SMS ---- */}
        {mode === "sms" && etape === "tel" && (
          <>
            <p className="sous-page">{intention === "creer" ? t("creer_sous") : sousTitre}</p>
            {viaEmail ? (
              <div className="champ">
                <label>{t("email_l")}</label>
                <input
                  type="email"
                  inputMode="email"
                  placeholder={t("email_ph")}
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && demanderCode()}
                />
              </div>
            ) : (
            <div className="champ">
              <label>{t("tel_l")}</label>
              <div className="tel-ligne">
                <select
                  className="tel-indicatif"
                  value={indicatif}
                  onChange={(e) => setIndicatif(e.target.value)}
                  aria-label={t("indicatif_l")}
                >
                  {INDICATIFS.map((i) => (
                    <option value={i.code} key={i.code}>
                      {i.drapeau} {i.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder={t("tel_ph")}
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && demanderCode()}
                />
              </div>
            </div>
            )}
            {!viaEmail && waActif && (
              <div className="canal-choix">
                <span>{t("canal_l")}</span>
                <div className="canal-chips">
                  <button type="button" className={canal === "sms" ? "actif" : ""} onClick={() => setCanal("sms")}>SMS</button>
                  <button type="button" className={canal === "whatsapp" ? "actif" : ""} onClick={() => setCanal("whatsapp")}>
                    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="#25D366" d="M12 0a12 12 0 0 0-10.4 18L0 24l6.2-1.6A12 12 0 1 0 12 0zm0 21.8a9.7 9.7 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm5.4-7.3c-.3-.2-1.8-.9-2-1s-.5-.2-.7.1-.8 1-1 1.2-.4.2-.7.1a8 8 0 0 1-2.4-1.5 8.9 8.9 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5s0-.4 0-.5-.7-1.6-.9-2.2-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4A3.4 3.4 0 0 0 5.8 9c0 1.5 1.1 3 1.2 3.2a13.3 13.3 0 0 0 5.1 4.5c.7.3 1.3.5 1.7.6a4 4 0 0 0 1.9.1 3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.5-.1z"/></svg>
                    WhatsApp
                  </button>
                </div>
              </div>
            )}
            <button className="btn-action" onClick={demanderCode} disabled={occupe}>
              {occupe ? t("otp_envoi") : intention === "creer" ? t("nouveau_b") : t("otp_envoyer")}
            </button>
            <p className="lien-bas">
              <a
                onClick={() => {
                  setViaEmail(!viaEmail);
                  setErreur("");
                }}
              >
                {viaEmail ? t("otp_par_tel") : t("otp_par_email")}
              </a>
            </p>

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
              <ChampMotDePasse
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

        {/* ---- Connexion Google / Facebook / Apple (si activés) ---- */}
        {OAUTH_PROVIDERS.length > 0 && etape !== "nouveau" && (
          <>
            <div className="oauth-sep"><span>{t("oauth_ou")}</span></div>
            <div className="oauth-liste">
              {OAUTH_PROVIDERS.map((prov) => (
                <button
                  key={prov}
                  type="button"
                  className="btn-oauth"
                  onClick={async () => {
                    setErreur("");
                    try {
                      await connexionOAuth(prov);
                    } catch {
                      setErreur(t("err_oauth"));
                    }
                  }}
                >
                  {ICONES_OAUTH[prov]} {NOMS_OAUTH[prov]}
                </button>
              ))}
            </div>
          </>
        )}

        {etape !== "nouveau" && (
          <p className="lien-probleme">
            <Link href="/aide-connexion">{t("pb_lien")}</Link>
          </p>
        )}

        <div className="info-appel">
          <span>{t("urgence")}</span> <ChoixAppel />
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
