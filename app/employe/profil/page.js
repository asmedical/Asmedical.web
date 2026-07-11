"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { changerMotDePasse } from "@/lib/supabase";
import { useEmploye } from "../layout";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function ProfilEmploye() {
  const { moi } = useEmploye();
  const routeur = useRouter();
  const [ouvertMdp, setOuvertMdp] = useState(false);
  const [mdp, setMdp] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [occupe, setOccupe] = useState(false);
  if (!moi) return null;
  const iv = moi.intervenant;
  const repos = String(iv?.joursOff || "").split(",").filter((x) => x !== "").map((n) => JOURS[Number(n)]).join(" · ");

  async function changer() {
    setErr(""); setMsg("");
    if (mdp.length < 8) return setErr("8 caractères minimum.");
    setOccupe(true);
    try {
      await changerMotDePasse(mdp);
      setMsg("Mot de passe mis à jour ✓");
      setMdp(""); setOuvertMdp(false);
    } catch {
      setErr("Impossible de changer le mot de passe.");
    }
    setOccupe(false);
  }

  return (
    <>
      <Link className="adm-btn secondaire" href="/employe" style={{ marginBottom: 14, display: "inline-block" }}>← Retour</Link>
      <h1 className="emp-titre">Mon profil</h1>

      <div className="fe-carte">
        <div className="fe-ligne"><span className="fe-label">Nom</span><span className="fe-valeur">{moi.prenom} {moi.nom}</span></div>
        {iv && <>
          <div className="fe-ligne"><span className="fe-label">Téléphone</span><span className="fe-valeur">{iv.telephone || "—"}</span></div>
          <div className="fe-ligne"><span className="fe-label">{moi.estChauffeur ? "Zone couverte" : "Communes"}</span><span className="fe-valeur">{iv.communes || "—"}</span></div>
          <div className="fe-ligne"><span className="fe-label">Horaires</span><span className="fe-valeur">{iv.heureDebut}h – {iv.heureFin}h</span></div>
          <div className="fe-ligne"><span className="fe-label">Jours de repos</span><span className="fe-valeur">{repos || "—"}</span></div>
          {iv.conges && <div className="fe-ligne"><span className="fe-label">Congés</span><span className="fe-valeur">{iv.conges}</span></div>}
          {moi.estChauffeur ? (
            <>
              <div className="fe-ligne"><span className="fe-label">Véhicule</span><span className="fe-valeur">{[iv.vehicule, iv.vehiculeCouleur].filter(Boolean).join(" · ") || "—"}</span></div>
              <div className="fe-ligne"><span className="fe-label">Immatriculation</span><span className="fe-valeur">{iv.vehiculeImmat || "—"}</span></div>
            </>
          ) : (
            <div className="fe-ligne"><span className="fe-label">Spécialités</span><span className="fe-valeur">{iv.specialites || "—"}</span></div>
          )}
        </>}
      </div>

      <p className="emp-sous" style={{ marginTop: 16 }}>Pour toute modification de vos informations, contactez la coordination ASM.</p>

      <h2 className="emp-section">Sécurité</h2>
      {!ouvertMdp ? (
        <button className="adm-btn secondaire" onClick={() => setOuvertMdp(true)}>Changer mon mot de passe</button>
      ) : (
        <div className="fe-carte">
          <label className="fe-champ"><span>Nouveau mot de passe</span>
            <input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} placeholder="••••••••" />
          </label>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className={"adm-btn" + (occupe ? " btn-charge" : "")} onClick={changer} disabled={occupe}>Enregistrer</button>
            <button className="adm-btn secondaire" onClick={() => { setOuvertMdp(false); setMdp(""); setErr(""); }}>Annuler</button>
          </div>
        </div>
      )}
      {msg && <p className="adm-msg">{msg}</p>}
      {err && <p className="erreur">{err}</p>}
    </>
  );
}
