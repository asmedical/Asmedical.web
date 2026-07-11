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
  if (!r.ok) {
    const corps = await r.json().catch(() => ({}));
    throw Object.assign(new Error(corps.erreur || "api"), { status: r.status, data: corps });
  }
  return r.json();
}

// Envoi d'une photo (soignant / transporteur) en multipart. On n'utilise
// PAS fetchAdmin ici : il force Content-Type: application/json, ce qui
// casserait l'upload de fichier. On ne pose que l'en-tête Authorization.
export async function envoyerPhoto(entite, id, fichier) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const form = new FormData();
  form.append("fichier", fichier);
  form.append("entite", entite);
  form.append("id", String(id));
  const r = await fetch("/api/admin/upload-photo", {
    method: "POST",
    headers: { Authorization: `Bearer ${session?.access_token || ""}` },
    body: form,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erreur || "Envoi impossible.");
  return d.url;
}

// Avatar rond réutilisable : photo si disponible, sinon initiales.
// En cas d'image cassée (URL morte, bucket privé…), repli propre sur
// les initiales — jamais d'icône « ? » du navigateur.
export function Avatar({ url, nom, mini }) {
  const [casse, setCasse] = useState(false);
  useEffect(() => {
    setCasse(false);
  }, [url]);
  const initiales =
    String(nom || "")
      .split(/\s+/)
      .map((m) => m[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "•";
  const classe = "adm-avatar" + (mini ? " mini" : "");
  if (!url || casse) return <span className={classe + " vide"}>{initiales}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={nom || ""} className={classe} onError={() => setCasse(true)} />
  );
}

// Avatar + bouton d'envoi de photo réutilisable (soignant / transporteur).
// Affiche la photo actuelle (ou les initiales) et permet d'en choisir une,
// avec barre de chargement pendant l'envoi et messages clairs.
export function ChampPhoto({ entite, id, url, nom, onPhoto }) {
  const [apercu, setApercu] = useState(url || "");
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Suit la photo réelle quand la fiche change ou est rechargée.
  useEffect(() => {
    setApercu(url || "");
    setMsg("");
    setErr("");
  }, [url, id]);

  async function choisir(e) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    setErr("");
    setMsg("");
    setOccupe(true);
    try {
      const nouvelle = await envoyerPhoto(entite, id, fichier);
      setApercu(nouvelle);
      setMsg("Photo mise à jour ✓");
      onPhoto?.(nouvelle);
    } catch (ex) {
      setErr(ex.message || "Erreur lors de l'envoi de la photo.");
    }
    setOccupe(false);
  }

  return (
    <div className="adm-photo">
      <Avatar url={apercu} nom={nom} />
      <label className={"adm-btn secondaire adm-photo-btn" + (occupe ? " btn-charge" : "")}>
        {occupe ? "Envoi de la photo…" : apercu ? "Changer la photo" : "Ajouter une photo"}
        <input type="file" accept="image/*" onChange={choisir} disabled={occupe} hidden />
      </label>
      {msg && <small className="adm-photo-ok">{msg}</small>}
      {err && <small className="adm-photo-err">{err}</small>}
    </div>
  );
}

// POST multipart (fichier) avec le jeton admin — ne force pas le
// Content-Type JSON (indispensable pour un envoi de fichier).
export async function postFichierAdmin(chemin, formData) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const r = await fetch(chemin, {
    method: "POST",
    headers: { Authorization: `Bearer ${session?.access_token || ""}` },
    body: formData,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.erreur || "api"), { status: r.status });
  return d;
}

// Garde d'accès : vérifie la session + le rôle interne. Retourne
// { pret, autorise, role, nom }. Redirection gérée par l'appelant.
export function useGardeAdmin() {
  const [etat, setEtat] = useState({ pret: false, autorise: false, role: "", nom: "" });
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        if (!supabase) throw new Error();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error();
        const { data: p } = await supabase.from("profil").select("role, prenom, nom").eq("id", user.id).maybeSingle();
        if (annule) return;
        const ok = p && ROLES_ADMIN.includes(p.role);
        setEtat({
          pret: true,
          autorise: !!ok,
          role: p?.role || "",
          nom: [p?.prenom, p?.nom].filter(Boolean).join(" "),
        });
      } catch {
        if (!annule) setEtat({ pret: true, autorise: false, role: "", nom: "" });
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
