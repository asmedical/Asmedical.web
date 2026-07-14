"use client";
import { useState } from "react";
import Link from "next/link";

// Suppression de compte et de données — page PUBLIQUE exigée par Google
// Play. Le client demande ici ; l'équipe vérifie l'identité puis le super
// admin valide la suppression (rien n'est effacé automatiquement).

export default function SuppressionCompte() {
  const [f, setF] = useState({ nom: "", telephone: "", email: "", motif: "" });
  const [etat, setEtat] = useState(""); // "", "envoi", "ok", ou message d'erreur

  async function envoyer(e) {
    e.preventDefault();
    setEtat("envoi");
    try {
      const r = await fetch("/api/suppression-compte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erreur || "Envoi impossible.");
      setEtat("ok");
    } catch (err) {
      setEtat(String(err.message || "Envoi impossible."));
    }
  }

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 720 }}>
        <h2 className="titre-page">Supprimer mon compte et mes données</h2>
        <p className="sous-page">
          ASM — Assistance Sociale Médicale
          <br />
          <span dir="rtl" lang="ar">يمكنكم طلب حذف حسابكم وبياناتكم في أي وقت عبر هذه الصفحة.</span>
        </p>

        <section style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 8 }}>Ce qui se passe après votre demande</h3>
          <ul style={{ paddingInlineStart: 20, lineHeight: 1.7 }}>
            <li>Notre équipe vérifie votre identité (rappel au numéro indiqué) puis valide la suppression — <strong>sous 30 jours au maximum</strong>.</li>
            <li>Sont supprimés : vos identifiants de connexion, votre profil, vos documents transmis (ordonnances, photos) et vos préférences.</li>
            <li>Sont conservées uniquement les données que la loi nous impose de garder (factures et justificatifs comptables), sans accès applicatif.</li>
            <li>La suppression est <strong>définitive</strong> : votre historique ne pourra pas être restauré.</li>
          </ul>
        </section>

        {etat === "ok" ? (
          <div className="fin-bulle ok" style={{ marginBottom: 18 }}>
            <strong>Demande bien reçue ✓</strong>
            <span>Nous vous contacterons au numéro indiqué pour confirmer, puis votre compte sera supprimé (30 jours maximum).</span>
          </div>
        ) : (
          <form onSubmit={envoyer}>
            <div className="champ">
              <label>Nom et prénom *</label>
              <input required value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} placeholder="Ex. Ali Benali" />
            </div>
            <div className="champ">
              <label>Numéro de téléphone du compte *</label>
              <input required inputMode="tel" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} placeholder="Ex. 0550 12 34 56" />
            </div>
            <div className="champ">
              <label>Email (facultatif)</label>
              <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Pour vous répondre par écrit" />
            </div>
            <div className="champ">
              <label>Raison (facultatif)</label>
              <textarea rows={3} value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} placeholder="Aidez-nous à nous améliorer" />
            </div>
            <button className="btn-action" disabled={etat === "envoi"} type="submit">
              {etat === "envoi" ? "Envoi…" : "Demander la suppression de mon compte"}
            </button>
            {etat && etat !== "envoi" && etat !== "ok" && <p className="erreur">{etat}</p>}
          </form>
        )}

        <section style={{ marginTop: 18 }}>
          <h3 style={{ marginBottom: 8 }}>Autres moyens</h3>
          <p style={{ lineHeight: 1.7 }}>
            Vous pouvez aussi nous écrire à <a href="mailto:contact@asm-sante.com">contact@asm-sante.com</a> ou
            nous appeler au <a href="tel:+33665390504">+33 6 65 39 05 04</a> (7j/7). Pour en savoir plus sur nos
            pratiques : <Link href="/confidentialite">politique de confidentialité</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
