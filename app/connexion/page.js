"use client";
import Link from "next/link";
import Image from "next/image";
import ChampMotDePasse from "@/app/components/motdepasse";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE, TEL_LIEN, WHATSAPP_LIEN } from "@/lib/i18n";
import { messageEchecConnexion } from "@/lib/authErreurs";
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
// Un fournisseur NON configuré ne doit jamais apparaître : un bouton qui
// mène à une impasse est pire que pas de bouton du tout.
const OAUTH_PROVIDERS = (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS || "")
  .split(",").map((s) => s.trim().toLowerCase())
  .filter((s) => ["google", "facebook", "apple"].includes(s));

const ICONES_OAUTH = {
  google: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1-.8 2.6-2.4 3.7l3.8 2.9c2.3-2.1 3.6-5.2 3.6-8.8z"/>
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.2 0-5.9-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z"/>
      <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-4-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z"/>
      <path fill="#EA4335" d="M12 4.7c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3c.9-2.8 3.5-4.9 6.7-4.9z"/>
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3v-3.5h3V9.4c0-3 1.8-4.7 4.6-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/>
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
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

const EST_EMAIL = (v) => /\S+@\S+\.\S+/.test((v || "").trim());
// Téléphone : chiffres (avec + / 00 / 0, espaces, tirets), au moins 8 chiffres.
const EST_TEL = (v) => {
  const s = (v || "").trim();
  return !s.includes("@") && /^[+\d][\d\s.\-()]*$/.test(s) && s.replace(/\D/g, "").length >= 8;
};

const Chevron = ({ ouvert }) => (
  <svg className={"acc-chevron" + (ouvert ? " ouvert" : "")} viewBox="0 0 24 24" width="20" height="20"
       fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const IcoOptions = () => (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12.3 19" />
  </svg>
);
const IcoAide = () => (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);
const Fleche = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

function FormulaireConnexion() {
  const { t, espaceChoisi, serviceEnCours, seConnecter } = useAsm();
  const routeur = useRouter();
  const params = useSearchParams();

  // Deux onglets très visibles : accéder à son compte, ou en créer un.
  const [onglet, setOnglet] = useState(params.get("mode") === "inscription" ? "inscription" : "connexion");
  // Vue affichée : principal (écran épuré) · sms (parcours OTP) · nouveau (compte à créer)
  const [vue, setVue] = useState(params.get("mode") === "sms" ? "sms" : "principal");
  const [etape, setEtape] = useState("tel"); // tel | code (dans la vue sms)

  // Accordéons — FERMÉS par défaut : l'écran initial reste minimal.
  const [accOptions, setAccOptions] = useState(false);
  const [accAide, setAccAide] = useState(false);

  const [indicatif, setIndicatif] = useState("+213");
  const [tel, setTel] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [code, setCode] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  // Inscription : le strict minimum (le reste du profil est demandé après).
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [contact, setContact] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [oauthOccupe, setOauthOccupe] = useState("");
  const [erreur, setErreur] = useState("");
  const [canal, setCanal] = useState("sms"); // sms | whatsapp (réception du code)
  const [viaEmail, setViaEmail] = useState(false); // code par email (sans SMS)
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
      // Timeout explicite : jamais de retour silencieux ni de boucle.
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
    if (!profil) {
      // Compte tout neuf. Si l'utilisateur venait de l'onglet Inscription, il
      // a déjà dit qu'il créait un compte (et donné nom + prénom) : on file
      // droit à la finalisation du profil, sans lui reposer la question.
      if (onglet === "inscription") {
        memoriserIdentite();
        creerMonCompte();
        return;
      }
      if (!phoneE164) setPhoneE164(user?.phone || user?.email || "");
      setVue("nouveau");
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
    else if (serviceEnCours) routeur.push(`/reserver/${serviceEnCours}/besoin`);
    else routeur.push("/tableau");
  }

  // Nom / prénom saisis à l'inscription : transmis à la finalisation du profil
  // pour ne pas les redemander (aucune donnée sensible, stockage de session).
  function memoriserIdentite() {
    try {
      if (prenom.trim() || nom.trim()) {
        sessionStorage.setItem("asm_insc_identite", JSON.stringify({ prenom: prenom.trim(), nom: nom.trim() }));
      }
    } catch {}
  }

  function creerMonCompte() {
    routeur.push(espaceChoisi === "pro" ? "/inscription/pro" : "/inscription/patient");
  }

  // « Ce n'est pas mon numéro » : on ferme la session et on recommence.
  async function annulerNouveau() {
    try { await deconnexion(); } catch {}
    setVue("principal");
    setEtape("tel");
    setCode("");
    setPhoneE164("");
    setErreur("");
  }

  // --- Envoi du code (parcours SMS / e-mail existants, inchangés) ---
  async function demanderCode() {
    if (occupe) return; // pas de double soumission
    setErreur("");
    if (viaEmail) {
      const em = emailOtp.trim();
      if (!EST_EMAIL(em)) return setErreur(t("err_email"));
      setOccupe(true);
      try {
        await envoyerCodeEmailCreation(em);
        setPhoneE164(em);
        setEtape("code");
      } catch (e) {
        setErreur(messageErreur(e, "err_envoi_email"));
      } finally {
        setOccupe(false);
      }
      return;
    }
    const p = normaliserTel(tel, indicatif);
    if (p.replace(/\D/g, "").length < 10) return setErreur(t("err_tel_format"));
    setOccupe(true);
    try {
      if (waActif) {
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
    } catch (e) {
      setErreur(messageErreur(e, "err_sms"));
    } finally {
      setOccupe(false);
    }
  }

  async function validerCode() {
    if (occupe) return;
    setErreur("");
    setOccupe(true);
    try {
      const user = viaEmail
        ? await verifierCodeEmail(phoneE164, code.trim())
        : await verifierCode(phoneE164, code.trim());
      await apresConnexion(user);
    } catch (e) {
      setErreur(messageErreur(e, "err_code"));
    } finally {
      setOccupe(false);
    }
  }

  async function validerIdentifiant() {
    if (occupe) return;
    setErreur("");
    if (!identifiant.trim() || !motDePasse) return setErreur(t("err_champs"));
    setOccupe(true);
    try {
      const user = await connexionIdentifiant(identifiant, motDePasse);
      await apresConnexion(user);
    } catch (e) {
      setErreur(messageErreur(e, "err_identifiant"));
    } finally {
      setOccupe(false);
    }
  }

  // --- Inscription : nom + prénom + (email OU téléphone) ---
  // L'utilisateur n'a pas à comprendre la différence : on détecte le type et
  // on emprunte le parcours OTP correspondant, déjà en place.
  async function creerCompte() {
    if (occupe) return;
    setErreur("");
    if (!prenom.trim() || !nom.trim()) return setErreur(t("err_nom_prenom"));
    const c = contact.trim();
    if (EST_EMAIL(c)) {
      setOccupe(true);
      try {
        memoriserIdentite();
        await envoyerCodeEmailCreation(c);
        setViaEmail(true);
        setEmailOtp(c);
        setPhoneE164(c);
        setVue("sms");
        setEtape("code");
      } catch (e) {
        setErreur(messageErreur(e, "err_envoi_email"));
      } finally {
        setOccupe(false);
      }
      return;
    }
    if (EST_TEL(c)) {
      const p = normaliserTel(c, indicatif);
      if (p.replace(/\D/g, "").length < 10) return setErreur(t("err_tel_format"));
      setOccupe(true);
      try {
        memoriserIdentite();
        if (waActif) {
          try {
            await fetch("/api/otp-canal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone: p, canal }),
            });
          } catch {}
        }
        await envoyerCode(p);
        setViaEmail(false);
        setPhoneE164(p);
        setVue("sms");
        setEtape("code");
      } catch (e) {
        setErreur(messageErreur(e, "err_sms"));
      } finally {
        setOccupe(false);
      }
      return;
    }
    setErreur(t("err_contact"));
  }

  // Accuser le mot de passe est le pire message par défaut : c'est le seul
  // qui pousse à ressaisir indéfiniment quelque chose de juste. On ne le dit
  // que lorsque rien n'indique le contraire.
  function messageErreur(e, defaut) {
    const cle = messageEchecConnexion(e);
    // Réseau coupé et application mal configurée valent pour n'importe quel
    // envoi. Les autres précisions ne concernent que la connexion : sur une
    // demande de code SMS, « ce n'est pas votre mot de passe » n'aurait
    // aucun sens.
    if (cle === "err_app_config" || cle === "err_reseau") return t(cle);
    if (defaut === "err_identifiant" && cle !== "err_identifiant") return t(cle);
    return t(defaut);
  }

  async function lancerOAuth(prov) {
    if (oauthOccupe) return;
    setErreur("");
    setOauthOccupe(prov);
    try {
      await connexionOAuth(prov);
    } catch {
      setOauthOccupe("");
      setErreur(t("err_oauth"));
    }
  }

  // ---------------------------------------------------------------- Vues

  if (oauthEnCours) {
    return (
      <div className="page">
        <div className="contenu-page auth-carte" style={{ textAlign: "center" }}>
          <h2 className="titre-page">{t("auth_bienvenue")}</h2>
          <p className="sous-page">{t("oauth_attente")}</p>
        </div>
      </div>
    );
  }

  const Entete = () => (
    <div className="auth-entete">
      <span className="auth-logo" aria-hidden="true">
        <Image src="/logo-asm.jpg" alt="" width={78} height={78} />
      </span>
      <h1 className="auth-titre">{t("auth_bienvenue")}</h1>
      <p className="auth-sous">
        {onglet === "inscription" ? t("auth_sous_inscription") : t("auth_sous_connexion")}
      </p>
    </div>
  );

  // Compte tout neuf détecté depuis la CONNEXION : on confirme avant de créer.
  if (vue === "nouveau") {
    return (
      <div className="page">
        <div className="contenu-page auth-carte">
          <Entete />
          <h3 className="titre-nouveau">{t("nouveau_t")}</h3>
          <p className="sous-page">
            <strong dir="ltr">{phoneE164}</strong> {t("nouveau_p")}
          </p>
          <p className="sous-page">{t("nouveau_q")}</p>
          <button className="btn-action" onClick={creerMonCompte}>{t("nouveau_b")}</button>
          <p className="lien-bas">
            <a onClick={annulerNouveau}>{t("nouveau_pasmoi")}</a>
          </p>
        </div>
      </div>
    );
  }

  // Parcours SMS / e-mail (rangé derrière « Autres options de connexion »).
  if (vue === "sms") {
    return (
      <div className="page">
        <div className="contenu-page auth-carte">
          <Entete />
          {etape === "tel" ? (
            <>
              <p className="sous-page">{t("autre_methode_s")}</p>
              {viaEmail ? (
                <div className="champ">
                  <label htmlFor="otp-email">{t("email_l")}</label>
                  <input
                    id="otp-email" type="email" inputMode="email" autoComplete="email"
                    placeholder={t("email_ph")} value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && demanderCode()}
                  />
                </div>
              ) : (
                <div className="champ">
                  <label htmlFor="otp-tel">{t("tel_l")}</label>
                  <div className="tel-ligne">
                    <select className="tel-indicatif" value={indicatif}
                            onChange={(e) => setIndicatif(e.target.value)} aria-label={t("indicatif_l")}>
                      {INDICATIFS.map((i) => (
                        <option value={i.code} key={i.code}>{i.drapeau} {i.code}</option>
                      ))}
                    </select>
                    <input
                      id="otp-tel" type="tel" inputMode="tel" autoComplete="tel"
                      placeholder={t("tel_ph")} value={tel}
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
                {occupe ? t("otp_envoi") : t("otp_envoyer")}
              </button>
              <p className="lien-bas">
                <a onClick={() => { setViaEmail(!viaEmail); setErreur(""); }}>
                  {viaEmail ? t("otp_par_tel") : t("otp_par_email")}
                </a>
              </p>
            </>
          ) : (
            <>
              <p className="sous-page">
                {t("otp_envoye_a")} <strong dir="ltr">{phoneE164}</strong>
              </p>
              <div className="champ">
                <label htmlFor="otp-code">{t("code_l")}</label>
                <input
                  id="otp-code" type="tel" inputMode="numeric" maxLength={6} className="champ-code"
                  autoComplete="one-time-code" placeholder={t("code_ph")} value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && validerCode()}
                  autoFocus
                />
              </div>
              <button className="btn-action" onClick={validerCode} disabled={occupe || code.length < 4}>
                {occupe ? t("otp_verif") : t("otp_valider")}
              </button>
              <p className="lien-bas">
                <a onClick={() => { setEtape("tel"); setCode(""); setErreur(""); }}>{t("otp_changer")}</a>
                {" · "}
                <a onClick={demanderCode}>{t("otp_renvoyer")}</a>
              </p>
            </>
          )}

          {erreur && <p className="erreur">{erreur}</p>}

          <p className="lien-bas">
            <a onClick={() => { setVue("principal"); setEtape("tel"); setCode(""); setErreur(""); }}>
              {t("auth_retour_connexion")}
            </a>
          </p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------- Écran principal (épuré)
  return (
    <div className="page">
      <div className="contenu-page auth-carte">
        <Entete />

        {/* Deux onglets très visibles : accéder à son compte / en créer un. */}
        <div className="onglets-connexion" role="tablist">
          <button role="tab" aria-selected={onglet === "connexion"}
                  className={onglet === "connexion" ? "actif" : ""}
                  onClick={() => { setOnglet("connexion"); setErreur(""); }}>
            {t("onglet_connexion")}
          </button>
          <button role="tab" aria-selected={onglet === "inscription"}
                  className={onglet === "inscription" ? "actif" : ""}
                  onClick={() => { setOnglet("inscription"); setErreur(""); }}>
            {t("onglet_inscription")}
          </button>
        </div>

        {onglet === "connexion" ? (
          <>
            <div className="champ">
              <label htmlFor="auth-id">{t("auth_contact_l")}</label>
              <input
                id="auth-id" type="text" autoComplete="username" autoCapitalize="none"
                placeholder={t("auth_contact_ph")} value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && validerIdentifiant()}
              />
            </div>
            <div className="champ">
              <label htmlFor="auth-mdp">{t("mdp2_l")}</label>
              <ChampMotDePasse
                id="auth-mdp" autoComplete="current-password" placeholder={t("mdp_ph")}
                value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && validerIdentifiant()}
              />
            </div>
            <button className="btn-action" onClick={validerIdentifiant} disabled={occupe}>
              {occupe ? t("otp_verif") : t("connexion_b")}
            </button>
          </>
        ) : (
          <>
            {/* Inscription volontairement courte : le reste du profil est
                demandé APRÈS la création du compte. */}
            <div className="champ">
              <label htmlFor="auth-nom">{t("nom2_l")}</label>
              <input id="auth-nom" type="text" autoComplete="family-name" placeholder={t("nom2_ph")}
                     value={nom} onChange={(e) => setNom(e.target.value)} />
            </div>
            <div className="champ">
              <label htmlFor="auth-prenom">{t("prenom_l")}</label>
              <input id="auth-prenom" type="text" autoComplete="given-name" placeholder={t("prenom_ph")}
                     value={prenom} onChange={(e) => setPrenom(e.target.value)} />
            </div>
            <div className="champ">
              <label htmlFor="auth-contact">{t("auth_contact_l")}</label>
              <input
                id="auth-contact" type="text" autoComplete="email" autoCapitalize="none"
                placeholder={t("auth_contact_ph")} value={contact}
                onChange={(e) => setContact(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && creerCompte()}
              />
            </div>
            <button className="btn-action" onClick={creerCompte} disabled={occupe}>
              {occupe ? t("otp_envoi") : t("auth_creer_compte")}
            </button>
          </>
        )}

        {erreur && <p className="erreur">{erreur}</p>}
        {!supabaseConfigured && <p className="erreur">{t("err_app_config")}</p>}

        {/* ---- Accordéon 1 : autres options de connexion (fermé par défaut) ---- */}
        <div className="acc">
          <button className="acc-tete" aria-expanded={accOptions} onClick={() => setAccOptions(!accOptions)}>
            <span className="acc-ico"><IcoOptions /></span>
            <span className="acc-libelle">{t("auth_autres_options")}</span>
            <Chevron ouvert={accOptions} />
          </button>
          {accOptions && (
            <div className="acc-corps">
              <div className="acc-grille">
                {OAUTH_PROVIDERS.map((prov) => (
                  <button key={prov} type="button" className="btn-oauth"
                          disabled={!!oauthOccupe} onClick={() => lancerOAuth(prov)}>
                    {ICONES_OAUTH[prov]}
                    <span>{oauthOccupe === prov ? t("otp_verif") : NOMS_OAUTH[prov]}</span>
                  </button>
                ))}
                <button type="button" className="btn-oauth" aria-label={t("auth_sms_rapide")}
                        title={t("auth_sms_rapide")}
                        onClick={() => { setVue("sms"); setEtape("tel"); setViaEmail(false); setErreur(""); }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
                  </svg>
                  <span>SMS</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ---- Accordéon 2 : besoin d'aide ? (fermé par défaut) ---- */}
        <div className="acc">
          <button className="acc-tete" aria-expanded={accAide} onClick={() => setAccAide(!accAide)}>
            <span className="acc-ico"><IcoAide /></span>
            <span className="acc-libelle">{t("aide_lien")}</span>
            <Chevron ouvert={accAide} />
          </button>
          {accAide && (
            <div className="acc-corps">
              {/* Réutilise la page d'aide existante (aucune logique dupliquée). */}
              <Link className="acc-item" href="/aide-connexion?sujet=mdp">
                <span>{t("aide_mdp_t")}</span> <Fleche />
              </Link>
              {/* Identifiant oublié : la solution ASM est de se reconnecter
                  par SMS, on y va directement. */}
              <button type="button" className="acc-item"
                      onClick={() => { setVue("sms"); setEtape("tel"); setViaEmail(false); setErreur(""); }}>
                <span>{t("aide_id_t")}</span> <Fleche />
              </button>
              <Link className="acc-item" href="/aide-connexion?sujet=code_sms">
                <span>{t("aide_code_t")}</span> <Fleche />
              </Link>
              <div className="acc-conseiller">
                <strong>{t("auth_conseiller")}</strong>
                <div className="acc-conseiller-actions">
                  <a href={TEL_LIEN} dir="ltr">{TEL_AFFICHE}</a>
                  <a href={WHATSAPP_LIEN} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#25D366" d="M12 0a12 12 0 0 0-10.4 18L0 24l6.2-1.6A12 12 0 1 0 12 0zm0 21.8a9.7 9.7 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm5.4-7.3c-.3-.2-1.8-.9-2-1s-.5-.2-.7.1-.8 1-1 1.2-.4.2-.7.1a8 8 0 0 1-2.4-1.5 8.9 8.9 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5s0-.4 0-.5-.7-1.6-.9-2.2-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4A3.4 3.4 0 0 0 5.8 9c0 1.5 1.1 3 1.2 3.2a13.3 13.3 0 0 0 5.1 4.5c.7.3 1.3.5 1.7.6a4 4 0 0 0 1.9.1 3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.5-.1z"/></svg>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

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
