"use client";
import { useState } from "react";
import ChampMotDePasse from "@/app/components/motdepasse";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { supabase, chargerProfil, utilisateurCourant } from "@/lib/supabase";

// Première connexion d'un client créé par l'équipe ASM : il crée son
// mot de passe personnel (pour la connexion par identifiant), puis
// rejoint son espace. « Plus tard » reste possible — on lui redemandera.
export default function PremiereConnexion() {
  const { t } = useAsm();
  const routeur = useRouter();
  const [mdp, setMdp] = useState("");
  const [confirm, setConfirm] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  async function versEspace() {
    const u = await utilisateurCourant();
    const profil = u ? await chargerProfil(u.id) : null;
    routeur.replace(profil?.role === "pro" ? "/pro" : "/tableau");
  }

  async function valider() {
    setErreur("");
    if (mdp.length < 8) return setErreur(t("pc_regle"));
    if (mdp !== confirm) return setErreur(t("err_mdp_conf"));
    setOccupe(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const meta = user?.user_metadata || {};
      const { error } = await supabase.auth.updateUser({
        password: mdp,
        data: { ...meta, must_create_password: false, password_changed_at: new Date().toISOString() },
      });
      if (error) throw error;
      try { await supabase.auth.refreshSession(); } catch {}
      await versEspace();
    } catch {
      setErreur(t("pc_err"));
      setOccupe(false);
    }
  }

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 420 }}>
        <h2 className="titre-page">{t("pc_t")}</h2>
        <p className="sous-page">{t("pc_s")}</p>

        <div className="champ">
          <label>{t("mdp_nouveau_l")}</label>
          <ChampMotDePasse value={mdp} onChange={(e) => setMdp(e.target.value)} placeholder="••••••••" autoFocus />
        </div>
        <div className="champ">
          <label>{t("mdp_conf_l")}</label>
          <ChampMotDePasse value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && valider()} />
        </div>
        <p className="precisions-aide">{t("pc_regle")}</p>

        {erreur && <p className="erreur">{erreur}</p>}

        <button className={"btn-action" + (occupe ? " btn-charge" : "")} onClick={valider} disabled={occupe}>
          {occupe ? t("envoi") : t("pc_valider")}
        </button>
        <p className="lien-bas">
          <a onClick={versEspace}>{t("pc_plus_tard")}</a>
        </p>
      </div>
    </div>
  );
}
