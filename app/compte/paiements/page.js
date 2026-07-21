"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAsm } from "@/app/providers";
import { supabase } from "@/lib/supabase";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";
import ChoixAppel from "@/app/components/appel";

// Espace client « Paiements & factures » : solde, factures à payer,
// paiement (espèces / carte si disponible / virement), tickets, reçus,
// abonnements, points de paiement. Données 100 % réelles, scopées au compte.

async function apiFinances(chemin, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(chemin, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
      ...(options.headers || {}),
    },
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) {
    const e = new Error(d?.erreur || "erreur");
    e.data = d;
    throw e;
  }
  return d;
}

const DA = (n) => `${Number(n || 0).toLocaleString("fr-FR")} DZD`;
const LIB_STATUT_F = {
  EMISE: "À payer", PARTIELLEMENT_PAYEE: "Partiellement payée", PAYEE: "Payée",
  EN_RETARD: "En retard", ANNULEE: "Annulée", CREDITEE: "Créditée",
};

function ouvrirDocument(type, id) {
  supabase.auth.getSession().then(({ data: { session } }) => {
    // Le document exige le jeton : on l'ouvre via un formulaire GET simple
    // n'exposant rien — le plus fiable sur mobile est un fetch + blob.
    fetch(`/api/finances/document?type=${type}&id=${id}`, {
      headers: { Authorization: `Bearer ${session?.access_token || ""}` },
    })
      .then((r) => r.text())
      .then((html) => {
        const f = window.open("", "_blank");
        if (f) {
          f.document.write(html);
          f.document.close();
        }
      })
      .catch(() => {});
  });
}

function CarteFacture({ f, t, moyens, onPayer, occupe }) {
  const [choix, setChoix] = useState(false);
  const du = f.total - f.paye;
  const retard = f.statut === "EN_RETARD";
  return (
    <div className="fin-facture" style={retard ? { borderColor: "#C05252" } : undefined}>
      <div className="fin-facture-tete">
        <span>
          <strong>{f.numero}</strong>
          <small>
            {f.lignes?.[0]?.libelle || "Prestation ASM"}
            {f.lignes?.length > 1 ? ` (+${f.lignes.length - 1})` : ""}
          </small>
          <small>{t("pf_echeance")} : {f.echeance}</small>
        </span>
        <span className="fin-montant">
          <strong>{DA(du)}</strong>
          <em className={"fin-statut" + (retard ? " ko" : "")}>{LIB_STATUT_F[f.statut] || f.statut}</em>
        </span>
      </div>
      {["EMISE", "PARTIELLEMENT_PAYEE", "EN_RETARD"].includes(f.statut) && (
        !choix ? (
          <div className="fin-actions">
            <button className="btn-action" style={{ padding: "10px 18px" }} onClick={() => setChoix(true)}>{t("pf_payer")}</button>
            <button className="fin-lien" onClick={() => ouvrirDocument("facture", f.id)}>{t("pf_voir_facture")}</button>
          </div>
        ) : (
          <div className="fin-moyens">
            <span>{t("pf_choisir_moyen")}</span>
            <div className="chips" style={{ marginTop: 6 }}>
              {moyens.map((m) => (
                <button key={m.id} className="chip" disabled={occupe} onClick={() => onPayer(f, m.id)}>
                  {m.id === "especes" ? "💵 " : m.id === "virement" ? "🏦 " : "💳 "}{m.libelle}
                </button>
              ))}
            </div>
          </div>
        )
      )}
      {f.statut === "PAYEE" && (
        <div className="fin-actions">
          <button className="fin-lien" onClick={() => ouvrirDocument("facture", f.id)}>{t("pf_voir_facture")}</button>
        </div>
      )}
    </div>
  );
}

