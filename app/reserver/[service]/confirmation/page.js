"use client";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE } from "@/lib/i18n";
import EstimationPrix from "@/app/components/estimation";
import { BESOINS, FENETRES, PAIEMENTS, validerEtape } from "@/lib/parcours";
import { Stepper, useParcours, viderParcours, useStructure, libelleType } from "@/app/components/parcours";

// Étape 4 — récapitulatif et confirmation.
//
// Tout ce qui a été saisi est relu ici, avec un lien « Modifier » par bloc :
// on ne demande jamais de recommencer depuis le début pour corriger une
// adresse. Le code promo est replié — il ne concerne qu'une minorité et,
// déplié en permanence, il donne l'impression qu'il manque quelque chose.
//
// La demande est envoyée à /api/demandes sous forme d'ÉTAT du parcours
// (parcours: true) : c'est le serveur qui l'assemble, avec le même code pour
// le site et l'application.

export default function EtapeConfirmation() {
  const { t, langue, espaceChoisi, connecte } = useAsm();
  const routeur = useRouter();
  const { service } = useParams();
  const [d, maj] = useParcours();
  const { structure } = useStructure();

  const [promoOuvert, setPromoOuvert] = useState(false);
  const [promoEtat, setPromoEtat] = useState(null); // null | "ok" | code d'erreur
  const [envoi, setEnvoi] = useState(false);
  const [manque, setManque] = useState([]);
  const [erreur, setErreur] = useState("");
  const [confirme, setConfirme] = useState(null);
  const [ordonnance, setOrdonnance] = useState(null);
  // Créneau parti pendant la saisie : on garde lequel, pour proposer d'être
  // prévenu s'il se libère.
  const [conflit, setConflit] = useState(null);
  const [attente, setAttente] = useState("");

  // Téléphone du compte connecté : le patient ne le retape pas, et l'équipe
  // ne se retrouve pas avec deux numéros pour la même personne.
  useEffect(() => {
    (async () => {
      try {
        const { utilisateurCourant, chargerProfil } = await import("@/lib/supabase");
        const u = await utilisateurCourant();
        if (!u) return;
        const p = await chargerProfil(u.id);
        const tel = u.phone || p?.telephone || "";
        // Jamais par-dessus une saisie en cours : on ne remplit que le vide.
        if (tel && !d?.telephone) maj({ telephone: tel });
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!d]);

  // Le moyen de paiement par défaut est proposé, jamais imposé en silence :
  // il apparaît sélectionné et reste modifiable.
  useEffect(() => {
    if (d && !d.paiement) {
      const def = PAIEMENTS.find((p) => p.defaut && p.actif);
      if (def) maj({ paiement: def.cle });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!d]);

  if (!d) return <div className="page"><div className="contenu-page" /></div>;

  const livraison = service === "medicaments";
  const typeChoisi = (structure.types?.[service] || []).find((x) => x.cle === d.type);
  const moyens = PAIEMENTS.filter((p) => p.actif && (!p.proSeulement || espaceChoisi === "pro"));

  async function verifierPromo() {
    if (!d.codePromo?.trim()) return;
    setPromoEtat(null);
    try {
      const r = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: d.codePromo, service, telephone: d.telephone }),
      });
      const j = await r.json();
      setPromoEtat(r.ok ? "ok" : j.erreur || "invalide");
    } catch {
      setPromoEtat("invalide");
    }
  }

  async function confirmer() {
    if (envoi) return;
    setErreur("");
    setConflit(null);
    const erreurs = validerEtape("confirmation", { ...d, service });
    if (erreurs.length) return setManque(erreurs);
    if (!d.telephone || d.telephone.replace(/\D/g, "").length < 9) {
      return setErreur(t("err_tel_format"));
    }

    setEnvoi(true);
    try {
      const entetes = { "Content-Type": "application/json" };
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) entetes.Authorization = `Bearer ${session.access_token}`;
      } catch {}

      const r = await fetch("/api/demandes", {
        method: "POST",
        headers: entetes,
        body: JSON.stringify({ ...d, service, espace: espaceChoisi, parcours: true }),
      });
      const j = await r.json().catch(() => ({}));

      // Créneau parti entre l'affichage et la confirmation. Renvoyer
      // sèchement à l'étape 3 ferait perdre l'information utile : QUEL
      // créneau était visé. On le garde pour proposer la liste d'attente,
      // en plus du retour au calendrier.
      if (r.status === 409) {
        setConflit({ date: d.iso || d.jour, fenetre: j.erreur === "fenetre_pleine" });
        setErreur(t(j.erreur === "fenetre_pleine" ? "err_fenetre_pleine" : "err_creneau_pris"));
        return;
      }
      if (!r.ok) throw new Error(j.erreur || "erreur");

      // Ordonnance jointe APRÈS la création : la demande existe déjà, donc
      // un échec d'envoi ne fait pas perdre la réservation — on le dit, et
      // le patient peut toujours la déposer depuis « Mes documents ».
      if (livraison && ordonnance && j?.id) {
        try {
          const fd = new FormData();
          fd.append("demandeId", String(j.id));
          fd.append("telephone", d.telephone);
          fd.append("fichier", ordonnance);
          const ro = await fetch("/api/demandes/ordonnance", { method: "POST", body: fd });
          if (!ro.ok) setErreur(t("ord_echec"));
        } catch {
          setErreur(t("ord_echec"));
        }
      }

      viderParcours();
      // Écran de paiement : lui seul connaît la situation réelle du compte
      // (abonné, ticket, déjà réglé). Le moyen annoncé ici ne le remplace pas.
      if (j?.id && connecte) {
        routeur.push(`/paiement?demande=${j.id}`);
        return;
      }
      setConfirme(j?.id || true);
    } catch {
      setErreur(`${t("err_serveur")} ${TEL_AFFICHE}.`);
    } finally {
      setEnvoi(false);
    }
  }

  if (confirme) {
    return (
      <div className="page">
        <div className="contenu-page" style={{ maxWidth: 460 }}>
          <div className="confirmation">
            <div className="rond-ok">✓</div>
            <h2 style={{ fontSize: 21, marginBottom: 6 }}>{t("pc_succes_t")}</h2>
            <p style={{ color: "var(--gris)" }}>{t("pc_succes_p")}</p>
            {typeof confirme === "number" && (
              <p style={{ marginTop: 10, fontWeight: 800 }}>{t("pc_succes_numero")} : {confirme}</p>
            )}
            <Link className="btn-action" style={{ marginTop: 18 }} href="/suivi">{t("rdv_ok_suivre")}</Link>
          </div>
        </div>
      </div>
    );
  }

  const Bloc = ({ titre, valeur, vers }) =>
    valeur ? (
      <div className="pc-recap-ligne">
        <div>
          <small>{titre}</small>
          <strong>{valeur}</strong>
        </div>
        <Link className="pc-lien" href={`/reserver/${service}/${vers}`}>{t("pc_modifier")}</Link>
      </div>
    ) : null;

  const quand = livraison
    ? [d.jour, FENETRES.find((f) => f.cle === d.fenetre)?.libelle && t(FENETRES.find((f) => f.cle === d.fenetre).libelle)]
        .filter(Boolean).join(" · ")
    : [d.jour, d.heure].filter(Boolean).join(" · ");

  const lieux = service === "transport"
    ? [d.depart, d.destination].filter(Boolean).join(" → ")
    : d.depart;

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 560 }}>
        <Link className="btn-retour" href={`/reserver/${service}/creneau`}>{t("pc_retour")}</Link>
        <h2 className="titre-page">{t("pc_recap_t")}</h2>
        <Stepper etape="confirmation" />

        {/* Rappel de qui est concerné : sur un compte qui réserve pour
            plusieurs personnes, confirmer sans le voir est trop facile. */}
        {d.pourPatientNom && (
          <div className="bandeau-info pc-bandeau">
            <span>👤 {t("pp_bandeau")} <strong>{d.pourPatientNom}</strong></span>
          </div>
        )}
        {d.packNom && (
          <div className="bandeau-info pc-bandeau">
            <span>🎁 {t("pk_bandeau")} <strong>{d.packNom}</strong> — {d.packPrix} DZD</span>
          </div>
        )}

        <div className="pc-recap">
          <Bloc titre={t("pc_recap_service")} valeur={libelleType(typeChoisi, t, langue)} vers="besoin" />
          <Bloc titre={t("pc_recap_trajet")} valeur={lieux} vers="lieux" />
          <Bloc titre={t("pc_commune_l")} valeur={d.commune} vers="lieux" />
          <Bloc titre={t("pc_recap_quand")} valeur={quand} vers="creneau" />
          <Bloc
            titre={t("pc_recap_besoins")}
            valeur={(d.besoins || []).map((c) => t(BESOINS.find((b) => b.cle === c)?.libelle || c)).join(", ")}
            vers="lieux"
          />
        </div>

        {/* Prix estimé aux tarifs en vigueur, remise du compte comprise.
            Il apparaît AVANT le bouton de confirmation : personne ne devrait
            valider une prestation sans savoir ce qu'elle coûte. */}
        <EstimationPrix
          t={t}
          visible
          service={service}
          jour={d.jour}
          heure={d.heure}
          duree={d.duree}
          typeTrajet={d.typeTrajet}
          packId={d.packId}
          km={d.km}
          besoins={d.besoins}
          allerRetour={d.allerRetour}
        />

        <div className="champ">
          <label>{t("tel_l")}</label>
          <input
            inputMode="tel"
            value={d.telephone || ""}
            onChange={(e) => { setErreur(""); maj({ telephone: e.target.value }); }}
            placeholder={t("tel_ph")}
          />
        </div>

        {/* L'ordonnance se joint ici, au moment de confirmer : l'ancien
            formulaire la demandait avant même de choisir un créneau, et
            l'ancien message renvoyait simplement le patient vers
            « Mes documents » — une démarche de plus, souvent oubliée. */}
        {livraison && (
          <div className="champ">
            <label>{t("ord_l")}</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setOrdonnance(e.target.files?.[0] || null)}
            />
            <p className="fe-aide" style={{ marginBottom: 0 }}>
              {ordonnance ? `📎 ${ordonnance.name} — ${t("ord_pret")}` : t("ord_aide")}
            </p>
          </div>
        )}

        {/* Replié : déplié en permanence, un champ « code promo » laisse
            croire qu'il manque quelque chose pour réserver. */}
        {!promoOuvert ? (
          <button type="button" className="pc-lien" onClick={() => setPromoOuvert(true)}>
            {t("pc_promo_lien")}
          </button>
        ) : (
          <div className="champ">
            <label>{t("pc_promo_l")}</label>
            <div className="pc-duo">
              <input
                value={d.codePromo || ""}
                onChange={(e) => { setPromoEtat(null); maj({ codePromo: e.target.value }); }}
              />
              <button type="button" className="btn-secondaire" onClick={verifierPromo}>{t("pc_suivant")}</button>
            </div>
            {promoEtat === "ok" && <p className="pc-attente" style={{ textAlign: "start" }}>{t("promo_ok")}</p>}
            {promoEtat && promoEtat !== "ok" && <p className="erreur">{t("promo_invalide")}</p>}
          </div>
        )}

        <div className="champ">
          <label>{t("pc_paiement_l")}</label>
          <div className="chips">
            {moyens.map((p) => (
              <button
                type="button"
                key={p.cle}
                className={"chip" + (d.paiement === p.cle ? " actif" : "")}
                aria-pressed={d.paiement === p.cle}
                onClick={() => { setManque([]); maj({ paiement: p.cle }); }}
              >
                {t(p.libelle)}
              </button>
            ))}
          </div>
        </div>

        {erreur && <p className="erreur">{erreur}</p>}
        {manque.map((cle) => <p className="erreur" key={cle}>{t(cle)}</p>)}

        {/* Le créneau vient d'être pris. Deux issues, aucune impasse :
            en choisir un autre, ou être prévenu si celui-là se libère. */}
        {conflit && (
          <div style={{ marginBottom: 14 }}>
            <Link className="btn-action" href={`/reserver/${service}/creneau`}>{t("pc_calendrier_t")}</Link>
            {!conflit.fenetre && (
              attente === "ok" || attente === "deja" ? (
                <p className="pc-attente" style={{ color: "var(--vert-fonce)", fontWeight: 700 }}>
                  {t(attente === "deja" ? "att_deja" : "att_ok")}
                </p>
              ) : (
                <>
                  <button
                    className="btn-secondaire"
                    style={{ marginTop: 10 }}
                    disabled={attente === "envoi"}
                    onClick={async () => {
                      setAttente("envoi");
                      try {
                        const r = await fetch("/api/attente", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            service, date: conflit.date, telephone: d.telephone,
                            commune: d.commune || undefined, typeTrajet: d.typeTrajet || undefined,
                            duree: d.duree,
                          }),
                        });
                        const j = await r.json().catch(() => ({}));
                        if (r.ok) setAttente(j.deja ? "deja" : "ok");
                        else setAttente(j.erreur === "trop_attentes" ? "trop" : "erreur");
                      } catch {
                        setAttente("erreur");
                      }
                    }}
                  >
                    {t("att_b")} ({String(conflit.date).replace("T", " · ")})
                  </button>
                  {attente === "trop" && <p className="erreur">{t("att_trop")}</p>}
                  {attente === "erreur" && <p className="erreur">{t("att_err")}</p>}
                </>
              )
            )}
          </div>
        )}

        <button className="btn-action" onClick={confirmer} disabled={envoi}>
          {envoi ? t("pc_chargement") : t("pc_confirmer")}
        </button>
      </div>
    </div>
  );
}
