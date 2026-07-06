"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { utilisateurCourant, enregistrerProfil, definirEmailMotDePasse } from "@/lib/supabase";

// Finalisation du compte Patient : champs obligatoires (prénom, nom,
// commune, téléphone). Sans eux, on ne peut pas valider le compte.
export default function InscriptionPatient() {
  const { t, serviceEnCours, seConnecter } = useAsm();
  const routeur = useRouter();

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [commune, setCommune] = useState("");
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
    prenom.trim() && nom.trim() && commune.trim() && tel.trim() && email.trim() && motDePasse;

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
      // Ajoute email + mot de passe au compte (créé par SMS)
      try {
        await definirEmailMotDePasse(email.trim(), motDePasse);
      } catch (e) {
        const m = (e?.message || "").toLowerCase();
        const detail = JSON.stringify({
          name: e?.name,
          status: e?.status,
          code: e?.code,
          message: e?.message,
        });
        setErreur(
          m.includes("already") || m.includes("registered") || e?.code === "email_exists"
            ? t("err_email_pris")
            : t("err_profil") + " · [email] " + detail
        );
        return;
      }
      try {
        await enregistrerProfil({
          role: "patient",
          prenom: prenom.trim(),
          nom: nom.trim(),
          commune: commune.trim(),
          telephone: tel.trim(),
          email: email.trim(),
          nom_utilisateur: nomUtilisateur.trim() || null,
        });
      } catch (e) {
        setErreur(
          e?.code === "23505"
            ? t("err_user_pris")
            : t("err_profil") + " · [profil] " + (e?.message || e?.code || "?")
        );
        return;
      }
      seConnecter("patient");
      routeur.push(serviceEnCours ? "/rdv" : "/tableau");
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
        <h2 className="titre-page">{t("insc_pat_t")}</h2>
        <p className="sous-page">{t("insc_pat_s")}</p>

        <div className="champ">
          <label>
            {t("prenom_l")}
            <Etoile />
          </label>
          <input type="text" placeholder={t("prenom_ph")} value={prenom} onChange={(e) => setPrenom(e.target.value)} />
        </div>
        <div className="champ">
          <label>
            {t("nom2_l")}
            <Etoile />
          </label>
          <input type="text" placeholder={t("nom2_ph")} value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
        <div className="champ">
          <label>
            {t("ville_l")}
            <Etoile />
          </label>
          <input type="text" placeholder={t("ville_ph")} value={commune} onChange={(e) => setCommune(e.target.value)} />
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
          <input
            type="password"
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
