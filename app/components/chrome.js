"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";
import {
  IcoTelephone,
  IcoCalendrier,
  IcoBulle,
  IcoPlus,
  IcoDocumentLignes,
  IcoPersonne,
  IcoReglages,
  IcoSortie,
} from "@/app/components/icones";

export function BandeauAppel() {
  const { t } = useAsm();
  return (
    <div className="bandeau-info">
      <IcoTelephone />
      <span>{t("aide")}</span> <a href={TEL_LIEN}>{TEL_AFFICHE}</a> ·{" "}
      <span>{t("sept")}</span>
    </div>
  );
}

// Menu utilisateur (roue de réglages) — visible uniquement connecté.
// Déroulant : Mon compte / Mes demandes / Déconnexion. Se ferme au clic
// extérieur et après chaque action ; utilisable au doigt sur mobile.
function MenuUtilisateur() {
  const { t, compteType, seDeconnecter } = useAsm();
  const routeur = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOuvert(false);
    };
    document.addEventListener("pointerdown", fermer);
    return () => document.removeEventListener("pointerdown", fermer);
  }, [ouvert]);

  const aller = (chemin) => {
    setOuvert(false);
    routeur.push(chemin);
  };

  const deconnecter = async () => {
    if (!window.confirm(t("deco_conf"))) return;
    setOuvert(false);
    await seDeconnecter();
    routeur.push("/accueil");
  };

  return (
    <div className="menu-user" ref={ref}>
      <button
        className="btn-reglages"
        aria-label={t("menu_compte")}
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
      >
        <IcoReglages />
      </button>
      {ouvert && (
        <div className="menu-user-liste" role="menu">
          <button role="menuitem" onClick={() => aller("/compte")}>
            <IcoPersonne /> {t("menu_compte")}
          </button>
          <button role="menuitem" onClick={() => aller(compteType === "pro" ? "/pro" : "/tableau")}>
            <IcoCalendrier /> {t("menu_demandes")}
          </button>
          <button role="menuitem" className="menu-deco" onClick={deconnecter}>
            <IcoSortie /> {t("menu_deconnexion")}
          </button>
        </div>
      )}
    </div>
  );
}

export function EnTete() {
  const { t, langue, setLangue, espaceChoisi, connecte } = useAsm();
  return (
    <header className="principal">
      <div className="header-inner">
        <Link className="marque" href={espaceChoisi === "pro" ? "/pro" : "/accueil"}>
          <span className="logo-rond" aria-hidden="true">
            <Image
              className="logo-img"
              src="/logo-asm.jpg"
              alt="Logo ASM"
              width={42}
              height={42}
            />
          </span>
          <strong>ASM</strong>
          {espaceChoisi === "pro" && (
            <span className="badge-pro" title={t("esp_pro")}>
              {t("badge_pro")}
            </span>
          )}
        </Link>
        <div className="header-droite">
          <Link className="lien-connaitre" href="/connaitre">
            {t("connaitre")}
          </Link>
          <div className="lang-toggle" role="group" aria-label="Langue">
            <button
              className={langue === "fr" ? "actif" : ""}
              onClick={() => setLangue("fr")}
            >
              FR
            </button>
            <button
              className={langue === "ar" ? "actif" : ""}
              onClick={() => setLangue("ar")}
            >
              ع
            </button>
          </div>
          {connecte && <MenuUtilisateur />}
        </div>
      </div>
    </header>
  );
}

export function BarreNav() {
  const { t, connecte, compteType } = useAsm();
  const chemin = usePathname();
  const routeur = useRouter();

  const allerCompte = () => {
    if (connecte) routeur.push("/compte");
    else routeur.push("/connexion");
  };

  const actif = (routes) => routes.some((r) => chemin === r || chemin.startsWith(r + "/"));

  return (
    <nav className="barre" aria-label="Navigation principale">
      <button
        className={actif(["/tableau", "/pro", "/suivi"]) ? "actif" : ""}
        onClick={() => routeur.push(compteType === "pro" && connecte ? "/pro" : "/tableau")}
        aria-label={t("nav_rdv")}
        title={t("nav_rdv")}
      >
        <IcoCalendrier />
      </button>
      <button
        className={actif(["/messagerie"]) ? "actif" : ""}
        onClick={() => routeur.push("/messagerie")}
        aria-label={t("nav_msg")}
        title={t("nav_msg")}
      >
        <IcoBulle strokeWidth="1.9" />
      </button>
      <button
        className={"btn-accueil" + (actif(["/accueil", "/rdv"]) ? " actif" : "")}
        onClick={() => routeur.push("/accueil")}
        aria-label={t("nav_accueil")}
        title={t("nav_accueil")}
      >
        <span className="croix" aria-hidden="true">
          <IcoPlus />
        </span>
      </button>
      <button
        className={actif(["/documentation"]) ? "actif" : ""}
        onClick={() => routeur.push("/documentation")}
        aria-label={t("nav_doc")}
        title={t("nav_doc")}
      >
        <IcoDocumentLignes strokeWidth="1.9" />
      </button>
      <button
        className={actif(["/connexion", "/role", "/inscription", "/compte"]) ? "actif" : ""}
        onClick={allerCompte}
        aria-label={t("nav_compte")}
        title={t("nav_compte")}
      >
        <IcoPersonne strokeWidth="1.9" />
      </button>
    </nav>
  );
}

export function PiedDePage() {
  return (
    <footer>
      ASM — Bir Mourad Raïs, Alger · <a href={TEL_LIEN}>{TEL_AFFICHE}</a>
    </footer>
  );
}

// Enveloppe : la page de démarrage (/) et le back-office (/equipe)
// n'affichent ni la barre inférieure ni l'assistant.
// L'espace professionnel est teinté d'or (badge PRO + header) pour
// qu'on ne le confonde jamais avec l'espace patient.
export function Habillage({ children, assistant }) {
  const chemin = usePathname();
  const { espaceChoisi } = useAsm();
  // L'espace admin a son propre habillage complet.
  if (chemin.startsWith("/admin")) return children;
  const nu = chemin === "/" || chemin.startsWith("/equipe");
  const modePro = espaceChoisi === "pro" && chemin !== "/";
  return (
    <div className={modePro ? "mode-pro" : ""}>
      <BandeauAppel />
      <EnTete />
      <main className={nu ? "" : "avec-barre"}>{children}</main>
      {!nu && <PiedDePage />}
      {!nu && <BarreNav />}
      {!nu && assistant}
    </div>
  );
}
