"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGardeAdmin, LIBELLE_ROLE, fetchAdmin } from "./ui";
import { useAsm } from "@/app/providers";
import {
  IcoDocumentLignes,
  IcoCalendrier,
  IcoPersonne,
  IcoMaison,
  IcoVehicule,
  IcoEtablissement,
  IcoReglages,
  IcoSortie,
  IcoBulle,
  IcoPlus,
} from "@/app/components/icones";

// Onglets mobile (barre du bas, inchangée) — et source des entrées desktop.
const ONGLETS = [
  { href: "/admin", libelle: "Bord", Ico: IcoDocumentLignes },
  { href: "/admin/demandes", libelle: "Demandes", Ico: IcoCalendrier },
  { href: "/admin/abonnements", libelle: "Abonnés", Ico: IcoVehicule },
  { href: "/admin/messages", libelle: "Messages", Ico: IcoBulle },
  { href: "/admin/clients", libelle: "Clients", Ico: IcoPersonne },
  { href: "/admin/soignants", libelle: "Soignants", Ico: IcoMaison },
  { href: "/admin/transporteurs", libelle: "Transport", Ico: IcoVehicule },
  { href: "/admin/equipe", libelle: "Équipe", Ico: IcoEtablissement },
  { href: "/admin/reglages", libelle: "Réglages", Ico: IcoReglages },
];

const TOUS = ["superadmin", "admin", "moderateur", "standardiste"];

// Navigation latérale desktop, groupée — chaque entrée est filtrée par rôle.
const GROUPES = [
  {
    titre: "Pilotage",
    liens: [
      { href: "/admin", libelle: "Tableau de bord", Ico: IcoDocumentLignes, roles: TOUS },
      { href: "/admin/planning", libelle: "Planning", Ico: IcoCalendrier, roles: TOUS },
      { href: "/admin/demandes?supervision=en_retard", libelle: "⏱ En retard", roles: TOUS },
      { href: "/admin/demandes?supervision=non_confirmee", libelle: "❓ Non confirmées", roles: TOUS },
      { href: "/admin/demandes?supervision=probleme", libelle: "⚠️ Problèmes signalés", roles: TOUS },
    ],
  },
  {
    titre: "Prestations",
    liens: [
      { href: "/admin/demandes", libelle: "Demandes & rendez-vous", Ico: IcoCalendrier, roles: TOUS },
      { href: "/admin/abonnements", libelle: "Abonnements réguliers", Ico: IcoVehicule, roles: TOUS },
    ],
  },
  {
    titre: "Utilisateurs",
    liens: [
      { href: "/admin/clients", libelle: "Clients (patients & établ.)", Ico: IcoPersonne, roles: TOUS },
      { href: "/admin/soignants", libelle: "Soignants", Ico: IcoMaison, roles: TOUS },
      { href: "/admin/transporteurs", libelle: "Transporteurs", Ico: IcoVehicule, roles: TOUS },
    ],
  },
  {
    titre: "Finances",
    liens: [{ href: "/admin/finances", libelle: "Finances & facturation", Ico: IcoDocumentLignes, roles: TOUS }],
  },
  {
    titre: "Communication",
    liens: [{ href: "/admin/messages", libelle: "Messagerie & diffusion", Ico: IcoBulle, roles: TOUS }],
  },
  {
    titre: "Administration",
    liens: [
      { href: "/admin/equipe", libelle: "Équipe & journal", Ico: IcoEtablissement, roles: ["superadmin", "admin", "moderateur"] },
      { href: "/admin/exports", libelle: "Exports & rapports", Ico: IcoDocumentLignes, roles: ["superadmin", "admin", "moderateur"] },
      { href: "/admin/reglages", libelle: "Réglages", Ico: IcoReglages, roles: ["superadmin", "admin", "moderateur"] },
    ],
  },
];

// Menu « + Créer » (en-tête desktop), filtré par rôle.
const CREER = [
  { href: "/admin/demandes", libelle: "Rendez-vous / demande", roles: TOUS },
  { href: "/admin/soignants", libelle: "Soignant", roles: ["superadmin", "admin", "moderateur"] },
  { href: "/admin/transporteurs", libelle: "Transporteur", roles: ["superadmin", "admin", "moderateur"] },
  { href: "/admin/messages", libelle: "Diffusion à un groupe", roles: ["superadmin", "admin", "moderateur"] },
];

