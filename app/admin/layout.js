"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGardeAdmin, LIBELLE_ROLE } from "./ui";

// Enveloppe de l'espace admin : garde d'accès (rôles internes uniquement)
// + navigation latérale (bandeau déroulant sur mobile).
const SECTIONS = [
  { href: "/admin", libelle: "Tableau de bord" },
  { href: "/admin/demandes", libelle: "Demandes & RDV" },
  { href: "/admin/clients", libelle: "Clients" },
  { href: "/admin/soignants", libelle: "Soignants" },
  { href: "/admin/transporteurs", libelle: "Transporteurs" },
  { href: "/admin/equipe", libelle: "Équipe & journal" },
  { href: "/admin/reglages", libelle: "Réglages" },
];

export default function AdminLayout({ children }) {
  const { pret, autorise, role } = useGardeAdmin();
  const chemin = usePathname();
  const routeur = useRouter();
  const [menuOuvert, setMenuOuvert] = useState(false);

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
    // Pas un compte interne → retour connexion, sans fuite d'information.
    if (typeof window !== "undefined") routeur.replace("/connexion");
    return null;
  }

  return (
    <div className="adm-page">
      <header className="adm-entete">
        <button className="adm-burger" onClick={() => setMenuOuvert((o) => !o)} aria-label="Menu">
          ☰
        </button>
        <strong>ASM — Administration</strong>
        <span className="adm-role">{LIBELLE_ROLE[role] || role}</span>
      </header>
      <div className="adm-corps">
        <nav className={"adm-nav" + (menuOuvert ? " ouvert" : "")}>
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={chemin === s.href ? "actif" : ""}
              onClick={() => setMenuOuvert(false)}
            >
              {s.libelle}
            </Link>
          ))}
          <Link href="/accueil" className="adm-retour-site">
            ← Retour au site
          </Link>
        </nav>
        <main className="adm-contenu">{children}</main>
      </div>
    </div>
  );
}
