"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAsm } from "@/app/providers";
import { supabase } from "@/lib/supabase";

// Tableau de bord de l'établissement : chiffres réels du mois, activité
// des 6 derniers mois, restant dû — et vue consolidée du groupe pour les
// enseignes multi-sites. Tout est calculé côté serveur (/api/pro/tableau).

const MOIS_COURT = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
const libMois = (m) => MOIS_COURT[Number(m.slice(5, 7)) - 1];

function Tuiles({ c, resteDu, t }) {
  return (
    <div className="pro-tuiles">
      <div className="pro-tuile"><b>{c.total}</b><span>{t("prd_demandes")}</span></div>
      <div className="pro-tuile"><b>{c.terminees}</b><span>{t("prd_terminees")}</span></div>
      <div className="pro-tuile"><b>{c.patients}</b><span>{t("prd_patients")}</span></div>
      <div className="pro-tuile"><b>{Number(resteDu || 0).toLocaleString("fr-FR")} DZD</b><span>{t("prd_du")}</span></div>
    </div>
  );
}

// Activité sur 6 mois — une seule série (le titre la nomme, pas de légende).
function MiniGraphe({ mois, t }) {
  const max = Math.max(1, ...mois.map((m) => m.demandes));
  return (
    <div className="pro-graphe" role="img" aria-label={t("prd_6mois")}>
      {mois.map((m) => (
        <div className="pro-graphe-col" key={m.mois} title={`${libMois(m.mois)} : ${m.demandes}`}>
          <div className="pro-graphe-barre" style={{ height: `${(m.demandes / max) * 100}%` }} />
          <small>{libMois(m.mois)}</small>
        </div>
      ))}
    </div>
  );
}

export default function TableauBordPro() {
  const { t } = useAsm();
  const [donnees, setDonnees] = useState(null);
  const [vue, setVue] = useState("moi"); // moi | groupe

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const r = await fetch("/api/pro/tableau", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (r.ok && !annule) setDonnees(await r.json());
      } catch {}
    })();
    return () => { annule = true; };
  }, []);

  if (!donnees?.stats) return null;
  const groupe = donnees.groupe;
  const s = vue === "groupe" && groupe ? groupe.stats : donnees.stats;

  return (
    <div className="pro-bord">
      <div className="pro-bord-tete">
        <strong>{t("prd_t")} — {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</strong>
        {groupe && (
          <div className="chips" style={{ margin: 0 }}>
            <button type="button" className={"chip" + (vue === "moi" ? " actif" : "")} onClick={() => setVue("moi")}>
              {t("prd_mon_site")}
            </button>
            <button type="button" className={"chip" + (vue === "groupe" ? " actif" : "")} onClick={() => setVue("groupe")}>
              🏢 {groupe.nom}
            </button>
          </div>
        )}
      </div>

      <Tuiles c={s.moisCourant} resteDu={s.resteDu} t={t} />
      <p className="pro-graphe-titre">{t("prd_6mois")}</p>
      <MiniGraphe mois={s.mois} t={t} />

      {vue === "groupe" && groupe && (
        <div className="pro-sites">
          {groupe.sites.map((site, i) => (
            <p key={i}>
              🏥 {site.nom}{site.moi ? ` (${t("prd_vous")})` : ""} — <b>{site.demandesMois}</b> {t("prd_demandes")}
            </p>
          ))}
        </div>
      )}

      <p className="lien-bas" style={{ textAlign: "start", marginTop: 10 }}>
        <Link href="/compte/paiements">{t("prd_factures")} →</Link>
      </p>
    </div>
  );
}
