"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// ---- Utilitaires partagés de l'espace admin (interne, FR) ----

export const ROLES_ADMIN = ["superadmin", "admin", "moderateur", "standardiste"];

export const LIBELLE_ROLE = {
  superadmin: "Super admin",
  admin: "Admin",
  moderateur: "Modérateur",
  standardiste: "Standardiste",
  patient: "Client (patient)",
  pro: "Client (établissement)",
};

export const LIBELLE_STATUT_DEMANDE = {
  A_RAPPELER: "À rappeler",
  CONFIRMEE: "Confirmée",
  AFFECTEE: "Affectée",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  ABSENT: "Absent",
  ANNULEE: "Annulée",
};

export const LIBELLE_STATUT_INTERVENANT = {
  EN_ATTENTE: "En attente",
  VALIDE: "Validé",
  SUSPENDU: "Suspendu",
  INACTIF: "Inactif",
  REFUSE: "Refusé",
};

export const SERVICES = {
  transport: "Transport",
  domicile: "Aide à domicile",
  medicaments: "Médicaments",
};

// Appel API admin avec le jeton de session.
export async function fetchAdmin(chemin, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const r = await fetch(chemin, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
      ...(options.headers || {}),
    },
  });
  if (!r.ok) throw Object.assign(new Error("api"), { status: r.status });
  return r.json();
}

// Garde d'accès : vérifie la session + le rôle interne. Retourne
// { pret, autorise, role }. Redirection gérée par l'appelant.
export function useGardeAdmin() {
  const [etat, setEtat] = useState({ pret: false, autorise: false, role: "" });
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        if (!supabase) throw new Error();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error();
        const { data: p } = await supabase.from("profil").select("role").eq("id", user.id).maybeSingle();
        if (annule) return;
        const ok = p && ROLES_ADMIN.includes(p.role);
        setEtat({ pret: true, autorise: !!ok, role: p?.role || "" });
      } catch {
        if (!annule) setEtat({ pret: true, autorise: false, role: "" });
      }
    })();
    return () => {
      annule = true;
    };
  }, []);
  return etat;
}

export function Pastille({ statut, table }) {
  const libelle = (table || LIBELLE_STATUT_DEMANDE)[statut] || statut;
  const classe =
    statut === "TERMINEE" || statut === "VALIDE" || statut === "CONFIRMEE"
      ? "adm-pastille ok"
      : statut === "ANNULEE" || statut === "REFUSE" || statut === "SUSPENDU" || statut === "ABSENT"
      ? "adm-pastille ko"
      : "adm-pastille";
  return <span className={classe}>{libelle}</span>;
}

// Panneau de notes internes réutilisable (demande / client / soignant / transporteur).
export function NotesInternes({ entite, entiteId }) {
  const [notes, setNotes] = useState(null);
  const [texte, setTexte] = useState("");
  const [occupe, setOccupe] = useState(false);

  async function charger() {
    try {
      const d = await fetchAdmin(`/api/admin/notes?entite=${entite}&entiteId=${entiteId}`);
      setNotes(d.notes);
    } catch {
      setNotes([]);
    }
  }
  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entite, entiteId]);

  async function ajouter() {
    if (!texte.trim()) return;
    setOccupe(true);
    try {
      await fetchAdmin("/api/admin/notes", {
        method: "POST",
        body: JSON.stringify({ entite, entiteId, texte }),
      });
      setTexte("");
      await charger();
    } catch {}
    setOccupe(false);
  }

  return (
    <div className="adm-notes">
      <strong>Notes internes</strong>
      {notes === null && <p className="adm-vide">Chargement…</p>}
      {notes?.length === 0 && <p className="adm-vide">Aucune note.</p>}
      {notes?.map((n) => (
        <div className="adm-note" key={n.id}>
          <small>
            {n.auteur} · {new Date(n.creeLe).toLocaleString("fr-FR")}
          </small>
          <p>{n.texte}</p>
        </div>
      ))}
      <div className="adm-note-form">
        <input
          type="text"
          placeholder="Ajouter une note (invisible pour le client)…"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ajouter()}
        />
        <button onClick={ajouter} disabled={occupe || !texte.trim()}>
          Ajouter
        </button>
      </div>
    </div>
  );
}
