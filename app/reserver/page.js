"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";
import { ecrireParcours, viderParcours } from "@/app/components/parcours";
import { IcoVehicule, IcoMaison, IcoMedicaments } from "@/app/components/icones";

// Point d'entrée du parcours.
//
// Deux questions avant tout le reste : POUR QUI, puis QUELLE PRESTATION.
//
// « Pour qui » vient en premier parce qu'il change le reste : un
// établissement qui réserve pour un patient rattaché engage sa procuration,
// et c'est le numéro du patient — pas celui du compte — qui doit suivre la
// demande. Poser la question à la fin obligerait à revenir en arrière.
const SERVICES = [
  { cle: "transport", Ico: IcoVehicule, titre: "s_transport", detail: "s_transport_d" },
  { cle: "domicile", Ico: IcoMaison, titre: "s_domicile", detail: "s_domicile_d" },
  { cle: "medicaments", Ico: IcoMedicaments, titre: "s_medic", detail: "s_medic_d" },
];

export default function ChoixService() {
  const { t, connecte, espaceChoisi } = useAsm();
  const routeur = useRouter();

  const [rattaches, setRattaches] = useState([]);
  const [pourPatient, setPourPatient] = useState(null);
  const [pack, setPack] = useState(null);

  // Nouvelle demande : on repart d'une feuille blanche. Les réponses d'une
  // demande précédente n'ont rien à faire dans celle-ci.
  useEffect(() => {
    viderParcours();
  }, []);

  // Patient et pack posés par un autre écran (espace pro, cercle familial,
  // page des packs) : on les reprend, puis on efface le dépôt — sinon ils
  // se rappliqueraient à la demande suivante.
  useEffect(() => {
    try {
      const p = sessionStorage.getItem("asm_pour_patient");
      if (p) {
        const v = JSON.parse(p);
        setPourPatient(v);
        ecrireParcours({ pourPatient: v.tel, pourPatientNom: v.nom, telephone: v.tel });
        sessionStorage.removeItem("asm_pour_patient");
      }
      const k = sessionStorage.getItem("asm_pack");
      if (k) {
        const v = JSON.parse(k);
        setPack(v);
        ecrireParcours({ packId: v.id, packNom: v.nom, packPrix: v.prix });
        sessionStorage.removeItem("asm_pack");
      }
    } catch {}
  }, []);

  // Personnes pour lesquelles ce compte peut réserver : proches du cercle
  // familial côté patient, patients rattachés côté établissement. Les deux
  // reposent sur une procuration ACCEPTE et non expirée — le serveur la
  // revérifie de toute façon à l'enregistrement.
  useEffect(() => {
    if (!connecte) return;
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const entetes = { Authorization: `Bearer ${session.access_token}` };
        const route = espaceChoisi === "pro" ? "/api/pro/rattachements" : "/api/proches";
        const r = await fetch(route, { headers: entetes });
        const d = await r.json();
        // Les deux routes ne disent pas l'expiration de la même façon :
        // le cercle familial renvoie un booléen déjà calculé, l'espace pro
        // la date brute. On refuse dans les deux cas.
        const liste = d.rattachements || d.proches || [];
        setRattaches(
          liste.filter(
            (x) =>
              x.statut === "ACCEPTE" &&
              !x.expiree &&
              (!x.expiration || new Date(x.expiration).getTime() > Date.now())
          )
        );
      } catch {}
    })();
  }, [connecte, espaceChoisi]);

  function choisirPatient(r) {
    if (!r) {
      setPourPatient(null);
      ecrireParcours({ pourPatient: "", pourPatientNom: "", telephone: "" });
      return;
    }
    const v = { tel: r.patientTel, nom: r.patientNom || r.patientTel };
    setPourPatient(v);
    ecrireParcours({ pourPatient: v.tel, pourPatientNom: v.nom, telephone: v.tel });
  }

  function choisir(service) {
    ecrireParcours({ service });
    routeur.push(`/reserver/${service}/besoin`);
  }

  return (
    <div className="page">
      <div className="contenu-page">
        {pourPatient && (
          <div className="bandeau-info pc-bandeau">
            <span>👤 {t("pp_bandeau")} <strong>{pourPatient.nom}</strong></span>
            <button type="button" className="pc-lien" onClick={() => choisirPatient(null)}>
              {t("annuler")}
            </button>
          </div>
        )}

        {pack && (
          <div className="bandeau-info pc-bandeau">
            <span>🎁 {t("pk_bandeau")} <strong>{pack.nom}</strong> — {pack.prix} DZD</span>
          </div>
        )}

        {/* Le choix n'apparaît que s'il y a un choix à faire : un compte sans
            aucun rattachement n'a pas besoin de répondre « pour moi ». */}
        {!pourPatient && rattaches.length > 0 && (
          <div className="champ">
            <label>{t("pr_pour_qui")}</label>
            <div className="chips">
              <button type="button" className="chip actif">{t("pr_moi")}</button>
              {rattaches.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className="chip"
                  onClick={() => choisirPatient(r)}
                >
                  {r.patientNom || r.patientTel}
                </button>
              ))}
            </div>
          </div>
        )}

        <h2 className="titre-page">{t("pc_service_q")}</h2>

        <div className="pc-choix">
          {SERVICES.map((s) => (
            <button className="pc-carte" key={s.cle} onClick={() => choisir(s.cle)}>
              <span className="ico-service" aria-hidden="true">
                <s.Ico />
              </span>
              <span>
                <strong>{t(s.titre)}</strong>
                <small>{t(s.detail)}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
