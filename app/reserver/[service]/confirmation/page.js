"use client";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAsm } from "@/app/providers";
import { TEL_AFFICHE } from "@/lib/i18n";
import { TYPES, BESOINS, FENETRES, PAIEMENTS, validerEtape } from "@/lib/parcours";
import { Stepper, useParcours, viderParcours } from "@/app/components/parcours";

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
  const { t, espaceChoisi, connecte } = useAsm();
  const routeur = useRouter();
  const { service } = useParams();
  const [d, maj] = useParcours();

  const [promoOuvert, setPromoOuvert] = useState(false);
  const [promoEtat, setPromoEtat] = useState(null); // null | "ok" | code d'erreur
  const [envoi, setEnvoi] = useState(false);
  const [manque, setManque] = useState([]);
  const [erreur, setErreur] = useState("");
  const [confirme, setConfirme] = useState(null);

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
  const typeLib = (TYPES[service] || []).find((x) => x.cle === d.type)?.libelle;
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

      // Créneau pris entre l'affichage et la confirmation : on renvoie à
      // l'étape 3 avec le message qui l'explique, plutôt qu'une erreur sèche.
      if (r.status === 409) {
        maj({ iso: "", fenetre: "" });
        routeur.push(`/reserver/${service}/creneau?conflit=1`);
        return;
      }
      if (!r.ok) throw new Error(j.erreur || "erreur");

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

        <div className="pc-recap">
          <Bloc titre={t("pc_recap_service")} valeur={typeLib ? t(typeLib) : ""} vers="besoin" />
          <Bloc titre={t("pc_recap_trajet")} valeur={lieux} vers="lieux" />
          <Bloc titre={t("pc_commune_l")} valeur={d.commune} vers="lieux" />
          <Bloc titre={t("pc_recap_quand")} valeur={quand} vers="creneau" />
          <Bloc
            titre={t("pc_recap_besoins")}
            valeur={(d.besoins || []).map((c) => t(BESOINS.find((b) => b.cle === c)?.libelle || c)).join(", ")}
            vers="lieux"
          />
        </div>

        <div className="champ">
          <label>{t("tel_l")}</label>
          <input
            inputMode="tel"
            value={d.telephone || ""}
            onChange={(e) => { setErreur(""); maj({ telephone: e.target.value }); }}
            placeholder={t("tel_ph")}
          />
        </div>

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
        <button className="btn-action" onClick={confirmer} disabled={envoi}>
          {envoi ? t("pc_chargement") : t("pc_confirmer")}
        </button>
      </div>
    </div>
  );
}
