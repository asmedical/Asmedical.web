"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAsm } from "@/app/providers";
import { supabase } from "@/lib/supabase";
import ChoixAppel from "@/app/components/appel";

// ÉCRAN DE PAIEMENT à la réservation. La situation (gratuit, déjà réglé,
// couvert par l'abonnement, à payer) est détectée CÔTÉ SERVEUR — cette
// page ne fait qu'afficher et déclencher. Aucune redirection de navigateur
// ne vaut confirmation : seuls les enregistrements serveur comptent.

async function jeton() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || "";
}

function DA(n) {
  return `${Number(n || 0).toLocaleString("fr-FR")} DZD`;
}

function PaiementContenu() {
  const { t } = useAsm();
  const params = useSearchParams();
  const demandeId = params.get("demande");

  const [ctx, setCtx] = useState(undefined); // undefined = chargement, null = erreur
  const [ecran, setEcran] = useState("");    // "" | ticket | reussi | refuse | annule | abo_ok | surplace_ok
  const [codeTicket, setCodeTicket] = useState("");
  const [msg, setMsg] = useState("");
  const [occupe, setOccupe] = useState(false);

  async function charger() {
    try {
      const r = await fetch(`/api/paiement?demande=${demandeId}`, {
        headers: { Authorization: `Bearer ${await jeton()}` },
      });
      if (!r.ok) return setCtx(null);
      setCtx(await r.json());
    } catch {
      setCtx(null);
    }
  }
  useEffect(() => {
    if (demandeId) charger();
    else setCtx(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandeId]);

  async function agir(corps) {
    setMsg("");
    setOccupe(true);
    try {
      const r = await fetch("/api/paiement", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await jeton()}` },
        body: JSON.stringify({ demandeId: Number(demandeId), ...corps }),
      });
      const d = await r.json().catch(() => ({}));
      setOccupe(false);
      return { ok: r.ok, ...d };
    } catch {
      setOccupe(false);
      return { ok: false };
    }
  }

  const validerTicket = async () => {
    const res = await agir({ action: "ticket", code: codeTicket });
    if (res.ok) return setEcran("reussi_ticket");
    const cles = {
      ticket_invalide: "pay_ticket_invalide", ticket_expire: "pay_ticket_expire",
      ticket_epuise: "pay_ticket_epuise", ticket_service: "pay_ticket_service",
    };
    setMsg(t(cles[res.erreur] || "pay_err"));
  };

  const payerSimulation = async (moyen) => {
    // La passerelle décide du sort du paiement — ici la simulation tire un
    // résultat (accepté le plus souvent) pour éprouver TOUT le parcours.
    const tirage = Math.random();
    const resultat = tirage < 0.8 ? "accepte" : tirage < 0.9 ? "refuse" : "annule";
    const res = await agir({ action: "simulation", moyen, resultat });
    if (!res.ok) return setMsg(t("pay_err"));
    setEcran(res.resultat === "accepte" ? "reussi" : res.resultat === "refuse" ? "refuse" : "annule");
  };

  const confirmerAbonnement = async () => {
    const res = await agir({ action: "abonnement" });
    if (res.ok) setEcran("abo_ok");
    else setMsg(t("pay_err"));
  };

  const payerSurPlace = async () => {
    const res = await agir({ action: "surplace" });
    if (res.ok) setEcran("surplace_ok");
  };

  // ---- Écrans de résultat ----
  const Resultat = ({ icone, titre, texte, retenter }) => (
    <div className="pay-resultat">
      <div className="pay-resultat-ico" aria-hidden="true">{icone}</div>
      <h3>{titre}</h3>
      <p>{texte}</p>
      <div className="pay-actions">
        {retenter && (
          <button className="btn-secondaire" onClick={() => { setEcran(""); charger(); }}>
            {t("pay_reessayer")}
          </button>
        )}
        <Link className="btn-action" href={`/suivi?id=${demandeId}`}>{t("pay_retour_suivi")}</Link>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 560 }}>
        <h2 className="titre-page">{t("pay_t")}</h2>

        {ctx === undefined && <p className="sous-page">{t("compte_charge")}</p>}
        {ctx === null && (
          <div className="etat-vide">
            <p>{t("pay_err")}</p>
            <p className="info-appel"><ChoixAppel /></p>
            <Link className="btn-action" style={{ marginTop: 12 }} href="/suivi">{t("pay_retour_suivi")}</Link>
          </div>
        )}

        {/* ---- Résultats ---- */}
        {ecran === "reussi" && <Resultat icone="✅" titre={t("pay_reussi_t")} texte={t("pay_reussi_p")} />}
        {ecran === "reussi_ticket" && <Resultat icone="🎟" titre={t("pay_ticket_ok")} texte={t("pay_reussi_p")} />}
        {ecran === "refuse" && <Resultat icone="❌" titre={t("pay_refuse_t")} texte={t("pay_sim_ko")} retenter />}
        {ecran === "annule" && <Resultat icone="↩️" titre={t("pay_attente_t")} texte={t("pay_sim_annule")} retenter />}
        {ecran === "abo_ok" && <Resultat icone="⭐" titre={t("pay_abo_t")} texte={t("pay_abo_ok")} />}
        {ecran === "surplace_ok" && <Resultat icone="💵" titre={t("pay_gratuit_t")} texte={t("pay_surplace_ok")} />}

        {ctx && !ecran && (
          <>
            <p className="sous-page">{t("pay_s")}</p>

            {/* ---- Gratuit / déjà réglé / abonné ---- */}
            {ctx.etat === "gratuit" && (
              <Resultat icone="✅" titre={t("pay_gratuit_t")} texte={t("pay_gratuit_p")} />
            )}
            {ctx.etat === "deja_regle" && (
              <Resultat
                icone="✅"
                titre={t("pay_deja_t")}
                texte={`${t("pay_deja_p")}${ctx.reference ? ` ${t("pay_recu")} : ${ctx.reference}.` : ""}${ctx.simulation ? ` ${t("pay_sim_note")}` : ""}`}
              />
            )}
            {ctx.etat === "abonne" && (
              <div className="pay-carte abonne">
                <strong>{t("pay_abo_t")}</strong>
                <p>{t("pay_abo_p")} {ctx.plan?.nom && <b>({ctx.plan.nom})</b>}</p>
                {ctx.applique ? (
                  <Link className="btn-action" href={`/suivi?id=${demandeId}`}>{t("pay_retour_suivi")}</Link>
                ) : (
                  <button className="btn-action" disabled={occupe} onClick={confirmerAbonnement}>
                    {t("pay_abo_b")}
                  </button>
                )}
              </div>
            )}

            {/* ---- À payer ---- */}
            {ctx.etat === "a_payer" && (
              <>
                {ctx.montant != null && (
                  <div className="pay-montant">
                    <span>{t("pay_montant")}</span>
                    <b>{DA(ctx.montant)}</b>
                  </div>
                )}

                {/* Incitation abonnement AVANT le paiement classique */}
                {ctx.plans?.length > 0 && (
                  <div className="pay-carte abonne">
                    <strong>{t("pay_decouvrir")}</strong>
                    <p>{t("pay_decouvrir_p")}</p>
                    <div className="pay-actions">
                      <Link className="btn-secondaire" href="/abonnements">{t("pay_voir_abos")}</Link>
                      <Link className="btn-action" href="/abonnements">{t("pay_sabonner")}</Link>
                    </div>
                  </div>
                )}

                <div className="pay-carte">
                  <strong>{t("pay_classique")}</strong>
                  {ctx.simulation && (
                    <>
                      <button className="btn-action" style={{ marginTop: 10 }} disabled={occupe} onClick={() => payerSimulation("cib")}>
                        {t("pay_carte_b")} (CIB / EDAHABIA)
                      </button>
                      <small style={{ display: "block", marginTop: 4, opacity: 0.7 }}>{t("pay_sim_note")}</small>
                    </>
                  )}
                  <button className="btn-secondaire" style={{ marginTop: 10 }} disabled={occupe} onClick={payerSurPlace}>
                    {t("pay_surplace_b")}
                  </button>
                </div>

                <div className="pay-carte">
                  <strong>{t("pay_ticket_b")}</strong>
                  <div className="champ" style={{ marginTop: 8 }}>
                    <label>{t("pay_ticket_l")}</label>
                    <input
                      value={codeTicket}
                      onChange={(e) => setCodeTicket(e.target.value.toUpperCase())}
                      placeholder={t("pay_ticket_ph")}
                      maxLength={30}
                      style={{ textTransform: "uppercase" }}
                    />
                  </div>
                  <button className="btn-action" disabled={occupe || codeTicket.trim().length < 4} onClick={validerTicket}>
                    {t("pay_ticket_valider")}
                  </button>
                </div>

                {msg && <p className="erreur">{msg}</p>}
              </>
            )}

            <p className="info-appel" style={{ marginTop: 16 }}>
              <span>{t("suivi_besoin")}</span> <ChoixAppel />
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function Paiement() {
  return (
    <Suspense>
      <PaiementContenu />
    </Suspense>
  );
}