export default function PaiementsFactures() {
  const { t, connecte } = useAsm();
  const [d, setD] = useState(undefined);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState(null); // {type:"ticket"|"virement", ...}
  const [erreur, setErreur] = useState("");

  const charger = () =>
    apiFinances("/api/finances/moi").then(setD).catch(() => setD(null));
  useEffect(() => { charger(); }, []);

  async function payer(facture, moyen) {
    setErreur("");
    setOccupe(true);
    try {
      const r = await apiFinances("/api/finances/payer", {
        method: "POST",
        body: JSON.stringify({ factureId: facture.id, moyen }),
      });
      if (r.type === "en_ligne" && r.url) {
        window.location.href = r.url; // page de paiement sécurisée du fournisseur
        return;
      }
      if (r.type === "ticket") {
        setMessage({ type: "ticket", ticket: r.ticket });
        ouvrirDocument("ticket", r.ticket.id);
      }
      if (r.type === "virement") setMessage({ type: "virement", ...r });
      await charger();
    } catch (e) {
      setErreur(e?.data?.erreur || t("pf_err"));
    }
    setOccupe(false);
  }

  if (d === undefined) return <div className="page"><div className="contenu-page"><p className="sous-page">{t("compte_charge")}</p></div></div>;
  if (d === null || !connecte) {
    return (
      <div className="page"><div className="contenu-page" style={{ maxWidth: 480 }}>
        <h2 className="titre-page">{t("pf_t")}</h2>
        <p className="sous-page">{t("pf_connexion")}</p>
        <Link className="btn-action" href="/connexion">{t("connexion_t")}</Link>
      </div></div>
    );
  }

  const aPayer = d.factures.filter((f) => ["EMISE", "PARTIELLEMENT_PAYEE", "EN_RETARD"].includes(f.statut));
  const payees = d.factures.filter((f) => f.statut === "PAYEE");
  const recus = d.paiements.filter((p) => !["EN_ATTENTE", "ECHOUE", "EXPIRE", "ANNULE"].includes(p.statut));
  const ticketsActifs = d.tickets.filter((tk) => tk.statut === "EN_ATTENTE");

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 640 }}>
        <Link className="btn-retour" href="/compte">{t("retour")}</Link>
        <h2 className="titre-page">{t("pf_t")}</h2>
        <p className="sous-page">
          {t("pf_s")} <strong>{d.compte.numero}</strong>
          {" · "}
          <button className="fin-lien" onClick={() => ouvrirDocument("releve", d.compte.id)}>{t("pf_releve")}</button>
        </p>

        {/* Bulle de rappel — sobre, disparaît une fois réglé */}
        {d.resume.enRetard > 0 && (
          <div className="fin-bulle ko">
            <strong>{t("pf_retard_t")}</strong>
            <span>{t("pf_retard_p")} {DA(d.resume.enRetard)}.</span>
          </div>
        )}
        {d.resume.enRetard === 0 && d.resume.duTotal > 0 && (
          <div className="fin-bulle">
            <strong>{t("pf_du_t")}</strong>
            <span>{DA(d.resume.duTotal)} — {t("pf_du_p")}</span>
          </div>
        )}
        {d.resume.duTotal === 0 && <div className="fin-bulle ok"><strong>{t("pf_a_jour")}</strong></div>}

        {erreur && <p className="erreur">{erreur}</p>}

        {message?.type === "ticket" && (
          <div className="fin-bulle" style={{ borderColor: "var(--vert)" }}>
            <strong>{t("pf_ticket_ok")}</strong>
            <span>{t("pf_ticket_ref")} : <b>{message.ticket.reference}</b> · {t("pf_ticket_exp")} {new Date(message.ticket.expireLe).toLocaleDateString("fr-FR")}</span>
            <button className="fin-lien" onClick={() => ouvrirDocument("ticket", message.ticket.id)}>{t("pf_ticket_voir")}</button>
          </div>
        )}
        {message?.type === "virement" && (
          <div className="fin-bulle" style={{ borderColor: "var(--vert)" }}>
            <strong>{t("pf_virement_t")}</strong>
            <span>{message.infos.banque} · {message.infos.titulaire} · RIB {message.infos.rib}</span>
            <span>{t("pf_virement_ref")} : <b>{message.paiement.reference}</b></span>
          </div>
        )}

        {/* À payer */}
        <h3 className="fin-titre">{t("pf_a_payer")} {aPayer.length ? `(${aPayer.length})` : ""}</h3>
        {aPayer.length === 0 && <p className="sous-page">{t("pf_rien")}</p>}
        {aPayer.map((f) => (
          <CarteFacture key={f.id} f={f} t={t} moyens={d.moyens} onPayer={payer} occupe={occupe} />
        ))}

        {/* Tickets espèces actifs */}
        {ticketsActifs.length > 0 && (
          <>
            <h3 className="fin-titre">{t("pf_tickets")}</h3>
            {ticketsActifs.map((tk) => (
              <div className="fin-facture" key={tk.id}>
                <div className="fin-facture-tete">
                  <span><strong>{tk.reference}</strong><small>{t("pf_ticket_exp")} {new Date(tk.expireLe).toLocaleDateString("fr-FR")}</small></span>
                  <span className="fin-montant"><strong>{DA(tk.montant)}</strong></span>
                </div>
                <div className="fin-actions">
                  <button className="fin-lien" onClick={() => ouvrirDocument("ticket", tk.id)}>{t("pf_ticket_voir")}</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Abonnements */}
        {d.souscriptions.length > 0 && (
          <>
            <h3 className="fin-titre">{t("pf_abos")}</h3>
            {d.souscriptions.map((s) => (
              <div className="fin-facture" key={s.id}>
                <div className="fin-facture-tete">
                  <span><strong>{s.plan.nom}</strong><small>{s.plan.description || ""}</small></span>
                  <span className="fin-montant"><strong>{DA(s.prix)}</strong><em className="fin-statut">{s.statut}</em></span>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Historique : reçus + factures payées */}
        <h3 className="fin-titre">{t("pf_historique")}</h3>
        {recus.length === 0 && payees.length === 0 && <p className="sous-page">{t("pf_vide")}</p>}
        {recus.map((pa) => (
          <div className="fin-facture" key={"p" + pa.id}>
            <div className="fin-facture-tete">
              <span><strong>{t("pf_recu")} {pa.reference}</strong><small>{pa.moyen.toUpperCase()} · {pa.confirmeLe ? new Date(pa.confirmeLe).toLocaleDateString("fr-FR") : ""}</small></span>
              <span className="fin-montant"><strong>{DA(pa.montant)}</strong></span>
            </div>
            <div className="fin-actions">
              <button className="fin-lien" onClick={() => ouvrirDocument("recu", pa.id)}>{t("pf_voir_recu")}</button>
            </div>
          </div>
        ))}
        {payees.map((f) => (
          <div className="fin-facture" key={"f" + f.id}>
            <div className="fin-facture-tete">
              <span><strong>{f.numero}</strong><small>{f.emissionLe}</small></span>
              <span className="fin-montant"><strong>{DA(f.total)}</strong><em className="fin-statut">{LIB_STATUT_F.PAYEE}</em></span>
            </div>
            <div className="fin-actions">
              <button className="fin-lien" onClick={() => ouvrirDocument("facture", f.id)}>{t("pf_voir_facture")}</button>
            </div>
          </div>
        ))}

        {/* Points de paiement */}
        <CarteParrainage t={t} />

        {d.points.length > 0 && (
          <>
            <h3 className="fin-titre">{t("pf_points")}</h3>
            {d.points.map((pt) => (
              <div className="fin-facture" key={pt.id}>
                <div className="fin-facture-tete">
                  <span>
                    <strong>{pt.nom}</strong>
                    <small>{[pt.adresse, pt.commune].filter(Boolean).join(", ")}</small>
                    <small>{pt.horaires || ""}</small>
                  </span>
                  {pt.adresse && (
                    <a className="fin-lien" href={`https://maps.google.com/?q=${encodeURIComponent([pt.adresse, pt.commune, "Alger"].filter(Boolean).join(", "))}`} target="_blank" rel="noreferrer">
                      {t("pf_itineraire")}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        <div className="info-appel" style={{ marginTop: 18 }}>
          <span>{t("pf_aide")}</span> <ChoixAppel />
        </div>
      </div>
    </div>
  );
}

// Parrainage : mon code personnel — le filleul est remis sur sa première
// facture, le parrain est crédité automatiquement (RemiseClient).
function CarteParrainage({ t }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    apiFinances("/api/promo").then(setD).catch(() => setD(null));
  }, []);
  if (!d?.code) return null;
  return (
    <>
      <h3 className="fin-titre">{t("par_t")}</h3>
      <div className="fin-bulle" style={{ borderColor: "var(--vert)" }}>
        <strong style={{ fontSize: 18, letterSpacing: 1 }}>{d.code}</strong>
        <span>{t("par_p").replace("{remise}", d.remiseFilleul).replace("{gain}", String(d.recompenseParrain))}</span>
        <span>{t("par_filleuls")} : <b>{d.filleuls}</b></span>
        <button className="fin-lien" onClick={() => {
          try { navigator.clipboard.writeText(d.code); } catch {}
        }}>{t("par_copier")}</button>
      </div>
    </>
  );
}
