"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGardeAdmin, LIBELLE_ROLE } from "./ui";
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
} from "@/app/components/icones";

// Onglets de l'espace admin — barre du bas tactile (comme le site),
// défilable horizontalement sur mobile. Chaque onglet = une section.
const ONGLETS = [
  { href: "/admin", libelle: "Bord", Ico: IcoDocumentLignes },
  { href: "/admin/demandes", libelle: "Demandes", Ico: IcoCalendrier },
  { href: "/admin/messages", libelle: "Messages", Ico: IcoBulle },
  { href: "/admin/clients", libelle: "Clients", Ico: IcoPersonne },
  { href: "/admin/soignants", libelle: "Soignants", Ico: IcoMaison },
  { href: "/admin/transporteurs", libelle: "Transport", Ico: IcoVehicule },
  { href: "/admin/equipe", libelle: "Équipe", Ico: IcoEtablissement },
  { href: "/admin/reglages", libelle: "Réglages", Ico: IcoReglages },
];

export default function AdminLayout({ children }) {
  const { pret, autorise, role } = useGardeAdmin();
  const chemin = usePathname();

  if (!pret) {
    return (
      <div className="adm-page">
        <p className="adm-vide" style={{ padding: 40 }}>
          Vérification de l&apos;accès…
        </p>
      </div>
    );
  }

  // Accès refusé : message clair (plutôt qu'une redirection silencieuse),
  // pour qu'un membre sache que l'espace existe et comment y accéder.
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

  const actif = (href) => chemin === href;

  return (
    <div className="adm-page avec-tabbar">
      <header className="adm-entete">
        <strong>ASM — Administration</strong>
        <span className="adm-role">{LIBELLE_ROLE[role] || role}</span>
      </header>

      <main className="adm-contenu">{children}</main>

      <nav className="adm-tabbar" aria-label="Sections d'administration">
        {ONGLETS.map(({ href, libelle, Ico }) => (
          <Link key={href} href={href} className={actif(href) ? "actif" : ""}>
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
