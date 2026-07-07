"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAdmin, Pastille, SERVICES } from "./ui";

export default function TableauDeBordAdmin() {
  const [stats, setStats] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    fetchAdmin("/api/admin/stats")
      .then(setStats)
      .catch(() => setErreur("Impossible de charger les statistiques."));
  }, []);

  if (erreur) return <p className="adm-vide">{erreur}</p>;
  if (!stats) return <p className="adm-vide">Chargement…</p>;

  const cartes = [
    { libelle: "À rappeler", valeur: stats.aRappeler, href: "/admin/demandes?statut=A_RAPPELER", alerte: stats.aRappeler > 0 },
    { libelle: "RDV aujourd'hui", valeur: stats.duJour, href: "/admin/demandes?jour=auj" },
    { libelle: "Urgents / prioritaires", valeur: stats.prioritaires, href: "/admin/demandes", alerte: stats.prioritaires > 0 },
    { libelle: "Clients inscrits", valeur: stats.clients ?? "—", href: "/admin/clients" },
    { libelle: "Soignants à valider", valeur: stats.soignantsAttente, href: "/admin/soignants", alerte: stats.soignantsAttente > 0 },
    { libelle: "Transporteurs à valider", valeur: stats.transporteursAttente, href: "/admin/transporteurs", alerte: stats.transporteursAttente > 0 },
    { libelle: "Abonnements actifs", valeur: stats.abonnementsActifs, href: "/admin/demandes" },
  ];

  return (
    <>
      <h1 className="adm-titre">Tableau de bord</h1>
      <div className="adm-cartes">
        {cartes.map((c) => (
          <Link className={"adm-carte" + (c.alerte ? " alerte" : "")} href={c.href} key={c.libelle}>
            <strong>{c.valeur}</strong>
            <span>{c.libelle}</span>
          </Link>
        ))}
      </div>

      <h2 className="adm-sous-titre">Dernières demandes</h2>
      {stats.dernieres.length === 0 && <p className="adm-vide">Aucune demande pour l&apos;instant.</p>}
      <div className="adm-liste">
        {stats.dernieres.map((d) => (
          <Link className="adm-ligne" href={`/admin/demandes?id=${d.id}`} key={d.id}>
            <span>
              <strong>
                n°{d.id} · {SERVICES[d.service] || d.service}
              </strong>
              <small>
                {d.nom || d.telephone} · {d.date?.replace("T", " à ")}
              </small>
            </span>
            <Pastille statut={d.statut} />
          </Link>
        ))}
      </div>
    </>
  );
}
