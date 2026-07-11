"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import {
  utilisateurCourant,
  chargerProfil,
  enregistrerProfil,
  changerMotDePasse,
} from "@/lib/supabase";
import { IcoPersonne, IcoCalendrier, IcoDocument, IcoSortie } from "@/app/components/icones";

// Page « Mon compte » : informations personnelles (consultation +
// modification), sécurité (mot de passe), raccourcis et déconnexion.
// Page privée : sans session connectée on renvoie vers /connexion.
export default function MonCompte() {
  const { t, connecte, compteType, seDeconnecter } = useAsm();
  const routeur = useRouter();

  const [pret, setPret] = useState(false);
  const [profil, setProfil] = useState(null);
  const [creeLe, setCreeLe] = useState("");
  const [telCompte, setTelCompte] = useState("");

  // Édition des informations
  const [edition, setEdition] = useState(false);
  const [champs, setChamps] = useState({});
  const [sauve, setSauve] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [msgInfos, setMsgInfos] = useState({ type: "", texte: "" });

  // Mot de passe
  const [mdp1, setMdp1] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [occupeMdp, setOccupeMdp] = useState(false);
  const [msgMdp, setMsgMdp] = useState({ type: "", texte: "" });

  // Garde d'accès + chargement du profil
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const c = sessionStorage.getItem("asm_connecte");
        if (c !== "patient" && c !== "pro") {
          routeur.replace("/connexion");
          return;
        }
        const user = await utilisateurCourant();
        if (annule) return;
        if (user) {
          setTelCompte(user.phone ? "+" + String(user.phone).replace(/^\+/, "") : "");
          if (user.created_at) setCreeLe(user.created_at.slice(0, 10));
          const p = await chargerProfil(user.id);
          if (!annule && p) setProfil(p);
        }
      } catch {}
      if (!annule) setPret(true);
    })();
    return () => {
      annule = true;
    };
  }, [routeur]);

  const estPro = (profil?.role || compteType) === "pro";

  function commencerEdition() {
    setChamps(
      estPro
        ? {
            etablissement: profil?.etablissement || "",
            contact: profil?.contact || "",
            telephone: profil?.telephone || telCompte,
          }
        : {
            prenom: profil?.prenom || "",
            nom: profil?.nom || "",
            commune: profil?.commune || "",
            telephone: profil?.telephone || telCompte,
          }
    );
    setMsgInfos({ type: "", texte: "" });
    setEdition(true);
  }

  async function enregistrer() {
    const vides = Object.values(champs).some((v) => !String(v).trim());
    if (vides) {
      setMsgInfos({ type: "erreur", texte: t("err_champs") });
      return;
    }
    setOccupe(true);
    setMsgInfos({ type: "", texte: "" });
    try {
      const nettoyes = Object.fromEntries(
        Object.entries(champs).map(([k, v]) => [k, String(v).trim()])
      );
      await enregistrerProfil(nettoyes);
      setProfil((p) => ({ ...p, ...nettoyes }));
      setEdition(false);
      setSauve(true);
      setTimeout(() => setSauve(false), 4000);
    } catch {
      setMsgInfos({ type: "erreur", texte: t("err_maj") });
    } finally {
      setOccupe(false);
    }
  }

  async function validerMdp() {
    setMsgMdp({ type: "", texte: "" });
    if (mdp1.length < 6) {
      setMsgMdp({ type: "erreur", texte: t("err_mdp") });
      return;
    }
    if (mdp1 !== mdp2) {
      setMsgMdp({ type: "erreur", texte: t("err_mdp_conf") });
      return;
    }
    setOccupeMdp(true);
    try {
      await changerMotDePasse(mdp1);
      setMdp1("");
      setMdp2("");
      setMsgMdp({ type: "ok", texte: t("mdp_ok") });
    } catch {
      setMsgMdp({ type: "erreur", texte: t("err_mdp_maj") });
    } finally {
      setOccupeMdp(false);
    }
  }

  async function deconnecter() {
    if (!window.confirm(t("deco_conf"))) return;
    await seDeconnecter();
    routeur.push("/accueil");
  }

  if (!pret || (!connecte && typeof window !== "undefined")) {
    return (
      <div className="page">
        <div className="contenu-page" style={{ maxWidth: 520 }}>
          <p className="sous-page">{t("compte_charge")}</p>
        </div>
      </div>
    );
  }

  const Ligne = ({ label, valeur }) =>
    valeur ? (
      <div className="compte-ligne">
        <span>{label}</span>
        <strong dir="auto">{valeur}</strong>
      </div>
    ) : null;

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 520 }}>
        <h2 className="titre-page">{t("compte_t")}</h2>
        <p className="sous-page">{t("compte_s")}</p>

        {/* ---- Identité ---- */}
        <div className="carte-compte entete-compte">
          <span className="avatar-compte" aria-hidden="true">
            <IcoPersonne />
          </span>
          <div>
            <strong>
              {estPro
                ? profil?.etablissement || t("type_pro")
                : [profil?.prenom, profil?.nom].filter(Boolean).join(" ") || t("type_patient")}
            </strong>
            <small>{estPro ? t("type_pro") : t("type_patient")}</small>
            {creeLe && (
              <small>
                {t("membre_depuis")} {creeLe}
              </small>
            )}
          </div>
        </div>

        {/* ---- Informations personnelles ---- */}
        <div className="carte-compte">
          <div className="titre-section">{t("sec_infos")}</div>

          {!edition && (
            <>
              {estPro ? (
                <>
                  <Ligne label={t("etab_l")} valeur={profil?.etablissement} />
                  <Ligne label={t("type_l")} valeur={profil?.type_etab} />
                  <Ligne label={t("contact_l")} valeur={profil?.contact} />
                </>
              ) : (
                <>
                  <Ligne label={t("prenom_l")} valeur={profil?.prenom} />
                  <Ligne label={t("nom2_l")} valeur={profil?.nom} />
                  <Ligne label={t("ville_l")} valeur={profil?.commune} />
                </>
              )}
              <Ligne label={t("tel_l")} valeur={profil?.telephone || telCompte} />
              <Ligne label={t("email_l")} valeur={profil?.email} />
              {profil?.nom_utilisateur && <Ligne label={t("user_l")} valeur={profil.nom_utilisateur} />}
              {telCompte && <Ligne label={t("tel_compte_l")} valeur={telCompte} />}

              {sauve && <p className="msg-ok">{t("maj_ok")}</p>}
              <button className="btn-secondaire" style={{ marginTop: 12 }} onClick={commencerEdition}>
                {t("modifier_b")}
              </button>
            </>
          )}

          {edition && (
            <>
              {Object.entries({
                ...(estPro
                  ? { etablissement: t("etab_l"), contact: t("contact_l") }
                  : { prenom: t("prenom_l"), nom: t("nom2_l"), commune: t("ville_l") }),
                telephone: t("tel_l"),
              }).map(([cle, label]) => (
                <div className="champ" key={cle}>
                  <label>{label}</label>
                  <input
                    type={cle === "telephone" ? "tel" : "text"}
                    value={champs[cle] ?? ""}
                    onChange={(e) => setChamps((c) => ({ ...c, [cle]: e.target.value }))}
                  />
                </div>
              ))}
              {msgInfos.texte && (
                <p className={msgInfos.type === "ok" ? "msg-ok" : "erreur"}>{msgInfos.texte}</p>
              )}
              <button className="btn-action" onClick={enregistrer} disabled={occupe}>
                {occupe ? t("otp_verif") : t("enregistrer_b")}
              </button>
              <button
                className="btn-secondaire"
                style={{ marginTop: 8 }}
                onClick={() => {
                  setEdition(false);
                  setMsgInfos({ type: "", texte: "" });
                }}
                disabled={occupe}
              >
                {t("annuler_b")}
              </button>
            </>
          )}
        </div>

        {/* ---- Sécurité ---- */}
        <div className="carte-compte">
          <div className="titre-section">{t("sec_securite")}</div>
          <div className="champ">
            <label>{t("mdp_nouveau_l")}</label>
            <input type="password" value={mdp1} onChange={(e) => setMdp1(e.target.value)} placeholder={t("mdp2_ph")} />
          </div>
          <div className="champ">
            <label>{t("mdp_conf_l")}</label>
            <input type="password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} placeholder={t("mdp2_ph")} />
          </div>
          {msgMdp.texte && (
            <p className={msgMdp.type === "ok" ? "msg-ok" : "erreur"}>{msgMdp.texte}</p>
          )}
          <button
            className="btn-secondaire"
            onClick={validerMdp}
            disabled={occupeMdp || !mdp1 || !mdp2}
          >
            {occupeMdp ? t("otp_verif") : t("mdp_changer_b")}
          </button>
        </div>

        {/* ---- Raccourcis ---- */}
        <div className="carte-compte">
          <div className="titre-section">{t("sec_acces")}</div>
          <Link className="item-liste lien-compte" href={estPro ? "/pro" : "/tableau"}>
            <span className="ico-service">
              <IcoCalendrier />
            </span>
            <span>
              <strong>{t("menu_demandes")}</strong>
            </span>
          </Link>
          <Link className="item-liste lien-compte" href="/documentation">
            <span className="ico-service">
              <IcoDocument />
            </span>
            <span>
              <strong>{t("nav_doc")}</strong>
            </span>
          </Link>
          {!estPro && (
            <Link className="item-liste lien-compte" href="/autorisations">
              <span className="ico-service">
                <IcoDocument />
              </span>
              <span>
                <strong>{t("aut_t")}</strong>
                <small>{t("aut_lien_s")}</small>
              </span>
            </Link>
          )}
        </div>

        {/* ---- Déconnexion ---- */}
        <button className="btn-deconnexion" onClick={deconnecter}>
          <IcoSortie /> {t("menu_deconnexion")}
        </button>
      </div>
    </div>
  );
}
