"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { supabase } from "@/lib/supabase";

// Abonnements ASM — page publique. Les plans sont administrés dans
// Admin → Finances → Abonnements ; la souscription crée une facture de
// première période, payée via le circuit existant, et l'abonnement ne
// s'active QU'À la réception du paiement.

const LIB_SERVICE = { transport: "s_transport", domicile: "s_domicile", medicaments: "s_medic" };

export default function Abonnements() {
  const { t, langue, connecte } = useAsm();
  const routeur = useRouter();
  const [donnees, setDonnees] = useState(null);
  const [msg, setMsg] = useState("");
  const [occupe, setOccupe] = useState(0);

  async function charger() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/plans", {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      setDonnees(r.ok ? await r.json() : { plans: [] });
    } catch {
      setDonnees({ plans: [] });
    }
  }
  useEffect(() => { charger(); }, []);

  async function souscrire(plan) {
    setMsg("");
    if (!connecte) return routeur.push("/connexion?gate=1");
    setOccupe(plan.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ planId: plan.id }),
      });
      if (!r.ok) throw new Error();
      setMsg(t("abo_souscrit_ok"));
      await charger();
    } catch {
      setMsg(t("abo_err"));
    }
    setOccupe(0);
  }

  const nomPlan = (p) => (langue === "ar" && p.nomAr ? p.nomAr : p.nom);
  const descPlan = (p) => (langue === "ar" && p.descriptionAr ? p.descriptionAr : p.description);

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 640 }}>
        <Link className="btn-retour" href="/accueil">{t("retour")}</Link>
        <h2 className="titre-page">{t("abo_t2")}</h2>
        <p className="sous-page">{t("abo_s2")}</p>

        {donnees === null && <p className="sous-page">{t("compte_charge")}</p>}
        {donnees?.plans?.length === 0 && <div className="etat-vide"><p>{t("cloche_vide")}</p></div>}

        {/* Ma situation actuelle */}
        {donnees?.mienne && (
          <div className="pay-carte abonne" style={{ marginBottom: 14 }}>
            <strong>⭐ {t("abo_actif_t")} : {donnees.mienne.plan}</strong>
            {donnees.mienne.statut === "EN_ATTENTE_PAIEMENT" ? (
              <>
                <p>{t("abo_attente_paiement")}</p>
                <Link className="btn-action" href="/compte/paiements">{t("abo_payer_facture")}</Link>
              </>
            ) : (
              donnees.mienne.fin && <p>{t("aut_expire")} {donnees.mienne.fin}</p>
            )}
          </div>
        )}

        {donnees?.plans?.map((p) => (
          <div className={"abo-carte" + (p.populaire ? " populaire" : "")} key={p.id}>
            {p.populaire && <span className="abo-badge">{t("abo_populaire")}</span>}
            <div className="abo-tete">
              <strong>{nomPlan(p)}</strong>
              <span className="abo-prix">
                {Number(p.prix).toLocaleString("fr-FR")} DZD
                <small>{p.frequence === "annuel" ? t("abo_prix_an") : t("abo_prix_mois")}</small>
              </span>
            </div>
            {descPlan(p) && <p className="abo-desc">{descPlan(p)}</p>}
            <ul className="abo-points">
              <li>
                {p.quantiteIncluse ? `${p.quantiteIncluse} ${t("abo_inclus")}` : t("abo_illimite")}
                {" · "}
                {p.service ? t(LIB_SERVICE[p.service] || "s_transport") : t("abo_tous_services")}
              </li>
              {p.reductionPct > 0 && <li>−{p.reductionPct} % {t("abo_reduc")}</li>}
            </ul>
            <button
              className="btn-action"
              disabled={occupe === p.id || donnees?.mienne?.planId === p.id}
              onClick={() => souscrire(p)}
            >
              {donnees?.mienne?.planId === p.id ? "✓" : connecte ? t("abo_souscrire") : t("abo_connexion")}
            </button>
          </div>
        ))}

        {msg && <p className="adm-msg" style={{ marginTop: 12 }}>{msg}</p>}
      </div>
    </div>
  );
}
