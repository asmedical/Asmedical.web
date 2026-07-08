"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAsm } from "@/app/providers";
import { IcoCalendrier, IcoBulle, IcoPlus, IcoDocumentLignes, IcoPersonne } from "@/app/components/icones";

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
// redirection obligatoire vers le changement de mot de passe temporaire,
// et barre de navigation inférieure (comme l'app patient, avec le + central).
export default function LayoutEmploye({ children }) {
  const routeur = useRouter();
  const chemin = usePathname();
  const { seDeconnecter } = useAsm();
  const [etat, setEtat] = useState("charge"); // charge | refuse | ok
  const [moi, setMoi] = useState(null);
  const [sheet, setSheet] = useState(false);

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
      // Filet anti double-demande : si le mot de passe vient d'être changé,
      // on ne renvoie pas vers la page de changement (latence métadonnées).
      let grace = false;
      try {
        grace = sessionStorage.getItem("asm_mdp_ok") === "1";
        if (grace) sessionStorage.removeItem("asm_mdp_ok");
      } catch {}
      if (d.mustChangePassword && !grace && chemin !== "/employe/mot-de-passe") {
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

  async function definirDispo(dispo) {
    setSheet(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch("/api/employe/moi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ dispo }),
      });
      await charger();
    } catch {}
  }

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

  const surMdp = chemin === "/employe/mot-de-passe";

  return (
    <EmployeCtx.Provider value={{ moi, rafraichir: charger }}>
      <div className={"emp-page" + (!surMdp ? " avec-barre-emp" : "")}>
        <header className="emp-entete">
          <strong>ASM · Espace {LIB_ROLE[moi?.role] || "employé"}</strong>
          <button className="emp-deco" onClick={deconnexion} aria-label="Se déconnecter">Déconnexion</button>
        </header>
        <div className="emp-contenu">{children}</div>

        {!surMdp && <BarreEmploye chemin={chemin} routeur={routeur} onPlus={() => setSheet(true)} />}

        {sheet && (
          <div className="sheet-fond" onClick={() => setSheet(false)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-titre">Actions rapides</div>
              <div className="emp-dispo-choix">
                <button className="emp-dispo-btn d-DISPONIBLE" onClick={() => definirDispo("DISPONIBLE")}>Disponible</button>
                <button className="emp-dispo-btn d-OCCUPE" onClick={() => definirDispo("OCCUPE")}>Occupé</button>
                <button className="emp-dispo-btn d-ABSENT" onClick={() => definirDispo("ABSENT")}>Absent</button>
              </div>
              <button className="sheet-opt" onClick={() => { setSheet(false); routeur.push("/employe/messagerie?chat=1"); }}>
                <IcoBulle /> <span>Message à l&apos;équipe ASM</span>
              </button>
              <button className="sheet-opt" onClick={() => { setSheet(false); routeur.push("/employe/planning"); }}>
                <IcoCalendrier /> <span>Voir mon planning</span>
              </button>
              <button className="sheet-annuler" onClick={() => setSheet(false)}>Annuler</button>
            </div>
          </div>
        )}
      </div>
    </EmployeCtx.Provider>
  );
}

function BarreEmploye({ chemin, routeur, onPlus }) {
  const { nonLus } = useAsm();
  const total = (nonLus?.notifs || 0) + (nonLus?.chat || 0);
  const actif = (r) => chemin === r;
  return (
    <nav className="barre" aria-label="Navigation employé">
      <button className={actif("/employe") ? "actif" : ""} onClick={() => routeur.push("/employe")} aria-label="Accueil" title="Accueil">
        <IcoCalendrier />
      </button>
      <button className={actif("/employe/planning") ? "actif" : ""} onClick={() => routeur.push("/employe/planning")} aria-label="Planning" title="Planning">
        <IcoDocumentLignes strokeWidth="1.9" />
      </button>
      <button className="btn-accueil" onClick={onPlus} aria-label="Actions rapides" title="Actions rapides">
        <span className="croix" aria-hidden="true"><IcoPlus /></span>
      </button>
      <button className={actif("/employe/messagerie") ? "actif" : ""} onClick={() => routeur.push("/employe/messagerie")} aria-label="Messagerie" title="Messagerie" style={{ position: "relative" }}>
        <IcoBulle strokeWidth="1.9" />
        {total > 0 && <span className="badge-nonlu badge-nav">{total > 99 ? "99+" : total}</span>}
      </button>
      <button className={actif("/employe/profil") ? "actif" : ""} onClick={() => routeur.push("/employe/profil")} aria-label="Mon profil" title="Mon profil">
        <IcoPersonne strokeWidth="1.9" />
      </button>
    </nav>
  );
}
