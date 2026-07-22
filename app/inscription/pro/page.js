"use client";
import Link from "next/link";
import ChampMotDePasse from "@/app/components/motdepasse";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { utilisateurCourant, enregistrerProfil, definirEmailMotDePasse } from "@/lib/supabase";

// Finalisation du compte Établissement : champs obligatoires
// (nom de l'établissement, type, personne à contacter, téléphone).
export default function InscriptionPro() {
  const { t, seConnecter } = useAsm();
  const routeur = useRouter();

  const [etablissement, setEtablissement] = useState("");
  const [type, setType] = useState("Hôpital");
  const [contact, setContact] = useState("");
  const [tel, setTel] = useState("");
  const [telFige, setTelFige] = useState(false);
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [nomUtilisateur, setNomUtilisateur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    utilisateurCourant()
      .then((u) => {
        if (u?.phone) {
          setTel("+" + String(u.phone).replace(/^\+/, ""));
          setTelFige(true);
        }
      })
      .catch(() => {});
  }, []);

  const complet =
    etablissement.trim() && type.trim() && contact.trim() && tel.trim() && email.trim() && motDePasse;

  async function valider() {
    setErreur("");
    if (!complet) {
      setErreur(t("err_champs"));
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setErreur(t("err_email"));
      return;
    }
    if (motDePasse.length < 6) {
      setErreur(t("err_mdp"));
      return;
    }
    setOccupe(true);
    try {
      try {
        await definirEmailMotDePasse(email.trim(), motDePasse);
      } catch (e) {
        const m = (e?.message || "").toLowerCase();
        setErreur(
          m.includes("already") || m.includes("registered") || e?.code === "email_exists"
            ? t("err_email_pris")
            : t("err_profil")
        );
        return;
      }
      try {
        await enregistrerProfil({
          role: "pro",
          etablissement: etablissement.trim(),
          type_etab: type,
          contact: contact.trim(),
          telephone: tel.trim(),
          email: email.trim(),
          nom_utilisateur: nomUtilisateur.trim() || null,
        });
      } catch (e) {
        setErreur(e?.code === "23505" ? t("err_user_pris") : t("err_profil"));
        return;
      }
      seConnecter("pro");
      routeur.push("/pro");
    } finally {
      setOccupe(false);
    }
  }

  const Etoile = () => <span className="req"> *</span>;

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 440 }}>
        <Link className="btn-retour" href="/connexion">
          {t("retour")}
        </Link>
        <h2 className="titre-page">{t("insc_pro_t")}</h2>
        <p className="sous-page">{t("insc_pro_s")}</p>

        <div className="champ">
          <label>
            {t("etab_l")}
            <Etoile />
          </label>
          <input
            type="text"
            placeholder={t("etab_ph")}
            value={etablissement}
            onChange={(e) => setEtablissement(e.target.value)}
          />
        </div>
        <div className="champ">
          <label>
            {t("type_l")}
            <Etoile />
          </label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option>{t("type_hopital")}</option>
            <option>{t("type_clinique")}</option>
            <option>{t("type_labo")}</option>
            <option>{t("type_pharma")}</option>
            <option>{t("type_centre")}</option>
          </select>
        </div>
        <div className="champ">
          <label>
            {t("contact_l")}
            <Etoile />
          </label>
          <input type="text" placeholder={t("contact_ph")} value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
        <div className="champ">
          <label>
            {t("tel_l")}
            <Etoile />
          </label>
          <input
            type="tel"
            placeholder={t("tel_ph")}
            value={tel}
            onChange={(e) => setTel(e.target.value)}
            readOnly={telFige}
            style={telFige ? { background: "var(--vert-pale)", color: "var(--gris)" } : undefined}
          />
        </div>
        <div className="champ">
          <label>
            {t("email_l")}
            <Etoile />
          </label>
          <input type="email" placeholder={t("email_ph")} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="champ">
          <label>
            {t("mdp2_l")}
            <Etoile />
          </label>
          <ChampMotDePasse
            placeholder={t("mdp2_ph")}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />
        </div>
        <div className="champ">
          <label>{t("user_l")}</label>
          <input type="text" placeholder={t("user_ph")} value={nomUtilisateur} onChange={(e) => setNomUtilisateur(e.target.value)} />
        </div>

        <button className="btn-action" onClick={valider} disabled={occupe || !complet}>
          {occupe ? t("otp_verif") : t("insc_valider")}
        </button>
        {erreur && <p className="erreur">{erreur}</p>}
      </div>
    </div>
  );
}
