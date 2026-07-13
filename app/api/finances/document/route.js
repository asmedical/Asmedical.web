import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { verifierAdmin } from "@/lib/adminAuth";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

// GET /api/finances/document?type=facture|recu|ticket&id=…
// Document HTML imprimable (→ PDF via « Imprimer / Enregistrer en PDF »).
// Accès : le PROPRIÉTAIRE du document, ou un membre du staff.
// Distinction stricte : facture ≠ ticket de paiement ≠ reçu.

async function proprietaire(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user } } = await admin.auth.getUser(token);
  return user || null;
}

const DA = (n) => `${Number(n || 0).toLocaleString("fr-FR")} DZD`;

function page(titre, corps) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${titre}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;color:#22332C;max-width:760px;margin:24px auto;padding:0 18px;font-size:14px}
  .tete{display:flex;align-items:center;gap:14px;border-bottom:3px solid #0E6B3F;padding-bottom:14px;margin-bottom:18px}
  .tete img{width:64px;height:64px;border-radius:50%}
  .tete h1{font-size:20px;color:#0A5230;margin:0}
  .tete small{color:#6B7A72}
  table{border-collapse:collapse;width:100%;margin:12px 0}
  th,td{border:1px solid #E6EEE9;padding:8px 10px;text-align:left}
  th{background:#F4F9F6;color:#0A5230}
  .tot td{font-weight:800}
  .badge{display:inline-block;border-radius:99px;padding:3px 12px;font-weight:800;font-size:12px;background:#E7F3EC;color:#0A5230}
  .badge.ko{background:#FBEBEB;color:#A33B3B}
  .avert{border:1.5px solid #C9A24B;background:#FBF3E1;border-radius:10px;padding:10px 14px;margin:14px 0;font-weight:700;color:#8a6d2c}
  .grille{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin:10px 0}
  .grille b{color:#0A5230}
  .qr{text-align:center;margin:16px 0}
  .qr img{width:180px;height:180px}
  .pied{margin-top:26px;border-top:1px solid #E6EEE9;padding-top:10px;color:#6B7A72;font-size:12px;text-align:center}
  @media print{.no-print{display:none}}
  .no-print{text-align:center;margin:18px 0}
  .no-print button{background:#0E6B3F;color:#fff;border:none;border-radius:10px;padding:12px 22px;font-size:15px;font-weight:800;cursor:pointer}
</style></head><body>
<div class="tete"><img src="/logo-asm.jpg" alt="ASM"><div><h1>ASM — Assistance Sociale Médicale</h1><small>asm-sante.com · Bir Mourad Raïs, Alger · +33 6 65 39 05 04</small></div></div>
${corps}
<div class="no-print"><button onclick="window.print()">🖨 Imprimer / Enregistrer en PDF</button></div>
<div class="pied">Document généré par la plateforme ASM — vérifiable auprès de nos services avec sa référence.</div>
</body></html>`;
}

export async function GET(req) {
  try {
    const p = new URL(req.url).searchParams;
    const type = p.get("type");
    const id = Number(p.get("id"));
    if (!type || !id) return NextResponse.json({ erreur: "paramètres" }, { status: 400 });

    // Autorisation : staff OU propriétaire.
    const acces = await verifierAdmin(req);
    const user = acces ? null : await proprietaire(req);
    if (!acces && !user) return NextResponse.json({ erreur: "non autorisé" }, { status: 401 });

    const monCompte = user ? await prisma.compteFinancier.findUnique({ where: { userId: user.id } }) : null;
    const possede = (compteId) => acces || (monCompte && monCompte.id === compteId);

    if (type === "facture") {
      const f = await prisma.facture.findUnique({ where: { id }, include: { lignes: true, compte: true, paiements: true } });
      if (!f || !possede(f.compteId)) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
      const lignes = f.lignes.map((l) =>
        `<tr><td>${l.libelle}</td><td>${l.quantite}</td><td>${DA(l.prixUnitaire)}</td><td>${DA(l.montant)}</td></tr>`).join("");
      const corps = `
<h2>Facture ${f.numero}</h2>
<div class="grille">
  <span><b>Client :</b> ${f.compte.nom || "—"} (${f.compte.numero})</span>
  <span><b>Statut :</b> <span class="badge${["EN_RETARD", "ANNULEE"].includes(f.statut) ? " ko" : ""}">${f.statut.replaceAll("_", " ")}</span></span>
  <span><b>Émise le :</b> ${f.emissionLe}</span>
  <span><b>Échéance :</b> ${f.echeance}</span>
  ${f.demandeId ? `<span><b>Réservation :</b> n°${f.demandeId}</span>` : ""}
</div>
<table><thead><tr><th>Prestation</th><th>Qté</th><th>Prix unitaire</th><th>Montant</th></tr></thead>
<tbody>${lignes}
<tr><td colspan="3">Sous-total</td><td>${DA(f.sousTotal)}</td></tr>
${f.remiseTotal ? `<tr><td colspan="3">Réduction — ${f.remiseDetail || ""}</td><td>-${DA(f.remiseTotal)}</td></tr>` : ""}
<tr class="tot"><td colspan="3">TOTAL</td><td>${DA(f.total)}</td></tr>
<tr><td colspan="3">Déjà payé</td><td>${DA(f.paye)}</td></tr>
<tr class="tot"><td colspan="3">Reste à payer</td><td>${DA(f.total - f.paye)}</td></tr>
</tbody></table>
${f.notes ? `<p><b>Notes :</b> ${f.notes}</p>` : ""}`;
      return new NextResponse(page(`Facture ${f.numero}`, corps), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    if (type === "recu") {
      const pa = await prisma.paiement.findUnique({ where: { id }, include: { facture: true } });
      if (!pa || !possede(pa.compteId)) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
      if (pa.statut === "EN_ATTENTE" || pa.statut === "ECHOUE") {
        return NextResponse.json({ erreur: "paiement non confirmé — pas de reçu" }, { status: 400 });
      }
      const compte = await prisma.compteFinancier.findUnique({ where: { id: pa.compteId } });
      const corps = `
<h2>Reçu de paiement ${pa.reference}</h2>
<div class="grille">
  <span><b>Client :</b> ${compte?.nom || "—"} (${compte?.numero})</span>
  <span><b>Statut :</b> <span class="badge">${pa.statut.replaceAll("_", " ")}</span></span>
  <span><b>Montant :</b> ${DA(pa.montant)}</span>
  <span><b>Moyen :</b> ${pa.moyen.toUpperCase()}</span>
  <span><b>Date :</b> ${pa.confirmeLe ? new Date(pa.confirmeLe).toLocaleString("fr-FR") : "—"}</span>
  ${pa.facture ? `<span><b>Facture :</b> ${pa.facture.numero}</span>` : ""}
  ${pa.encaissePar ? `<span><b>Encaissé par :</b> ${pa.encaissePar}</span>` : ""}
  ${pa.refFournisseur ? `<span><b>Réf. fournisseur :</b> ${pa.refFournisseur}</span>` : ""}
</div>
<p>ASM confirme avoir reçu ce paiement. Merci de votre confiance.</p>`;
      return new NextResponse(page(`Reçu ${pa.reference}`, corps), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    if (type === "ticket") {
      const t = await prisma.ticketEspeces.findUnique({ where: { id }, include: { facture: true } });
      if (!t || !possede(t.compteId)) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
      const compte = await prisma.compteFinancier.findUnique({ where: { id: t.compteId } });
      const points = await prisma.pointPaiement.findMany({ where: { actif: true }, take: 6 });
      const base = process.env.NEXT_PUBLIC_SITE_URL || "https://asm-sante.com";
      const qr = await QRCode.toDataURL(`${base}/admin/finances?ticket=${t.jeton}`, { margin: 1, width: 360 });
      const corps = `
<h2>Ticket de paiement en espèces</h2>
<div class="avert">⚠ Ce document n'est PAS un reçu de paiement. Il permet de payer en espèces à un point autorisé.</div>
<div class="grille">
  <span><b>Référence :</b> ${t.reference}</span>
  <span><b>Statut :</b> <span class="badge${t.statut !== "EN_ATTENTE" ? " ko" : ""}">${t.statut.replaceAll("_", " ")}</span></span>
  <span><b>Client :</b> ${compte?.nom || "—"} (${compte?.numero})</span>
  <span><b>Montant à payer :</b> ${DA(t.montant)}</span>
  <span><b>Facture :</b> ${t.facture.numero}</span>
  <span><b>Valable jusqu'au :</b> ${new Date(t.expireLe).toLocaleDateString("fr-FR")}</span>
</div>
<div class="qr"><img src="${qr}" alt="QR"><br><small>À présenter au personnel — vérification sécurisée</small></div>
<h3>Points de paiement</h3>
<table><thead><tr><th>Point</th><th>Adresse</th><th>Horaires</th></tr></thead><tbody>
${points.map((pt) => `<tr><td>${pt.nom}</td><td>${[pt.adresse, pt.commune].filter(Boolean).join(", ") || "—"}</td><td>${pt.horaires || "—"}</td></tr>`).join("") || "<tr><td colspan=3>Contactez-nous : +33 6 65 39 05 04</td></tr>"}
</tbody></table>
<p><b>Consignes :</b> présentez ce ticket (écran ou papier). Après encaissement, votre reçu officiel sera disponible dans votre espace « Paiements ».</p>`;
      return new NextResponse(page(`Ticket ${t.reference}`, corps), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    return NextResponse.json({ erreur: "type inconnu" }, { status: 400 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
