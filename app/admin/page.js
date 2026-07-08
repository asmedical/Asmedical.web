"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAdmin, Pastille, SERVICES } from "./ui";

export default function TableauDeBordAdmin() {
  const [stats, setStats] = useState(null);
  const [erreur, setErreur] = useState("");

  async function charger() {
    try {
      setStats(await fetchAdmin("/api/admin/stats"));
    } catch {
      setErreur("Impossible de charger les statistiques.");
    }
  }
  useEffect(() => {
    charger();
    const minuteur = setInterval(charger, 60000); // rafraîchi chaque minute
    return () => clearInterval(minuteur);
  }, []);

  if (erreur) return <p className="adm-vide">{erreur}</p>;
  if (!stats) return <p className="adm-vide">Chargement…</p>;

  // Alertes = ce qui demande une action. Rouge dès qu'il y en a.
  const alertes = [
    { l: "À rappeler", v: stats.aRappeler, href: "/admin/demandes?statut=A_RAPPELER" },
    { l: "En retard", v: stats.enRetard, href: "/admin/demandes?supervision=en_retard" },
    { l: "Non confirmées", v: stats.nonConfirmees, href: "/admin/demandes?supervision=non_confirmee" },
    { l: "Problèmes signalés", v: stats.problemes, href: "/admin/demandes?supervision=probleme" },
    { l: "Soignants à valider", v: stats.soignantsAttente, href: "/admin/soignants" },
    { l: "Transporteurs à valider", v: stats.transporteursAttente, href: "/admin/transporteurs" },
    { l: "Messages non lus", v: stats.messagesNonLus ?? 0, href: "/admin/messages" },
  ].filter((c) => c.v > 0);

  const jour = [
    { l: "RDV aujourd'hui", v: stats.duJour, href: "/admin/demandes?jour=auj" },
    { l: "En cours", v: stats.enCours, href: "/admin/demandes?statut=EN_COURS" },
    { l: "Urgents / prioritaires", v: stats.prioritaires, href: "/admin/demandes", alerte: stats.prioritaires > 0 },
  ];

  const ensemble = [
    { l: "Clients inscrits", v: stats.clients ?? "—", href: "/admin/clients" },
    { l: "Soignants actifs", v: stats.soignantsActifs, href: "/admin/soignants" },
    { l: "Transporteurs actifs", v: stats.transporteursActifs, href: "/admin/transporteurs" },
    { l: "Comptes employés", v: stats.comptesEmployes, href: "/admin/soignants" },
    { l: "Abonnements actifs", v: stats.abonnementsActifs, href: "/admin/demandes" },
  ];

  return (
    <>
      <h1 className="adm-titre">Tableau de bord</h1>

      {/* Alertes à traiter — n'apparaissent que s'il y en a */}
      {alertes.length > 0 ? (
        <>
          <h2 className="adm-sous-titre">⚠️ À traiter</h2>
          <div className="adm-cartes">
            {alertes.map((c) => (
              <Link className="adm-carte alerte" href={c.href} key={c.l}>
                <strong>{c.v}</strong>
                <span>{c.l}</span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="adm-tout-ok">✅ Tout est à jour — aucune action en attente.</div>
      )}

      <h2 className="adm-sous-titre">Aujourd&apos;hui</h2>
      <div className="adm-cartes">
        {jour.map((c) => (
          <Link className={"adm-carte" + (c.alerte ? " alerte" : "")} href={c.href} key={c.l}>
            <strong>{c.v}</strong>
            <span>{c.l}</span>
          </Link>
        ))}
      </div>

      <h2 className="adm-sous-titre">Vue d&apos;ensemble</h2>
      <div className="adm-cartes">
        {ensemble.map((c) => (
          <Link className="adm-carte" href={c.href} key={c.l}>
            <strong>{c.v}</strong>
            <span>{c.l}</span>
          </Link>
        ))}
      </div>

      <h2 className="adm-sous-titre">Dernières demandes</h2>
      {stats.dernieres.length === 0 && <p className="adm-vide">Aucune demande pour l&apos;instant.</p>}
      <div className="adm-liste">
        {stats.dernieres.map((d) => (
          <Link className="adm-ligne" href={`/admin/demandes?id=${d.id}`} key={d.id}>
            <span>
              <strong>n°{d.id} · {SERVICES[d.service] || d.service}</strong>
              <small>{d.nom || d.telephone} · {d.date?.replace("T", " à ")}</small>
            </span>
            <Pastille statut={d.statut} />
          </Link>
        ))}
      </div>
    </>
  );
}
