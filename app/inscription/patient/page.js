"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { utilisateurCourant, enregistrerProfil } from "@/lib/supabase";

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

  const complet = prenom.trim() && nom.trim() && commune.trim() && tel.trim();

  async function valider() {
    setErreur("");
    if (!complet) {
      setErreur(t("err_champs"));
      return;
    }
    setOccupe(true);
    try {
      await enregistrerProfil({
        role: "patient",
        prenom: prenom.trim(),
        nom: nom.trim(),
        commune: commune.trim(),
        telephone: tel.trim(),
      });
      seConnecter("patient");
      routeur.push(serviceEnCours ? "/rdv" : "/tableau");
    } catch {
      setErreur(t("err_profil"));
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

        <button className="btn-action" onClick={valider} disabled={occupe || !complet}>
          {occupe ? t("otp_verif") : t("insc_valider")}
        </button>
        {erreur && <p className="erreur">{erreur}</p>}
      </div>
    </div>
  );
}
