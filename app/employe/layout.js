"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAsm } from "@/app/providers";

const EmployeCtx = createContext(null);
export const useEmploye = () => useContext(EmployeCtx);

const LIB_ROLE = {
  aide_soignant: "Aide-soignant",
  infirmier: "Infirmier",
  chauffeur: "Chauffeur",
  transporteur: "Transporteur",
  coordinateur: "Coordinateur",
  employe_interne: "Employé ASM",
};

// Espace employé : chrome dédié (vert médical), garde d'accès par rôle,
// et redirection obligatoire vers le changement de mot de passe temporaire.
export default function LayoutEmploye({ children }) {
  const routeur = useRouter();
  const chemin = usePathname();
  const { seDeconnecter } = useAsm();
  const [etat, setEtat] = useState("charge"); // charge | refuse | ok
  const [moi, setMoi] = useState(null);

  async function charger() {
    if (!supabase) return setEtat("refuse");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      routeur.replace("/connexion?mode=identifiant");
      return;
    }
    try {
      const r = await fetch("/api/employe/moi", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!r.ok) return setEtat("refuse");
      const d = await r.json();
      setMoi(d);
      if (d.mustChangePassword && chemin !== "/employe/mot-de-passe") {
        routeur.replace("/employe/mot-de-passe");
        return;
      }
      setEtat("ok");
    } catch {
      setEtat("refuse");
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chemin]);

  const deconnexion = async () => {
    await seDeconnecter();
    routeur.replace("/connexion?mode=identifiant");
  };

  if (etat === "charge") {
    return <div className="emp-page"><div className="emp-contenu"><p className="adm-vide">Chargement de votre espace…</p></div></div>;
  }
  if (etat === "refuse") {
    return (
      <div className="emp-page">
        <div className="emp-refus">
          <h1>Accès réservé au personnel</h1>
          <p>Cet espace est destiné aux employés ASM. Si vous êtes patient, rejoignez votre espace habituel.</p>
          <button className="adm-btn" onClick={deconnexion}>Se déconnecter</button>
        </div>
      </div>
    );
  }

  return (
    <EmployeCtx.Provider value={{ moi, rafraichir: charger }}>
      <div className={"emp-page" + (chemin !== "/employe/mot-de-passe" ? " avec-barre-emp" : "")}>
        <header className="emp-entete">
          <strong>ASM · Espace {LIB_ROLE[moi?.role] || "employé"}</strong>
          <button className="emp-deco" onClick={deconnexion} aria-label="Se déconnecter">Déconnexion</button>
        </header>
        <div className="emp-contenu">{children}</div>
      </div>
    </EmployeCtx.Provider>
  );
}
