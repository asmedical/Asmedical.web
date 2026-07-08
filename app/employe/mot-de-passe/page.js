"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { definirMotDePasseDefinitif } from "@/lib/supabase";
import { useEmploye } from "../layout";

// Changement OBLIGATOIRE du mot de passe temporaire à la première connexion.
// Tant qu'il n'est pas changé, la garde du layout renvoie ici.
export default function MotDePasseObligatoire() {
  const routeur = useRouter();
  const employe = useEmploye();
  const [mdp, setMdp] = useState("");
  const [confirm, setConfirm] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [err, setErr] = useState("");

  const regles = [
    ["8 caractères minimum", mdp.length >= 8],
    ["une majuscule", /[A-Z]/.test(mdp)],
    ["un chiffre", /\d/.test(mdp)],
  ];
  const valide = regles.every(([, ok]) => ok) && mdp === confirm;

  async function valider() {
    setErr("");
    if (!valide) {
      setErr(mdp !== confirm ? "Les deux mots de passe ne sont pas identiques." : "Le mot de passe ne respecte pas les règles.");
      return;
    }
    setOccupe(true);
    try {
      await definirMotDePasseDefinitif(mdp);
      // Filet de sécurité contre la latence de propagation des métadonnées :
      // la garde du layout ne redemandera pas le changement juste après.
      try { sessionStorage.setItem("asm_mdp_ok", "1"); } catch {}
      routeur.replace("/employe");
    } catch {
      setErr("Impossible d'enregistrer le mot de passe. Réessayez.");
      setOccupe(false);
    }
  }

  return (
    <div className="emp-carte-centre">
      <h1 className="emp-titre">Créez votre mot de passe</h1>
      <p className="emp-sous">Pour votre sécurité, choisissez un nouveau mot de passe personnel. Le mot de passe temporaire ne sera plus utilisable.</p>

      <label className="fe-champ">
        <span>Nouveau mot de passe</span>
        <input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} placeholder="••••••••" autoFocus />
      </label>
      <label className="fe-champ" style={{ marginTop: 12 }}>
        <span>Confirmez le mot de passe</span>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && valider()} />
      </label>

      <ul className="emp-regles">
        {regles.map(([l, ok]) => (
          <li key={l} className={ok ? "ok" : ""}>{ok ? "✓" : "•"} {l}</li>
        ))}
      </ul>

      {err && <p className="erreur">{err}</p>}

      <button className={"adm-btn" + (occupe ? " btn-charge" : "")} onClick={valider} disabled={occupe || !valide} style={{ width: "100%", marginTop: 8 }}>
        {occupe ? "Enregistrement…" : "Enregistrer et continuer"}
      </button>
    </div>
  );
}