// ---- Recherche globale (desktop) ----
function RechercheGlobale() {
  const routeur = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);
  const minuteur = useRef(null);

  useEffect(() => {
    const fermer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOuvert(false);
    };
    document.addEventListener("pointerdown", fermer);
    return () => document.removeEventListener("pointerdown", fermer);
  }, []);

  function chercher(valeur) {
    setQ(valeur);
    clearTimeout(minuteur.current);
    if (valeur.trim().length < 2) {
      setRes(null);
      return;
    }
    minuteur.current = setTimeout(async () => {
      try {
        const d = await fetchAdmin(`/api/admin/recherche?q=${encodeURIComponent(valeur.trim())}`);
        setRes(d.resultats);
        setOuvert(true);
      } catch {
        setRes(null);
      }
    }, 250);
  }

  const aller = (chemin) => {
    setOuvert(false);
    setQ("");
    setRes(null);
    routeur.push(chemin);
  };

  const vide =
    res &&
    !res.clients?.length && !res.etablissements?.length && !res.soignants?.length &&
    !res.transporteurs?.length && !res.demandes?.length;

  const SERVICES_LIB = { transport: "Transport", domicile: "Domicile", medicaments: "Médicaments" };

  return (
    <div className="adm-recherche" ref={ref}>
      <input
        type="search"
        placeholder="Rechercher partout : nom, téléphone, email, n° de demande…"
        value={q}
        onChange={(e) => chercher(e.target.value)}
        onFocus={() => res && setOuvert(true)}
      />
      {ouvert && res && (
        <div className="adm-recherche-resultats">
          {vide && <p className="adm-vide">Aucun résultat.</p>}
          {res.clients?.length > 0 && (
            <>
              <div className="adm-rech-groupe">👤 Patients</div>
              {res.clients.map((c) => (
                <button key={c.id} onClick={() => aller(`/admin/clients`)}>
                  <strong>{[c.prenom, c.nom].filter(Boolean).join(" ") || "Sans nom"}</strong>
                  <small>{c.telephone || c.email || "—"}{c.commune ? ` · ${c.commune}` : ""}</small>
                </button>
              ))}
            </>
          )}
          {res.etablissements?.length > 0 && (
            <>
              <div className="adm-rech-groupe">🏥 Établissements</div>
              {res.etablissements.map((c) => (
                <button key={c.id} onClick={() => aller(`/admin/clients`)}>
                  <strong>{c.etablissement || [c.prenom, c.nom].filter(Boolean).join(" ")}</strong>
                  <small>{c.telephone || c.email || "—"}</small>
                </button>
              ))}
            </>
          )}
          {res.soignants?.length > 0 && (
            <>
              <div className="adm-rech-groupe">🩺 Soignants</div>
              {res.soignants.map((s) => (
                <button key={s.id} onClick={() => aller(`/admin/soignants`)}>
                  <strong>{s.prenom} {s.nom}</strong>
                  <small>{s.telephone || "—"} · {s.statut}</small>
                </button>
              ))}
            </>
          )}
          {res.transporteurs?.length > 0 && (
            <>
              <div className="adm-rech-groupe">🚑 Transporteurs</div>
              {res.transporteurs.map((s) => (
                <button key={s.id} onClick={() => aller(`/admin/transporteurs`)}>
                  <strong>{s.nom}</strong>
                  <small>{s.telephone || "—"} · {s.statut}</small>
                </button>
              ))}
            </>
          )}
          {res.demandes?.length > 0 && (
            <>
              <div className="adm-rech-groupe">📅 Demandes</div>
              {res.demandes.map((d) => (
                <button key={d.id} onClick={() => aller(`/admin/demandes?id=${d.id}`)}>
                  <strong>n°{d.id} · {SERVICES_LIB[d.service] || d.service}</strong>
                  <small>{d.nom || d.telephone} · {(d.date || "").replace("T", " à ")} · {d.statut}</small>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Menu « + Créer » ----
function MenuCreer({ role }) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);
  const routeur = useRouter();
  useEffect(() => {
    const fermer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOuvert(false);
    };
    document.addEventListener("pointerdown", fermer);
    return () => document.removeEventListener("pointerdown", fermer);
  }, []);
  const entrees = CREER.filter((c) => c.roles.includes(role));
  if (!entrees.length) return null;
  return (
    <div className="adm-creer" ref={ref}>
      <button className="adm-btn" onClick={() => setOuvert(!ouvert)}>
        <IcoPlus /> Créer
      </button>
      {ouvert && (
        <div className="adm-creer-menu">
          {entrees.map((c) => (
            <button key={c.href + c.libelle} onClick={() => { setOuvert(false); routeur.push(c.href); }}>
              {c.libelle}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminLayout({ children }) {
  const { pret, autorise, role, nom } = useGardeAdmin();
  const { seDeconnecter } = useAsm();
  const chemin = usePathname();
  const routeur = useRouter();

  if (!pret) {
    return (
      <div className="adm-page">
        <p className="adm-vide" style={{ padding: 40 }}>
          Vérification de l&apos;accès…
        </p>
      </div>
    );
  }

  if (!autorise) {
    return (
      <div className="adm-page">
        <div className="adm-refus">
          <h1>Espace réservé à l&apos;équipe ASM</h1>
          <p>
            Cette zone est réservée aux administrateurs et modérateurs. Si vous êtes membre de
            l&apos;équipe, demandez à l&apos;administrateur de vous donner accès.
          </p>
          <Link className="adm-btn" href="/connexion">
            Se connecter
          </Link>
          <Link className="adm-btn secondaire" href="/accueil" style={{ marginTop: 10 }}>
            Retour au site
          </Link>
        </div>
      </div>
    );
  }

  const actif = (href) => chemin === href.split("?")[0] && !href.includes("?");
  const deconnecter = async () => {
    await seDeconnecter();
    routeur.replace("/connexion?mode=identifiant");
  };

  return (
    <div className="adm-page avec-tabbar">
      {/* ---- En-tête MOBILE (inchangé) ---- */}
      <header className="adm-entete adm-mobile-seul">
        <strong>ASM — Administration</strong>
        <span className="adm-role">{LIBELLE_ROLE[role] || role}</span>
      </header>

      {/* ---- En-tête DESKTOP : Centre de gestion ---- */}
      <header className="adm-entete-desktop">
        <Link className="adm-marque" href="/admin">
          <Image src="/logo-asm.jpg" alt="ASM" width={34} height={34} style={{ borderRadius: "50%" }} />
          <span>ASM · Centre de gestion</span>
        </Link>
        <RechercheGlobale />
        <MenuCreer role={role} />
        <div className="adm-entete-droite">
          <span className="adm-qui">
            <strong>{nom || "Équipe ASM"}</strong>
            <small>{LIBELLE_ROLE[role] || role}</small>
          </span>
          <Link className="adm-lien-site" href="/accueil">Voir le site</Link>
          <button className="adm-deco-btn" onClick={deconnecter} title="Se déconnecter">
            <IcoSortie />
          </button>
        </div>
      </header>

      <div className="adm-corps">
        {/* ---- Navigation latérale DESKTOP ---- */}
        <aside className="adm-sidebar">
          {GROUPES.map((g) => {
            const liens = g.liens.filter((l) => l.roles.includes(role));
            if (!liens.length) return null;
            return (
              <div className="adm-side-groupe" key={g.titre}>
                <div className="adm-side-titre">{g.titre}</div>
                {liens.map((l) => (
                  <Link key={l.href + l.libelle} href={l.href} className={actif(l.href) ? "actif" : ""}>
                    {l.Ico ? <l.Ico /> : <span className="adm-side-puce" />}
                    <span>{l.libelle}</span>
                  </Link>
                ))}
              </div>
            );
          })}
        </aside>

        <main className="adm-contenu">{children}</main>
      </div>

      {/* ---- Barre du bas MOBILE (inchangée) ---- */}
      <nav className="adm-tabbar" aria-label="Sections d'administration">
        {ONGLETS.map(({ href, libelle, Ico }) => (
          <Link key={href} href={href} className={chemin === href ? "actif" : ""}>
            <Ico />
            <span>{libelle}</span>
          </Link>
        ))}
        <Link href="/accueil" className="adm-tab-retour">
          <IcoSortie />
          <span>Site</span>
        </Link>
      </nav>
    </div>
  );
}
