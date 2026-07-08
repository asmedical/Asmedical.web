"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";
import {
  envoyerCodeEmail,
  verifierCodeEmail,
  changerMotDePasse,
  chargerProfil,
} from "@/lib/supabase";
import { IcoPersonne, IcoBulle, IcoTelephone, IcoEnvoyer } from "@/app/components/icones";

// « Problème de connexion ? » — un point d'entrée unique qui propose des
// solutions claires : mot de passe oublié (récupération par email + code),
// identifiant/email oublié (→ SMS), code SMS non reçu (astuces + email),
// et appeler un conseiller. Aucune donnée technique visible.
export default function AideConnexion() {
  const { t, seConnecter } = useAsm();
  const routeur = useRouter();

  const [vue, setVue] = useState("menu"); // menu | mdp | code_sms
  const [etape, setEtape] = useState("email"); // email | code | nouveau | ok
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mdp1, setMdp1] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  async function envoyer() {
    setErreur("");
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setErreur(t("err_email"));
      return;
    }
    setOccupe(true);
    try {
      await envoyerCodeEmail(email.trim());
      setEtape("code");
    } catch (e) {
      const m = (e?.message || "").toLowerCase();
      // Échec d'envoi (SMTP) vs compte réellement introuvable.
      const echecEnvoi = e?.status >= 500 || m.includes("send") || m.includes("mail") || m.includes("smtp");
      setErreur(echecEnvoi ? t("err_envoi_email") : t("err_email_introuvable"));
    } finally {
      setOccupe(false);
    }
  }

  async function verifier() {
    setErreur("");
    setOccupe(true);
    try {
      await verifierCodeEmail(email.trim(), code.trim());
      setEtape("nouveau");
    } catch {
      setErreur(t("err_code_email"));
    } finally {
      setOccupe(false);
    }
  }

  async function enregistrer() {
    setErreur("");
    if (mdp1.length < 6) {
      setErreur(t("err_mdp"));
      return;
    }
    if (mdp1 !== mdp2) {
      setErreur(t("err_mdp_conf"));
      return;
    }
    setOccupe(true);
    try {
      await changerMotDePasse(mdp1);
      // La vérification du code email a ouvert une vraie session : on
      // marque l'utilisateur connecté selon son profil.
      try {
        const { utilisateurCourant } = await import("@/lib/supabase");
        const user = await utilisateurCourant();
        const profil = user ? await chargerProfil(user.id) : null;
        seConnecter(profil?.role === "pro" ? "pro" : "patient");
      } catch {}
      setEtape("ok");
    } catch {
      setErreur(t("err_mdp_maj"));
    } finally {
      setOccupe(false);
    }
  }

  const AppelerBloc = () => (
    <a className="aide-option" href={TEL_LIEN}>
      <span className="aide-ico">
        <IcoTelephone />
      </span>
      <span>
        <strong>{t("aide_agent_t")}</strong>
        <small>{TEL_AFFICHE}</small>
      </span>
    </a>
  );

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 480 }}>
        {vue === "menu" && (
          <>
            <Link className="btn-retour" href="/connexion">
              {t("retour")}
            </Link>
            <h2 className="titre-page">{t("aide_t")}</h2>
            <p className="sous-page">{t("aide_s")}</p>

            <button className="aide-option" onClick={() => { setVue("mdp"); setEtape("email"); setErreur(""); }}>
              <span className="aide-ico">
                <IcoEnvoyer />
              </span>
              <span>
                <strong>{t("aide_mdp_t")}</strong>
                <small>{t("aide_mdp_d")}</small>
              </span>
            </button>

            <Link className="aide-option" href="/connexion">
              <span className="aide-ico">
                <IcoPersonne />
              </span>
              <span>
                <strong>{t("aide_id_t")}</strong>
                <small>{t("aide_id_d")}</small>
              </span>
            </Link>

            <button className="aide-option" onClick={() => { setVue("code_sms"); setErreur(""); }}>
              <span className="aide-ico">
                <IcoBulle strokeWidth="1.9" />
              </span>
              <span>
                <strong>{t("aide_code_t")}</strong>
                <small>{t("aide_code_d")}</small>
              </span>
            </button>

            <AppelerBloc />
          </>
        )}

        {/* ---- Code SMS non reçu ---- */}
        {vue === "code_sms" && (
          <>
            <button className="btn-retour" onClick={() => setVue("menu")}>
              {t("retour")}
            </button>
            <h2 className="titre-page">{t("aide_code_t")}</h2>
            <ul className="aide-astuces">
              <li>{t("aide_code_astuce1")}</li>
              <li>{t("aide_code_astuce2")}</li>
              <li>{t("aide_code_astuce3")}</li>
            </ul>
            <Link className="btn-action" href="/connexion">
              {t("aide_sms_b")}
            </Link>
            <Link className="btn-secondaire" style={{ marginTop: 10 }} href="/connexion?mode=identifiant">
              {t("aide_email_b")}
            </Link>
            <div style={{ marginTop: 18 }}>
              <AppelerBloc />
            </div>
          </>
        )}

        {/* ---- Mot de passe oublié : email → code → nouveau ---- */}
        {vue === "mdp" && (
          <>
            {etape !== "ok" && (
              <button
                className="btn-retour"
                onClick={() => (etape === "email" ? setVue("menu") : setEtape("email"))}
              >
                {t("retour")}
              </button>
            )}
            <h2 className="titre-page">{t("mdp_oub_t")}</h2>

            {etape === "email" && (
              <>
                <p className="sous-page">{t("mdp_oub_email")}</p>
                <div className="champ">
                  <label>{t("email_l")}</label>
                  <input
                    type="email"
                    inputMode="email"
                    placeholder={t("email_ph")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && envoyer()}
                  />
                </div>
                <button className="btn-action" onClick={envoyer} disabled={occupe}>
                  {occupe ? t("otp_envoi") : t("mdp_oub_envoyer")}
                </button>
              </>
            )}

            {etape === "code" && (
              <>
                <p className="sous-page">
                  {t("mdp_oub_code")} <strong dir="ltr">{email}</strong>
                </p>
                <div className="champ">
                  <label>{t("code_l")}</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={8}
                    className="champ-code"
                    placeholder={t("code_ph")}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    onKeyDown={(e) => e.key === "Enter" && verifier()}
                    autoFocus
                  />
                </div>
                <button className="btn-action" onClick={verifier} disabled={occupe || code.length < 4}>
                  {occupe ? t("otp_verif") : t("otp_valider")}
                </button>
                <p className="lien-bas">
                  <a onClick={envoyer}>{t("otp_renvoyer")}</a>
                </p>
              </>
            )}

            {etape === "nouveau" && (
              <>
                <p className="sous-page">{t("mdp_oub_nouveau")}</p>
                <div className="champ">
                  <label>{t("mdp_nouveau_l")}</label>
                  <input type="password" value={mdp1} onChange={(e) => setMdp1(e.target.value)} placeholder={t("mdp2_ph")} />
                </div>
                <div className="champ">
                  <label>{t("mdp_conf_l")}</label>
                  <input type="password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} placeholder={t("mdp2_ph")} />
                </div>
                <button className="btn-action" onClick={enregistrer} disabled={occupe}>
                  {occupe ? t("otp_verif") : t("mdp_oub_valider")}
                </button>
              </>
            )}

            {etape === "ok" && (
              <div className="confirmation">
                <div className="rond-ok">✓</div>
                <h3 style={{ fontSize: 20, marginBottom: 6 }}>{t("mdp_oub_ok_t")}</h3>
                <p style={{ color: "var(--gris)" }}>{t("mdp_oub_ok_p")}</p>
                <Link className="btn-action" style={{ marginTop: 18 }} href="/compte">
                  {t("menu_compte")}
                </Link>
              </div>
            )}

            {erreur && <p className="erreur">{erreur}</p>}
          </>
        )}
      </div>
    </div>
  );
}
