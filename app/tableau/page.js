"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { chargerMesDemandes, supabase } from "@/lib/supabase";

// Rappel discret des paiements dus (disparaît une fois réglé).
function BulleFinances({ t }) {
  const [resume, setResume] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const r = await fetch("/api/finances/moi", { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (r.ok) setResume((await r.json()).resume);
      } catch {}
    })();
  }, []);
  if (!resume || resume.duTotal <= 0) return null;
  const retard = resume.enRetard > 0;
  return (
    <Link href="/compte/paiements" className={"fin-bulle" + (retard ? " ko" : "")} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
      <strong>{retard ? t("pf_retard_t") : t("pf_du_t")}</strong>
      <span>{(retard ? resume.enRetard : resume.duTotal).toLocaleString("fr-FR")} DZD — {t("pf_payer")} →</span>
    </Link>
  );
}
import { IcoVehicule, IcoMaison, IcoMedicaments } from "@/app/components/icones";

const ICONES = { transport: IcoVehicule, domicile: IcoMaison, medicaments: IcoMedicaments };
const CLES_SERVICE = { transport: "s_transport", domicile: "s_domicile", medicaments: "s_medic" };

// Étiquette de statut lisible pour le patient (à partir du statut réel).
function badge(statut, t) {
  if (statut === "TERMINEE") return { txt: t("st_terminee"), cls: "" };
  if (statut === "ANNULEE") return { txt: t("st_annulee"), cls: "" };
  if (statut === "CONFIRMEE") return { txt: t("st_confirmee"), cls: "verte" };
  if (statut === "AFFECTEE") return { txt: t("st_affectee"), cls: "verte" };
  if (statut === "EN_COURS") return { txt: t("st_encours"), cls: "verte" };
  return { txt: t("st_a_rappeler"), cls: "" };
}

// Tableau de bord patient : ses VRAIES demandes (depuis la base), rien d'autre.
export default function Tableau() {
  const { t } = useAsm();
  const routeur = useRouter();
  const [demandes, setDemandes] = useState(null);

  // Garde d'espace : un compte ÉTABLISSEMENT est renvoyé vers /pro.
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const { utilisateurCourant, chargerProfil } = await import("@/lib/supabase");
        const u = await utilisateurCourant();
        if (!u || annule) return;
        const p = await chargerProfil(u.id);
        if (!annule && p?.role === "pro") routeur.replace("/pro");
      } catch {}
    })();
    return () => {
      annule = true;
    };
  }, [routeur]);

  useEffect(() => {
    chargerMesDemandes()
      .then(setDemandes)
      .catch(() => setDemandes([]));
  }, []);

  return (
    <div className="page">
      <div className="contenu-page">
        <div className="bienvenue">
          <strong>{t("bonjour")}</strong>
          <p>{t("bienvenue_p")}</p>
        </div>

        <BulleFinances t={t} />

        {demandes === null && <p className="sous-page">{t("compte_charge")}</p>}

        {demandes && demandes.length === 0 && (
          <div className="etat-vide">
            <p>{t("tableau_vide")}</p>
          </div>
        )}

        {demandes &&
          demandes.map((d) => {
            const Icone = ICONES[d.service] || IcoVehicule;
            const b = badge(d.statut, t);
            return (
              <Link
                className="item-liste"
                href={`/suivi?id=${d.id}`}
                key={d.id}
                style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}
              >
                <span className="ico-service">
                  <Icone />
                </span>
                <span>
                  <strong>{t(CLES_SERVICE[d.service] || "s_transport")}</strong>
                  <small>
                    {d.date ? d.date.replace("T", " · ") : "—"}
                    {d.destination ? ` · ${d.destination}` : ""}
                  </small>
                </span>
                <span className={"pastille" + (b.cls ? " " + b.cls : "")}>{b.txt}</span>
              </Link>
            );
          })}

        <Link className="btn-action" style={{ marginTop: 8 }} href="/accueil">
          {t("nouvelle")}
        </Link>
      </div>
    </div>
  );
}
