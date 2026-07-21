"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchAdmin, useGardeAdmin } from "../ui";
import { supabase } from "@/lib/supabase";

// Centre financier ASM : tableau de bord, factures, paiements & tickets
// espèces, tarifs versionnés, remises, plans, points de paiement, relances,
// événements fournisseurs. Toutes les permissions sont revérifiées côté serveur.

const DA = (n) => `${Number(n || 0).toLocaleString("fr-FR")} DZD`;
const ONGLTS = [
  ["bord", "Tableau de bord"], ["factures", "Factures"], ["paiements", "Paiements & tickets"],
  ["mensuel", "Établissements"], ["offres", "Offres & devis"], ["tarifs", "Tarifs"], ["remises", "Remises"],
  ["plans", "Abonnements"], ["tickets", "Tickets d'agence"], ["points", "Points de paiement"], ["evenements", "Événements"],
];

function Cartes({ bord }) {
  const cartes = [
    ["Facturé", DA(bord.facture)], ["Encaissé", DA(bord.encaisse)],
    ["À encaisser", DA(bord.aEncaisser)], ["Impayés (retard)", DA(bord.impayes), bord.impayes > 0],
    ["Paiements aujourd'hui", `${bord.paiementsJour} · ${DA(bord.montantJour)}`],
    ["Espèces aujourd'hui", DA(bord.especesJour)],
    ["En attente de confirmation", bord.paiementsEnAttente, bord.paiementsEnAttente > 0],
    ["Tickets espèces actifs", bord.ticketsActifs],
    ["Abonnements actifs", bord.souscriptionsActives],
    ["Remboursé", `${bord.nbRemboursements} · ${DA(bord.rembourses)}`],
  ];
  return (
    <>
      {bord.avertissement && <p className="adm-msg">⚠ {bord.avertissement}</p>}
      <div className="adm-cartes">
        {cartes.map(([l, v, alerte]) => (
          <div className={"adm-carte" + (alerte ? " alerte" : "")} key={l}>
            <strong style={{ fontSize: 18 }}>{v}</strong>
            <span>{l}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function FinancesContenu() {
  const { role } = useGardeAdmin();
  const params = useSearchParams();
  const superadmin = role === "superadmin";
  const [onglet, setOnglet] = useState("bord");
  const [d, setD] = useState(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [ticket, setTicket] = useState(null); // vérification QR / référence

  async function charger(vue = onglet, recherche = q) {
    setD(null);
    try {
      setD(await fetchAdmin(`/api/admin/finances?vue=${vue}${recherche ? `&q=${encodeURIComponent(recherche)}` : ""}`));
    } catch {
      setD({ erreur: true });
    }
  }
  useEffect(() => { charger(onglet, ""); setQ(""); setMsg(""); }, [onglet]); // eslint-disable-line

  // Ouverture directe depuis un QR de ticket (?ticket=jeton).
  useEffect(() => {
    const j = params.get("ticket");
    if (!j) return;
    setOnglet("paiements");
    fetchAdmin(`/api/admin/finances?vue=ticket&ref=${encodeURIComponent(j)}`)
      .then((r) => setTicket(r.ticket))
      .catch(() => setMsg("Ticket introuvable."));
  }, [params]);

  async function action(corps, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return;
    setMsg("");
    try {
      const r = await fetchAdmin("/api/admin/finances", { method: "POST", body: JSON.stringify(corps) });
      setMsg("Action effectuée ✓");
      await charger();
      return r;
    } catch (e) {
      setMsg("⚠ " + (e?.data?.erreur || "Action impossible (droits ?)"));
    }
  }

  async function verifierTicket() {
    const ref = window.prompt("Référence du ticket (ASM-T-…) :");
    if (!ref) return;
    setMsg("");
    try {
      const r = await fetchAdmin(`/api/admin/finances?vue=ticket&ref=${encodeURIComponent(ref.trim())}`);
      setTicket(r.ticket);
    } catch {
      setMsg("Ticket introuvable.");
    }
  }

  return (
    <>
      <h1 className="adm-titre">Finances</h1>
      <div className="chips" style={{ marginBottom: 14 }}>
        {ONGLTS.filter(([id]) => id !== "evenements" || superadmin).map(([id, lib]) => (
          <button key={id} className={"chip" + (onglet === id ? " actif" : "")} onClick={() => setOnglet(id)}>{lib}</button>
        ))}
      </div>
      {msg && <p className="adm-msg">{msg}</p>}

      {/* ---- Vérification / encaissement d'un ticket (QR ou référence) ---- */}
      {ticket && (
        <div className="adm-fiche" style={{ borderColor: "var(--vert)", marginBottom: 14 }}>
          <h2 className="adm-sous-titre" style={{ marginTop: 0 }}>Ticket {ticket.reference} — {ticket.statut}</h2>
          <p style={{ margin: "6px 0" }}>
            <strong>{DA(ticket.montant)}</strong> · Facture {ticket.facture?.numero} · Client {ticket.facture?.compte?.nom || "—"} ({ticket.facture?.compte?.numero})
            <br /><small>Valable jusqu'au {new Date(ticket.expireLe).toLocaleDateString("fr-FR")}</small>
          </p>
          {ticket.statut === "EN_ATTENTE" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="adm-btn" onClick={async () => {
                const r = await action({ action: "ticket.encaisser", jeton: ticket.jeton }, `Confirmer l'encaissement de ${DA(ticket.montant)} en espèces ?`);
                if (r?.ok) setTicket(null);
              }}>💵 Confirmer l'encaissement</button>
              <button className="adm-btn secondaire" onClick={() => setTicket(null)}>Fermer</button>
            </div>
          ) : (
            <button className="adm-btn secondaire" onClick={() => setTicket(null)}>Fermer</button>
          )}
        </div>
      )}

      {!d && <p className="adm-vide">Chargement…</p>}
      {d?.erreur && <p className="adm-vide">Impossible de charger.</p>}

      {/* ================= BORD ================= */}
      {onglet === "bord" && d?.bord && (
        <>
          <Cartes bord={d.bord} />
          <div className="adm-filtres" style={{ marginTop: 14 }}>
            <button className="adm-btn" onClick={verifierTicket}>🎫 Vérifier / encaisser un ticket</button>
            <button className="adm-btn secondaire" onClick={() => action({ action: "relances.envoyer" }, "Envoyer les relances d'impayés dues aujourd'hui ?")}>📣 Envoyer les relances</button>
            {["superadmin", "admin"].includes(role) && (
              <button className="adm-btn secondaire" onClick={() => action({ action: "souscriptions.facturer" }, "Générer les factures d'abonnement du mois en cours ?")}>🧾 Facturer les abonnements du mois</button>
            )}
            {superadmin && (
              <button className="adm-btn secondaire" onClick={() =>
                action({ action: "reglage.facturationAuto", actif: !d.facturationAuto },
                  d.facturationAuto
                    ? "Désactiver la facturation automatique à la clôture des prestations ?"
                    : "Activer la facturation automatique : chaque prestation terminée génère sa facture au tarif en vigueur. Continuer ?")
              }>
                {d.facturationAuto ? "🟢 Facturation auto à la clôture : ACTIVE" : "⚪ Facturation auto : désactivée"}
              </button>
            )}
          </div>
        </>
      )}

      {/* ================= FACTURES ================= */}
      {onglet === "factures" && d?.factures && (
        <>
          <div className="adm-filtres">
            <input placeholder="N° facture, client, n° réservation…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && charger("factures")} />
            <button className="adm-btn" onClick={() => charger("factures")}>Rechercher</button>
            <NouvelleFacture onFait={() => charger("factures")} action={action} />
          </div>
          {d.factures.length === 0 && <p className="adm-vide">Aucune facture.</p>}
          <div className="adm-liste">
            {d.factures.map((f) => (
              <div className={"adm-ligne" + (f.statut === "EN_RETARD" ? " signale" : "")} key={f.id}>
                <span className="adm-ligne-texte">
                  <strong>{f.numero} · {DA(f.total)} {f.remiseTotal ? `(remise ${DA(f.remiseTotal)})` : ""}</strong>
                  <small>
                    {f.compte.nom || "—"} ({f.compte.numero}) · émise {f.emissionLe} · échéance {f.echeance}
                    {f.demandeId ? ` · réservation n°${f.demandeId}` : ""} · payé {DA(f.paye)}
                  </small>
                </span>
                <span style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                  <span className="adm-pastille">{f.statut.replaceAll("_", " ")}</span>
                  {["EMISE", "PARTIELLEMENT_PAYEE", "EN_RETARD"].includes(f.statut) && (
                    <>
                      <button className="adm-btn secondaire" onClick={() => action({ action: "ticket.creer", factureId: f.id })}>🎫 Ticket</button>
                      <button className="adm-btn secondaire" onClick={() => {
                        const motif = window.prompt("Motif d'annulation (la facture reste tracée) :");
                        if (motif !== null) action({ action: "facture.annuler", id: f.id, motif });
                      }}>Annuler</button>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ================= PAIEMENTS & TICKETS ================= */}
      {onglet === "paiements" && d?.paiements && (
        <>
          <div className="adm-filtres">
            <input placeholder="Référence ASM-P-…, réf. fournisseur…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && charger("paiements")} />
            <button className="adm-btn" onClick={() => charger("paiements")}>Rechercher</button>
            <button className="adm-btn secondaire" onClick={verifierTicket}>🎫 Vérifier un ticket</button>
          </div>

          {d.ticketsAttente?.length > 0 && (
            <>
              <h2 className="adm-sous-titre">Tickets espèces en attente ({d.ticketsAttente.length})</h2>
              <div className="adm-liste">
                {d.ticketsAttente.map((tk) => (
                  <div className="adm-ligne" key={tk.id}>
                    <span className="adm-ligne-texte">
                      <strong>{tk.reference} · {DA(tk.montant)}</strong>
                      <small>Facture {tk.facture.numero} · expire le {new Date(tk.expireLe).toLocaleDateString("fr-FR")}</small>
                    </span>
                    <button className="adm-btn" onClick={() => action({ action: "ticket.encaisser", reference: tk.reference }, `Confirmer l'encaissement de ${DA(tk.montant)} en espèces (ticket ${tk.reference}) ?`)}>💵 Encaisser</button>
                  </div>
                ))}
              </div>
            </>
          )}

          <h2 className="adm-sous-titre">Paiements</h2>
          {d.paiements.length === 0 && <p className="adm-vide">Aucun paiement.</p>}
          <div className="adm-liste">
            {d.paiements.map((pa) => (
              <div className="adm-ligne" key={pa.id}>
                <span className="adm-ligne-texte">
                  <strong>{pa.reference} · {DA(pa.montant)} · {pa.moyen.toUpperCase()}</strong>
                  <small>
                    {pa.facture?.numero ? `Facture ${pa.facture.numero} · ` : ""}{pa.statut.replaceAll("_", " ")}
                    {pa.encaissePar ? ` · par ${pa.encaissePar}` : ""}
                    {pa.refFournisseur ? ` · réf. ${pa.refFournisseur}` : ""}
                    {pa.remboursements?.length ? ` · ${pa.remboursements.length} remboursement(s)` : ""}
                  </small>
                </span>
                <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {pa.moyen === "virement" && pa.statut === "EN_ATTENTE" && ["superadmin", "admin"].includes(role) && (
                    <>
                      <button className="adm-btn" onClick={() => action({ action: "virement.valider", paiementId: pa.id }, "Virement reçu et vérifié sur le compte bancaire ?")}>Valider</button>
                      <button className="adm-btn secondaire" onClick={() => action({ action: "virement.refuser", paiementId: pa.id })}>Refuser</button>
                    </>
                  )}
                  {["CONFIRME", "PARTIELLEMENT_REMBOURSE"].includes(pa.statut) && ["superadmin", "admin"].includes(role) && (
                    <button className="adm-btn secondaire" onClick={() => {
                      const montant = window.prompt(`Montant à rembourser (max ${pa.montant} DZD) :`);
                      if (!montant) return;
                      const motif = window.prompt("Motif du remboursement :");
                      if (!motif) return;
                      action({ action: "rembourser", paiementId: pa.id, montant, motif }, `Rembourser ${montant} DZD ?`);
                    }}>Rembourser</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ================= OFFRES : packs, devis, codes promo ================= */}
      {onglet === "offres" && d?.packs && (
        <>
          <h2 className="adm-sous-titre">Packs forfaitaires</h2>
          {superadmin && (
            <button className="adm-btn" style={{ marginBottom: 10 }} onClick={async () => {
              const nom = window.prompt("Nom du pack (ex. Pack Dialyse mensuel) :");
              if (!nom) return;
              const service = window.prompt("Service (transport / domicile / medicaments) :", "transport");
              const prix = window.prompt("Prix forfaitaire (DZD) :");
              if (!prix) return;
              const description = window.prompt("Description courte (affichée aux clients) :") || "";
              await action({ action: "pack.creer", nom, service, prix, description });
            }}>+ Nouveau pack</button>
          )}
          {d.packs.length === 0 && <p className="adm-vide">Aucun pack — créez vos offres phares (prix affichés au public).</p>}
          <div className="adm-liste">
            {d.packs.map((pk) => (
              <div className="adm-ligne" key={pk.id}>
                <span className="adm-ligne-texte">
                  <strong>{pk.nom} — {DA(pk.prix)}</strong>
                  <small>{pk.service} · ≈ {pk.dureeMin} min {pk.description ? `· ${pk.description}` : ""}{pk.actif ? "" : " · ⚪ désactivé"}</small>
                </span>
                {superadmin && (
                  <button className="adm-btn secondaire" onClick={() => action({ action: "pack.maj", id: pk.id, ...pk, actif: !pk.actif })}>
                    {pk.actif ? "Désactiver" : "Réactiver"}
                  </button>
                )}
              </div>
            ))}
          </div>

          <h2 className="adm-sous-titre">Demandes de devis</h2>
          {d.devis.length === 0 && <p className="adm-vide">Aucune demande de devis.</p>}
          <div className="adm-liste">
            {d.devis.map((dv) => (
              <div className={"adm-ligne" + (dv.statut === "NOUVEAU" ? " signale" : "")} key={dv.id}>
                <span className="adm-ligne-texte">
                  <strong>{dv.numero} · {dv.nom} · {dv.telephone}</strong>
                  <small>{dv.service || "service à préciser"} · {dv.besoin.slice(0, 90)}{dv.besoin.length > 90 ? "…" : ""}{dv.montant ? ` · chiffré ${DA(dv.montant)}` : ""}</small>
                </span>
                <span style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                  <span className="adm-pastille">{dv.statut}</span>
                  <button className="adm-btn secondaire" onClick={() => {
                    const montant = window.prompt("Montant proposé (DZD) :", dv.montant ? String(dv.montant) : "");
                    if (!montant) return;
                    const reponse = window.prompt("Détail de la proposition (affiché sur le devis) :", dv.reponse || "");
                    action({ action: "devis.chiffrer", id: dv.id, montant, reponse });
                  }}>Chiffrer</button>
                  {dv.montant && (
                    <a className="adm-btn secondaire" href={`/api/finances/document?type=devis&id=${dv.id}`} target="_blank" rel="noopener noreferrer"
                      onClick={async (e) => {
                        e.preventDefault();
                        const { supabase } = await import("@/lib/supabase");
                        const { data: { session } } = await supabase.auth.getSession();
                        const r = await fetch(`/api/finances/document?type=devis&id=${dv.id}`, { headers: { Authorization: `Bearer ${session?.access_token || ""}` } });
                        const html = await r.text();
                        const f = window.open("", "_blank");
                        if (f) { f.document.write(html); f.document.close(); }
                      }}>Imprimer</a>
                  )}
                </span>
              </div>
            ))}
          </div>

          <h2 className="adm-sous-titre">Codes promo</h2>
          {superadmin && (
            <button className="adm-btn" style={{ marginBottom: 10 }} onClick={async () => {
              const code = window.prompt("Code (ex. BIENVENUE10) :");
              if (!code) return;
              const choix = (window.prompt("Type : 1 = pourcentage · 2 = montant fixe (DZD) · 3 = GRATUIT (prestation offerte)", "1") || "1").trim();
              const type = choix === "2" ? "fixe" : choix === "3" ? "gratuit" : "pourcentage";
              let valeur = "100";
              if (type !== "gratuit") {
                valeur = window.prompt(type === "pourcentage" ? "Pourcentage (ex. 10) :" : "Montant (DZD) :");
                if (!valeur) return;
              }
              const service = type === "gratuit"
                ? window.prompt("Limiter à un service ? (transport = trajet offert, medicaments = livraison offerte, vide = tout)") || ""
                : window.prompt("Limiter à un service ? (transport / domicile / medicaments — vide = tous)") || "";
              const maxUsages = window.prompt("Nombre d'utilisations max (vide = illimité) :") || "";
              const cumulable = window.confirm("Autoriser le CUMUL avec d'autres bons ? (OK = oui)");
              await action({ action: "promo.creer", code, type, valeur, service, maxUsages, cumulable });
            }}>+ Nouveau code promo</button>
          )}
          <div className="adm-liste">
            {(d.promos || []).map((pr) => (
              <div className="adm-ligne" key={pr.id}>
                <span className="adm-ligne-texte">
                  <strong>{pr.code} — {pr.type === "gratuit" ? "GRATUIT" : pr.type === "pourcentage" ? `-${pr.valeur} %` : `-${DA(pr.valeur)}`}</strong>
                  <small>{pr.usages}{pr.maxUsages ? `/${pr.maxUsages}` : ""} utilisations · {pr.service || "tous services"}{pr.cumulable ? " · cumulable" : ""} · dès le {pr.debut}{pr.fin ? ` jusqu'au ${pr.fin}` : ""}{pr.actif ? "" : " · ⚪ désactivé"}</small>
                </span>
                {superadmin && pr.actif && (
                  <button className="adm-btn secondaire" onClick={() => action({ action: "promo.desactiver", id: pr.id })}>Désactiver</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ================= ÉTABLISSEMENTS (facturation mensuelle) ================= */}
      {onglet === "mensuel" && <SectionMensuel role={role} />}

      {/* ================= TARIFS ================= */}
      {onglet === "tarifs" && d?.tarifs && (
        <>
          <p className="adm-vide" style={{ textAlign: "start" }}>
            Tarifs EN VIGUEUR. Modifier crée une nouvelle version datée — les factures déjà émises ne changent jamais.
            {superadmin ? "" : " (modification réservée au super admin)"}
          </p>
          {superadmin && d.tarifs.length === 0 && (
            <button className="adm-btn" onClick={() => action({ action: "tarifs.installer" })}>Installer la grille de départ</button>
          )}
          <div className="adm-liste">
            {d.tarifs.map((tf) => (
              <div className="adm-ligne" key={tf.id}>
                <span className="adm-ligne-texte">
                  <strong>{tf.libelle} — {DA(tf.montant)}{tf.unite !== "prestation" ? ` / ${tf.unite}` : ""}</strong>
                  <small>{tf.categorie} · {tf.code} {tf.service ? `· service ${tf.service}` : ""} · depuis le {tf.debut}</small>
                </span>
                {superadmin && (
                  <button className="adm-btn secondaire" onClick={() => {
                    const montant = window.prompt(`Nouveau montant pour « ${tf.libelle} » (DZD) :`, String(tf.montant));
                    if (montant) action({ action: "tarif.version", id: tf.id, montant });
                  }}>Nouvelle version</button>
                )}
              </div>
            ))}
          </div>
          {superadmin && d.tarifs.length > 0 && (
            <button className="adm-btn secondaire" style={{ marginTop: 10 }} onClick={() => {
              const libelle = window.prompt("Libellé du nouveau tarif :");
              if (!libelle) return;
              const montant = window.prompt("Montant (DZD) :");
              if (!montant) return;
              const service = window.prompt("Service concerné (transport / domicile / medicaments — vide = tous) :") || null;
              action({ action: "tarif.creer", libelle, montant, service, categorie: service ? service : "supplement" });
            }}>+ Ajouter un tarif</button>
          )}
        </>
      )}

      {/* ================= REMISES ================= */}
      {onglet === "remises" && d?.remises && (
        <>
          <p className="adm-vide" style={{ textAlign: "start" }}>
            Remises personnalisées par client — appliquées automatiquement aux prochaines factures, jamais de prix négatif.
            Admin : max 20 % ou 2 000 DZD. Sans plafond : super admin uniquement.
          </p>
          {["superadmin", "admin"].includes(role) && <NouvelleRemise action={action} />}
          <div className="adm-liste">
            {d.remises.map((r) => (
              <div className="adm-ligne" key={r.id}>
                <span className="adm-ligne-texte">
                  <strong>{r.compte.nom || "—"} ({r.compte.numero}) · -{r.valeur}{r.type === "pourcentage" ? " %" : " DZD"}</strong>
                  <small>{r.motif} · {r.service || "tous services"} · du {r.debut}{r.fin ? ` au ${r.fin}` : ""} {r.plafond ? `· plafond ${DA(r.plafond)}` : ""} · par {r.auteur}</small>
                </span>
                {["superadmin", "admin"].includes(role) && (
                  <button className="adm-btn secondaire" onClick={() => action({ action: "remise.supprimer", id: r.id }, "Supprimer cette remise ?")}>Retirer</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ================= PLANS / ABONNEMENTS ================= */}
      {onglet === "plans" && d?.plans && (
        <>
          {superadmin && (
            <button className="adm-btn" style={{ marginBottom: 10 }} onClick={() => {
              const nom = window.prompt("Nom du plan (ex. ASM Sérénité, ASM Dialyse…) :");
              if (!nom) return;
              const prix = window.prompt("Prix par période (DZD) :");
              if (!prix) return;
              const description = window.prompt("Description (affichée sur la page publique) :") || "";
              const service = window.prompt("Service couvert (transport / domicile / medicaments — vide = tous) :") || "";
              const quantiteIncluse = window.prompt("Prestations incluses par mois (vide = illimité) :") || "";
              const reductionPct = window.prompt("Remise (%) sur les prestations NON incluses (vide = 0) :") || "";
              const populaire = window.confirm("Mettre ce plan en avant (« Le plus choisi ») ?");
              action({ action: "plan.creer", nom, prix, description, service, quantiteIncluse, reductionPct, populaire });
            }}>+ Créer un plan</button>
          )}
          <p className="fe-aide" style={{ marginTop: 0 }}>
            Les plans actifs sont affichés sur la page publique <b>/abonnements</b> ; la souscription
            en ligne crée une facture de première période et l&apos;abonnement s&apos;active à son paiement.
          </p>
          <h2 className="adm-sous-titre">Plans ({d.plans.length})</h2>
          <div className="adm-liste">
            {d.plans.map((pl) => (
              <div className="adm-ligne" key={pl.id}>
                <span className="adm-ligne-texte">
                  <strong>{pl.populaire ? "⭐ " : ""}{pl.nom} — {DA(pl.prix)} / {pl.frequence}</strong>
                  <small>
                    {pl.description || "—"} · {pl.service || "tous services"} ·{" "}
                    {pl.quantiteIncluse ? `${pl.quantiteIncluse} incluse(s)/mois` : "illimité"}
                    {pl.reductionPct ? ` · −${pl.reductionPct} % sur le reste` : ""} ·{" "}
                    {pl._count.souscriptions} souscription(s) · {pl.actif ? "actif" : "fermé"}
                  </small>
                </span>
                <span style={{ display: "flex", gap: 6 }}>
                  <button className="adm-btn secondaire" onClick={() => {
                    const numero = window.prompt("N° de compte client (ASM-CL-…) ou recherchez-le dans l'onglet Factures :");
                    if (!numero) return;
                    fetchAdmin(`/api/admin/finances?vue=comptes&q=${encodeURIComponent(numero)}`).then((r) => {
                      const compte = r.comptes?.[0];
                      if (!compte) return setMsg("Compte introuvable.");
                      action({ action: "souscription.creer", compteId: compte.id, planId: pl.id }, `Abonner ${compte.nom || compte.numero} au plan « ${pl.nom} » ?`);
                    });
                  }}>Abonner un client</button>
                  {superadmin && <button className="adm-btn secondaire" onClick={() => action({ action: "plan.maj", id: pl.id, nom: pl.nom, prix: pl.prix, actif: !pl.actif })}>{pl.actif ? "Fermer" : "Rouvrir"}</button>}
                </span>
              </div>
            ))}
          </div>
          <h2 className="adm-sous-titre">Souscriptions</h2>
          <div className="adm-liste">
            {d.souscriptions.map((s) => (
              <div className="adm-ligne" key={s.id}>
                <span className="adm-ligne-texte">
                  <strong>{s.compte.nom || "—"} ({s.compte.numero}) · {s.plan.nom} · {DA(s.prix)}</strong>
                  <small>{s.statut} · depuis le {s.debut} {s.derniereFacture ? `· dernier mois facturé : ${s.derniereFacture}` : ""}</small>
                </span>
                <span style={{ display: "flex", gap: 6 }}>
                  {s.statut === "ACTIF" && <button className="adm-btn secondaire" onClick={() => action({ action: "souscription.statut", id: s.id, statut: "SUSPENDU" })}>Suspendre</button>}
                  {s.statut === "SUSPENDU" && <button className="adm-btn secondaire" onClick={() => action({ action: "souscription.statut", id: s.id, statut: "ACTIF" })}>Réactiver</button>}
                  {s.statut !== "ANNULE" && <button className="adm-btn secondaire" onClick={() => action({ action: "souscription.statut", id: s.id, statut: "ANNULE" }, "Annuler cet abonnement ?")}>Annuler</button>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ================= TICKETS PRÉPAYÉS D'AGENCE ================= */}
      {onglet === "tickets" && d?.tickets && (
        <>
          <p className="fe-aide" style={{ marginTop: 0 }}>
            Un patient paie en agence → l&apos;agent lui remet un code → à la réservation, le code
            valide le paiement. Un ticket utilisé au maximum de ses usages devient inutilisable.
            Le ticket <b>ASM2026</b> est un ticket de TEST universel — à désactiver au lancement.
          </p>
          {superadmin && (
            <div className="adm-fiche" style={{ marginBottom: 12 }}>
              <strong>Interrupteurs (superadmin)</strong>
              <label className="case-ligne" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={!!d.simulation}
                  onChange={(e) =>
                    action(
                      { action: "reglage.paiementSimulation", actif: e.target.checked },
                      e.target.checked
                        ? "ACTIVER la SIMULATION de paiement par carte ? Aucun débit réel — chaque opération est étiquetée « simulation ». À désactiver dès qu'une vraie passerelle (SATIM/Chargily) est branchée."
                        : null
                    )
                  }
                />
                Simulation de paiement par carte (avant SATIM) — clairement étiquetée, aucun débit réel
              </label>
            </div>
          )}
          {superadmin && (
            <button className="adm-btn" style={{ marginBottom: 10 }} onClick={() => {
              const code = window.prompt("Code du ticket (4 à 30 caractères, ex. AG-0042) :");
              if (!code) return;
              const libelle = window.prompt("Libellé (ex. Payé agence Bir Mourad Raïs — M. Amrani) :") || "";
              const maxUsages = window.prompt("Nombre maximal d'utilisations :", "1") || "1";
              const services = window.prompt("Prestations autorisées (transport,domicile,medicaments — vide = toutes) :") || "";
              const expireLe = window.prompt("Date d'expiration (AAAA-MM-JJ — vide = sans) :") || "";
              action({ action: "ticket.creer", code, libelle, maxUsages, services, expireLe });
            }}>+ Créer un ticket</button>
          )}
          <div className="adm-liste">
            {d.tickets.map((tk) => (
              <div className={"adm-ligne" + (!tk.actif ? " signale" : "")} key={tk.id}>
                <span className="adm-ligne-texte">
                  <strong>
                    {tk.test ? "🧪 " : "🎟 "}{tk.code}
                    {tk.libelle ? ` — ${tk.libelle}` : ""}
                  </strong>
                  <small>
                    {tk.usages}/{tk.maxUsages} utilisé(s) · {tk.services || "toutes prestations"}
                    {tk.expireLe ? ` · expire le ${tk.expireLe}` : ""} · {tk.actif ? "actif" : "désactivé"}
                    {tk.utilisations.length > 0 ? ` · dernier usage : demande n°${tk.utilisations[0].demandeId}` : ""}
                  </small>
                </span>
                {superadmin && (
                  <span style={{ display: "flex", gap: 6 }}>
                    <button className="adm-btn secondaire" onClick={() =>
                      action({ action: "ticket.maj", id: tk.id, libelle: tk.libelle, services: tk.services, maxUsages: tk.maxUsages, expireLe: tk.expireLe, actif: !tk.actif })
                    }>
                      {tk.actif ? "Désactiver" : "Activer"}
                    </button>
                    <button className="adm-btn secondaire" onClick={() =>
                      action({ action: "ticket.supprimer", id: tk.id }, tk.usages > 0 ? `Ce ticket a déjà servi : il sera DÉSACTIVÉ (jamais supprimé, traçabilité). Continuer ?` : `Supprimer le ticket ${tk.code} ?`)
                    }>
                      Supprimer
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ================= POINTS DE PAIEMENT ================= */}
      {onglet === "points" && d?.points && (
        <>
          {["superadmin", "admin"].includes(role) && (
            <button className="adm-btn" style={{ marginBottom: 10 }} onClick={() => {
              const nom = window.prompt("Nom du point de paiement :");
              if (!nom) return;
              const adresse = window.prompt("Adresse :") || "";
              const commune = window.prompt("Commune :") || "";
              const horaires = window.prompt("Horaires (ex. Sam–Jeu 9h–17h) :") || "";
              action({ action: "point.creer", nom, adresse, commune, horaires });
            }}>+ Ajouter un point</button>
          )}
          {d.points.length === 0 && <p className="adm-vide">Aucun point de paiement. Les patients sont invités à vous appeler.</p>}
          <div className="adm-liste">
            {d.points.map((pt) => (
              <div className="adm-ligne" key={pt.id}>
                <span className="adm-ligne-texte">
                  <strong>{pt.nom} {pt.actif ? "" : "(inactif)"}</strong>
                  <small>{[pt.adresse, pt.commune].filter(Boolean).join(", ") || "—"} · {pt.horaires || "—"} · {pt.typePoint}</small>
                </span>
                {["superadmin", "admin"].includes(role) && (
                  <button className="adm-btn secondaire" onClick={() => action({ action: "point.maj", id: pt.id, nom: pt.nom, adresse: pt.adresse, commune: pt.commune, horaires: pt.horaires, typePoint: pt.typePoint, actif: !pt.actif })}>
                    {pt.actif ? "Désactiver" : "Activer"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ================= ÉVÉNEMENTS FOURNISSEURS ================= */}
      {onglet === "evenements" && d?.evenements && (
        <>
          <p className="adm-vide" style={{ textAlign: "start" }}>
            Webhooks reçus des fournisseurs de paiement (signature vérifiée, doublons ignorés).
          </p>
          {d.evenements.length === 0 && <p className="adm-vide">Aucun événement reçu — normal tant qu'aucun fournisseur en ligne n'est configuré.</p>}
          <div className="adm-liste">
            {d.evenements.map((e) => (
              <div className={"adm-ligne" + (e.statut === "ERREUR" ? " signale" : "")} key={e.id}>
                <span className="adm-ligne-texte">
                  <strong>{e.fournisseur} · {e.type}</strong>
                  <small>{e.evenementId} · {e.statut} {e.erreur ? `· ${e.erreur}` : ""} · {new Date(e.creeLe).toLocaleString("fr-FR")}</small>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// Création d'une facture : client (recherche) + réservation OU ligne libre.
function NouvelleFacture({ action, onFait }) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [comptes, setComptes] = useState(null);
  const [compte, setCompte] = useState(null);
  const [demandeId, setDemandeId] = useState("");
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");

  if (!ouvert) return <button className="adm-btn" onClick={() => setOuvert(true)}>+ Nouvelle facture</button>;
  return (
    <div className="adm-fiche" style={{ width: "100%", marginTop: 8 }}>
      <strong>Nouvelle facture</strong>
      {!compte ? (
        <>
          <div className="adm-filtres" style={{ marginTop: 8 }}>
            <input placeholder="Client : nom ou n° ASM-CL-…" value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchAdmin(`/api/admin/finances?vue=comptes&q=${encodeURIComponent(q)}`).then((r) => setComptes(r.comptes || []))} />
            <button className="adm-btn" onClick={() => fetchAdmin(`/api/admin/finances?vue=comptes&q=${encodeURIComponent(q)}`).then((r) => setComptes(r.comptes || []))}>Rechercher</button>
            <button className="adm-btn secondaire" onClick={() => setOuvert(false)}>Fermer</button>
          </div>
          <p className="adm-vide" style={{ textAlign: "start", padding: "6px 0" }}>
            Le compte financier d&apos;un client est créé automatiquement lors de sa première facture — recherchez-le d&apos;abord
            dans Clients si besoin, ou saisissez son n° ASM-CL.
          </p>
          {comptes?.length === 0 && <p className="adm-vide">Aucun compte financier trouvé (créez la facture depuis la fiche client, ou vérifiez le n°).</p>}
          <div className="adm-liste">
            {comptes?.map((c) => (
              <div className="adm-ligne cliquable" key={c.id} onClick={() => setCompte(c)}>
                <span className="adm-ligne-texte"><strong>{c.nom || "—"}</strong><small>{c.numero}</small></span>
                <span className="adm-pastille">Choisir</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: "8px 0" }}>Client : <strong>{compte.nom || compte.numero}</strong> ({compte.numero})</p>
          <div className="adm-grille-form">
            <input placeholder="N° de réservation (facturation auto au tarif)" value={demandeId} onChange={(e) => setDemandeId(e.target.value.replace(/\D/g, ""))} />
            <input placeholder="OU libellé libre (ex. Transport CHU 12/07)" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
            <input placeholder="Montant libre (DZD)" value={montant} onChange={(e) => setMontant(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="adm-btn" onClick={async () => {
              const corps = { action: "facture.creer", compteId: compte.id };
              if (demandeId) corps.demandeId = Number(demandeId);
              else if (libelle && montant) corps.lignes = [{ libelle, quantite: 1, prixUnitaire: Number(montant) }];
              else return;
              const r = await action(corps);
              if (r?.ok) { setOuvert(false); setCompte(null); onFait?.(); }
            }}>Émettre la facture</button>
            <button className="adm-btn secondaire" onClick={() => setCompte(null)}>← Changer de client</button>
          </div>
        </>
      )}
    </div>
  );
}

function NouvelleRemise({ action }) {
  return (
    <button className="adm-btn" style={{ marginBottom: 10 }} onClick={async () => {
      const numero = window.prompt("N° de compte client (ASM-CL-…) ou nom :");
      if (!numero) return;
      const r = await fetchAdmin(`/api/admin/finances?vue=comptes&q=${encodeURIComponent(numero)}`);
      const compte = r.comptes?.[0];
      if (!compte) return window.alert("Compte financier introuvable.");
      const type = window.confirm("OK = remise en POURCENTAGE · Annuler = remise FIXE (DZD)") ? "pourcentage" : "fixe";
      const valeur = window.prompt(type === "pourcentage" ? "Pourcentage (ex. 10) :" : "Montant fixe (DZD) :");
      if (!valeur) return;
      const motif = window.prompt("Motif (affiché sur la facture, ex. Remise fidélité ASM) :");
      if (!motif) return;
      action({ action: "remise.creer", compteId: compte.id, type, valeur, motif }, `Accorder -${valeur}${type === "pourcentage" ? " %" : " DZD"} à ${compte.nom || compte.numero} ?`);
    }}>+ Accorder une remise</button>
  );
}

// Finances établissement : facturation MENSUELLE groupée (une facture par
// mois regroupant toutes les prestations, une ligne par patient/prestation),
// mode de facturation par compte pro, relevé de compte imprimable.
function SectionMensuel({ role }) {
  const gestion = ["superadmin", "admin"].includes(role);
  const moisPrecedent = () => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  };
  const [mois, setMois] = useState(moisPrecedent);
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState("");
  const [occupe, setOccupe] = useState(false);

  async function charger(m = mois) {
    setD(null);
    try {
      setD(await fetchAdmin(`/api/admin/finances?vue=mensuel&mois=${m}`));
    } catch {
      setD({ erreur: true });
    }
  }
  useEffect(() => { charger(mois); }, [mois]); // eslint-disable-line

  async function agir(corps, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return;
    setMsg("");
    setOccupe(true);
    try {
      const r = await fetchAdmin("/api/admin/finances", { method: "POST", body: JSON.stringify(corps) });
      if (r.vide) setMsg("Rien à facturer sur ce mois" + (r.sansTarif ? ` (${r.sansTarif} prestation(s) sans tarif — à facturer manuellement)` : "") + ".");
      else if (r.deja) setMsg(`Facture mensuelle déjà émise : ${r.facture.numero}.`);
      else setMsg("Action effectuée ✓");
      await charger();
      return r;
    } catch (e) {
      setMsg("⚠ " + (e?.data?.erreur || "Action impossible (droits ?)"));
    } finally {
      setOccupe(false);
    }
  }

  function ouvrirDoc(type, id) {
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`/api/finances/document?type=${type}&id=${id}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      })
        .then((r) => r.text())
        .then((html) => {
          const f = window.open("", "_blank");
          if (f) { f.document.write(html); f.document.close(); }
        })
        .catch(() => {});
    });
  }

  return (
    <>
      <p className="adm-vide" style={{ textAlign: "start" }}>
        Facturation mensuelle des établissements : leurs prestations terminées ne sont pas facturées une à une,
        mais regroupées dans UNE facture par mois — une ligne par prestation, patient identifiable.
        Passez un compte en mode « mensuel » pour activer ce fonctionnement.
      </p>
      <div className="adm-filtres">
        <input type="month" value={mois} onChange={(e) => e.target.value && setMois(e.target.value)} max={new Date().toISOString().slice(0, 7)} />
        {gestion && (
          <button className="adm-btn" disabled={occupe} onClick={() =>
            agir({ action: "etablissements.facturer.tous", mois },
              `Générer les factures mensuelles de ${d?.moisLisible || mois} pour tous les établissements en mode mensuel ? (aucun doublon possible)`)
          }>🧾 Facturer tous les établissements — {d?.moisLisible || mois}</button>
        )}
      </div>
      {msg && <p className="adm-msg">{msg}</p>}
      {!d && <p className="adm-vide">Chargement…</p>}
      {d?.erreur && <p className="adm-vide">Impossible de charger.</p>}
      {d?.etablissements?.length === 0 && <p className="adm-vide">Aucun compte financier d&apos;établissement pour l&apos;instant (créé automatiquement à sa première réservation facturée).</p>}
      <div className="adm-liste">
        {d?.etablissements?.map(({ compte, aFacturer, patients, facture }) => (
          <div className="adm-ligne" key={compte.id}>
            <span className="adm-ligne-texte">
              <strong>{compte.nom || "—"} ({compte.numero})</strong>
              <small>
                Mode : {compte.modeFacturation === "mensuel" ? "mensuel (groupé)" : "à la prestation"}
                {" · "}{d.moisLisible} : {aFacturer} prestation(s) à facturer{patients ? ` · ${patients} patient(s)` : ""}
                {facture ? ` · facture ${facture.numero} — ${DA(facture.total)} (${facture.statut.replaceAll("_", " ")})` : ""}
              </small>
            </span>
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
              {gestion && (
                <button className="adm-btn secondaire" disabled={occupe} onClick={() =>
                  agir({ action: "compte.modeFacturation", compteId: compte.id, mode: compte.modeFacturation === "mensuel" ? "prestation" : "mensuel" },
                    compte.modeFacturation === "mensuel"
                      ? `Repasser ${compte.nom || compte.numero} en facturation à la prestation (facture automatique à chaque clôture) ?`
                      : `Passer ${compte.nom || compte.numero} en facturation MENSUELLE groupée ? (plus de facture à chaque clôture)`)
                }>{compte.modeFacturation === "mensuel" ? "→ à la prestation" : "→ mensuel"}</button>
              )}
              {gestion && aFacturer > 0 && !facture && (
                <button className="adm-btn" disabled={occupe} onClick={() =>
                  agir({ action: "etablissement.facturer", compteId: compte.id, mois },
                    `Émettre la facture ${d.moisLisible} de ${compte.nom || compte.numero} (${aFacturer} prestation(s), détail par patient) ?`)
                }>🧾 Facturer {d.moisLisible}</button>
              )}
              {facture && <button className="adm-btn secondaire" onClick={() => ouvrirDoc("facture", facture.id)}>Voir la facture</button>}
              <button className="adm-btn secondaire" onClick={() => ouvrirDoc("releve", compte.id)}>Relevé de compte</button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

export default function PageFinances() {
  return (
    <Suspense>
      <FinancesContenu />
    </Suspense>
  );
}
