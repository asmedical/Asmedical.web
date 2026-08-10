"use client";
import { useEffect, useState } from "react";
import { useAsm } from "@/app/providers";
import { ecrireParcours } from "@/app/components/parcours";

// « Pour qui est cette réservation ? »
//
// Un compte peut réserver pour quelqu'un d'autre : un proche du cercle
// familial, ou un patient rattaché quand c'est un établissement. La question
// se pose AVANT tout le reste, parce qu'elle change la suite — c'est le
// numéro du patient, pas celui du compte, qui doit suivre la demande.
//
// Ce bloc reprend aussi le patient et le pack déposés par un autre écran
// (espace pro, cercle familial, page des packs), puis efface le dépôt :
// sinon ils se rappliqueraient à la demande suivante.
export default function PourQui() {
  const { t, connecte, espaceChoisi } = useAsm();
  const [rattaches, setRattaches] = useState([]);
  const [pourPatient, setPourPatient] = useState(null);
  const [pack, setPack] = useState(null);

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

  useEffect(() => {
    if (!connecte) return;
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const route = espaceChoisi === "pro" ? "/api/pro/rattachements" : "/api/proches";
        const r = await fetch(route, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const d = await r.json();
        // Les deux routes ne disent pas l'expiration de la même façon : le
        // cercle familial renvoie un booléen déjà calculé, l'espace pro la
        // date brute. On refuse dans les deux cas — le serveur revalide de
        // toute façon la procuration à l'enregistrement.
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

  function choisir(r) {
    if (!r) {
      setPourPatient(null);
      ecrireParcours({ pourPatient: "", pourPatientNom: "", telephone: "" });
      return;
    }
    const v = { tel: r.patientTel, nom: r.patientNom || r.patientTel };
    setPourPatient(v);
    ecrireParcours({ pourPatient: v.tel, pourPatientNom: v.nom, telephone: v.tel });
  }

  if (!pourPatient && !pack && rattaches.length === 0) return null;

  return (
    <>
      {pourPatient && (
        <div className="bandeau-info pc-bandeau">
          <span>👤 {t("pp_bandeau")} <strong>{pourPatient.nom}</strong></span>
          <button type="button" className="pc-lien" onClick={() => choisir(null)}>{t("annuler")}</button>
        </div>
      )}

      {pack && (
        <div className="bandeau-info pc-bandeau">
          <span>🎁 {t("pk_bandeau")} <strong>{pack.nom}</strong> — {pack.prix} DZD</span>
        </div>
      )}

      {/* Le choix n'apparaît que s'il y a un choix à faire : un compte sans
          aucun rattachement n'a pas à répondre « pour moi ». */}
      {!pourPatient && rattaches.length > 0 && (
        <div className="champ">
          <label>{t("pr_pour_qui")}</label>
          <div className="chips">
            <button type="button" className="chip actif">{t("pr_moi")}</button>
            {rattaches.map((r) => (
              <button type="button" key={r.id} className="chip" onClick={() => choisir(r)}>
                {r.patientNom || r.patientTel}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
