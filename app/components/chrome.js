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
  IcoCloche,
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
  const { t, compteType, seDeconnecter, estInterne } = useAsm();
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
          {estInterne && (
            <button role="menuitem" className="menu-admin" onClick={() => aller("/admin")}>
              <IcoReglages /> {t("menu_admin")}
            </button>
          )}
          <button role="menuitem" className="menu-deco" onClick={deconnecter}>
            <IcoSortie /> {t("menu_deconnexion")}
          </button>
        </div>
      )}
    </div>
  );
}

// Cloche de notifications (en-tête) : badge + panneau déroulant avec les
// dernières notifications réelles et l'état du chat. Clic sur une entrée →
// ouverture directe dans la messagerie. Vraies données uniquement.
function Cloche() {
  const { t, nonLus } = useAsm();
  const routeur = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [liste, setListe] = useState(null); // null = pas encore chargé
  const [anime, setAnime] = useState(false);
  const ref = useRef(null);
  const precedent = useRef(0);

  const total = (nonLus?.notifs || 0) + (nonLus?.chat || 0);

  // Petite animation quand le nombre de non-lus augmente.
  useEffect(() => {
    if (total > precedent.current) {
      setAnime(true);
      const fin = setTimeout(() => setAnime(false), 1200);
      return () => clearTimeout(fin);
    }
    precedent.current = total;
  }, [total]);
  useEffect(() => {
    precedent.current = total;
  }, [total]);

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOuvert(false);
    };
    document.addEventListener("pointerdown", fermer);
    return () => document.removeEventListener("pointerdown", fermer);
  }, [ouvert]);

  async function basculer() {
    const prochain = !ouvert;
    setOuvert(prochain);
    if (prochain) {
      try {
        const { supabase } = await import("@/lib/supabase");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const r = await fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${session?.access_token || ""}` },
        });
        const d = r.ok ? await r.json() : { notifications: [] };
        setListe((d.notifications || []).slice(0, 5));
      } catch {
        setListe([]);
      }
    }
  }

  const aller = (chemin) => {
    setOuvert(false);
    routeur.push(chemin);
  };

  return (
    <div className="menu-user" ref={ref}>
      <button
        className={"btn-cloche" + (anime ? " sonne" : "")}
        aria-label={t("cloche_l")}
        aria-expanded={ouvert}
        onClick={basculer}
      >
        <IcoCloche />
        {total > 0 && <span className="badge-nonlu">{total > 99 ? "99+" : total}</span>}
      </button>

      {ouvert && (
        <div className="panneau-cloche" role="menu">
          <div className="panneau-cloche-titre">{t("cloche_l")}</div>

          {(nonLus?.chat || 0) > 0 && (
            <button className="cloche-item chat" onClick={() => aller("/messagerie?chat=1")}>
              <IcoBulle />
              <span>
                <strong>{t("cloche_chat_t")}</strong>
                <small>{t("cloche_chat_s")}</small>
              </span>
              <span className="badge-nonlu statique">{nonLus.chat}</span>
            </button>
          )}

          {liste === null && <p className="cloche-vide">…</p>}
          {liste?.length === 0 && (nonLus?.chat || 0) === 0 && (
            <p className="cloche-vide">{t("cloche_vide")}</p>
          )}
          {liste?.map((n) => (
            <button className="cloche-item" key={n.id} onClick={() => aller(`/messagerie?n=${n.id}`)}>
              <span className={"point-nonlu" + (n.statut === "NON_LU" ? "" : " lu")} aria-hidden="true" />
              <span>
                <strong>{n.titre}</strong>
                <small>
                  {new Date(n.creeLe).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                  {n.corps ? ` · ${n.corps.slice(0, 40)}${n.corps.length > 40 ? "…" : ""}` : ""}
                </small>
              </span>
            </button>
          ))}

          <button className="cloche-tout" onClick={() => aller("/messagerie")}>
            {t("cloche_tout")}
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
          {connecte && <Cloche />}
          {connecte && <MenuUtilisateur />}
        </div>
      </div>
    </header>
  );
}

export function BarreNav() {
  const { t, connecte, compteType, nonLus } = useAsm();
  const chemin = usePathname();
  const routeur = useRouter();
  const totalNonLus = (nonLus?.notifs || 0) + (nonLus?.chat || 0);

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
        style={{ position: "relative" }}
      >
        <IcoBulle strokeWidth="1.9" />
        {totalNonLus > 0 && <span className="badge-nonlu badge-nav">{totalNonLus > 99 ? "99+" : totalNonLus}</span>}
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
