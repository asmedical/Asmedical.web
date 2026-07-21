import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus, ROLES_GESTION_INTERVENANTS, ROLES_GESTION_EQUIPE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const LIB_SERVICE = { transport: "Transport", domicile: "Aide à domicile", medicaments: "Médicaments" };

// CSV « Excel français » : séparateur ; — BOM UTF-8 pour les accents.
function enCsv(lignes) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + lignes.map((l) => l.map(esc).join(";")).join("\r\n");
}

function reponseCsv(nom, lignes) {
  return new NextResponse(enCsv(lignes), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nom}"`,
    },
  });
}

// Même tableau, deux formats : CSV (par défaut) ou Excel réel (.xlsx)
// selon ?format=xlsx — généré sans dépendance (lib/xlsx).
async function repondre(nom, lignes, p) {
  if (p.get("format") === "xlsx") {
    const { classeurXlsx } = await import("@/lib/xlsx");
    return new NextResponse(classeurXlsx(lignes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nom.replace(/\.csv$/, ".xlsx")}"`,
      },
    });
  }
  return reponseCsv(nom, lignes);
}

// GET /api/admin/exports?type=demandes|clients|etablissements|paie&debut=&fin=
export async function GET(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_INTERVENANTS);
  if (!acces) return refus();
  try {
    const p = new URL(req.url).searchParams;
    const type = p.get("type") || "demandes";
    const debut = (p.get("debut") || "").slice(0, 10);
    const fin = (p.get("fin") || "").slice(0, 10);
    const periode = /^\d{4}-\d{2}-\d{2}$/.test(debut) && /^\d{4}-\d{2}-\d{2}$/.test(fin);

    // ---- Demandes / rendez-vous de la période ----
    if (type === "demandes") {
      if (!periode) return NextResponse.json({ erreur: "période invalide" }, { status: 400 });
      const where = { date: { gte: debut, lte: fin + "T23:59" } };
      if (p.get("service")) where.service = p.get("service");
      if (p.get("statut")) where.statut = p.get("statut");
      const demandes = await prisma.demande.findMany({
        where,
        orderBy: { date: "asc" },
        take: 5000,
        include: {
          soignant: { select: { prenom: true, nom: true } },
          transporteur: { select: { nom: true } },
          avis: { select: { note: true } },
        },
      });
      const lignes = [
        ["N°", "Date", "Heure", "Service", "Statut", "Client", "Téléphone", "Commune", "Départ", "Destination", "Durée (min)", "Fenêtre", "Intervenant", "Réservé par", "Prioritaire", "Créée le", "Avis (1-5)"],
        ...demandes.map((d) => [
          d.id, (d.date || "").slice(0, 10), (d.date || "").slice(11, 16),
          LIB_SERVICE[d.service] || d.service, d.statut, d.nom || "", d.telephone || "",
          d.commune || "", d.depart || "", d.destination || "", d.dureeMin || "",
          d.fenetre || "",
          d.soignant ? [d.soignant.prenom, d.soignant.nom].filter(Boolean).join(" ") : d.transporteur?.nom || "",
          d.parEtablissement || "", d.prioritaire ? "oui" : "", d.creeLe.toISOString().slice(0, 10),
          d.avis?.note || "",
        ]),
      ];
      await journaliser(acces.nomAffiche, "export.demandes", "export", 0, `${debut} → ${fin} (${demandes.length} lignes)`);
      return repondre(`asm-demandes-${debut}-${fin}.csv`, lignes, p);
    }

    // ---- Clients (patients) / établissements ----
    if (type === "clients" || type === "etablissements") {
      let requete = acces.admin
        .from("profil")
        .select("prenom, nom, etablissement, telephone, email, commune, contact, cree_le")
        .order("cree_le", { ascending: false })
        .limit(5000);
      if (type === "etablissements") requete = requete.eq("role", "pro");
      else requete = requete.or("role.eq.patient,role.is.null");
      const { data: profils, error } = await requete;
      if (error) throw error;
      const lignes =
        type === "etablissements"
          ? [
              ["Établissement", "Contact", "Téléphone", "Email", "Commune", "Inscrit le"],
              ...(profils || []).map((c) => [c.etablissement || "", c.contact || "", c.telephone || "", c.email || "", c.commune || "", (c.cree_le || "").slice(0, 10)]),
            ]
          : [
              ["Prénom", "Nom", "Téléphone", "Email", "Commune", "Contact famille", "Inscrit le"],
              ...(profils || []).map((c) => [c.prenom || "", c.nom || "", c.telephone || "", c.email || "", c.commune || "", c.contact || "", (c.cree_le || "").slice(0, 10)]),
            ];
      await journaliser(acces.nomAffiche, `export.${type}`, "export", 0, `${(profils || []).length} lignes`);
      return repondre(`asm-${type}.csv`, lignes, p);
    }

    // ---- Paie des intervenants (missions terminées de la période) ----
    if (type === "paie") {
      // Données de rémunération : réservé au SUPER ADMIN.
      const paieAcces = await verifierAdmin(req, ROLES_GESTION_EQUIPE);
      if (!paieAcces) return refus();
      if (!periode) return NextResponse.json({ erreur: "période invalide" }, { status: 400 });

      const [soignants, transporteurs, missions] = await Promise.all([
        prisma.soignant.findMany({ where: { statut: { in: ["VALIDE", "SUSPENDU"] } } }),
        prisma.transporteur.findMany({ where: { statut: { in: ["VALIDE", "SUSPENDU"] } } }),
        prisma.demande.findMany({
          where: { statut: "TERMINEE", date: { gte: debut, lte: fin + "T23:59" } },
          select: { soignantId: true, transporteurId: true, dureeMin: true },
        }),
      ]);

      const lignes = [["Intervenant", "Type", "Missions terminées", "Heures", "Rémunération", "Taux horaire (DA)", "Tarif mission (DA)", "Primes (DA)", "Retenues (DA)", "Montant estimé (DA)", "Notes"]];
      const ajouter = (fiche, genre) => {
        const faites = missions.filter((m) => (genre === "Soignant" ? m.soignantId === fiche.id : m.transporteurId === fiche.id));
        const heures = Math.round(faites.reduce((s, m) => s + (m.dureeMin || 60), 0) / 6) / 10;
        let montant = "";
        if (fiche.typeRemuneration === "horaire" && fiche.tauxHoraire) montant = Math.round(heures * fiche.tauxHoraire + (fiche.primes || 0) - (fiche.retenues || 0));
        else if (["mission", "forfait"].includes(fiche.typeRemuneration || "") && fiche.tarifMission) montant = Math.round(faites.length * fiche.tarifMission + (fiche.primes || 0) - (fiche.retenues || 0));
        lignes.push([
          genre === "Soignant" ? [fiche.prenom, fiche.nom].filter(Boolean).join(" ") : fiche.nom,
          genre, faites.length, heures, fiche.typeRemuneration || "", fiche.tauxHoraire || "",
          fiche.tarifMission || "", fiche.primes || "", fiche.retenues || "", montant, fiche.notesPaie || "",
        ]);
      };
      soignants.forEach((s) => ajouter(s, "Soignant"));
      transporteurs.forEach((t) => ajouter(t, "Transporteur"));

      await journaliser(acces.nomAffiche, "export.paie", "export", 0, `${debut} → ${fin}`);
      return repondre(`asm-paie-${debut}-${fin}.csv`, lignes, p);
    }

    // ---- Rapport d'activité imprimable (→ PDF via « Imprimer ») ----
    if (type === "rapport") {
      if (!["superadmin", "admin"].includes(acces.profil.role)) return refus();
      if (!periode) return NextResponse.json({ erreur: "période invalide" }, { status: 400 });

      const [demandes, factures, paiements] = await Promise.all([
        prisma.demande.findMany({
          where: { date: { gte: debut, lte: fin + "T23:59" } },
          select: { service: true, statut: true, commune: true, parEtablissement: true },
        }),
        prisma.facture.findMany({
          where: { emissionLe: { gte: debut, lte: fin }, statut: { not: "ANNULEE" } },
          select: { total: true, paye: true },
        }),
        prisma.paiement.findMany({
          where: {
            statut: { in: ["CONFIRME", "PARTIELLEMENT_REMBOURSE", "REMBOURSE"] },
            confirmeLe: { gte: new Date(debut + "T00:00:00"), lte: new Date(fin + "T23:59:59") },
          },
          select: { montant: true, moyen: true },
        }),
      ]);

      const parService = {};
      const communes = {};
      let terminees = 0, annulees = 0, parEtab = 0;
      for (const d of demandes) {
        const s = LIB_SERVICE[d.service] || d.service;
        parService[s] = parService[s] || { total: 0, terminees: 0, annulees: 0 };
        parService[s].total++;
        if (d.statut === "TERMINEE") { parService[s].terminees++; terminees++; }
        if (d.statut === "ANNULEE") { parService[s].annulees++; annulees++; }
        if (d.parEtablissement) parEtab++;
        const c = String(d.commune || "").trim();
        if (c && d.statut !== "ANNULEE") communes[c] = (communes[c] || 0) + 1;
      }
      const caFacture = factures.reduce((s, f) => s + f.total, 0);
      const encaisse = paiements.reduce((s, x) => s + x.montant, 0);
      const parMoyen = {};
      for (const x of paiements) parMoyen[x.moyen] = (parMoyen[x.moyen] || 0) + x.montant;
      const topCommunes = Object.entries(communes).sort((a, b) => b[1] - a[1]).slice(0, 8);

      const DA = (n) => `${Number(n || 0).toLocaleString("fr-FR")} DZD`;
      const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
      const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Rapport d'activité ASM — ${debut} → ${fin}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;color:#22332C;max-width:760px;margin:24px auto;padding:0 18px;font-size:14px}
  h1{font-size:20px;color:#0A5230;border-bottom:3px solid #0E6B3F;padding-bottom:10px}
  h2{font-size:15px;color:#0A5230;margin-top:22px}
  table{border-collapse:collapse;width:100%;margin:10px 0}
  th,td{border:1px solid #E6EEE9;padding:7px 10px;text-align:left}
  th{background:#F4F9F6;color:#0A5230}
  .tuiles{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}
  .tuile{border:1px solid #E6EEE9;border-radius:10px;padding:10px 14px;min-width:130px}
  .tuile b{display:block;font-size:19px;color:#0A5230}
  .pied{margin-top:26px;color:#6B7A72;font-size:12px}
  @media print{.no-print{display:none}}
</style></head><body>
<h1>ASM — Rapport d'activité · ${debut} → ${fin}</h1>
<div class="tuiles">
  <div class="tuile"><b>${demandes.length}</b>demandes</div>
  <div class="tuile"><b>${terminees}</b>terminées</div>
  <div class="tuile"><b>${annulees}</b>annulées</div>
  <div class="tuile"><b>${parEtab}</b>réservées par des établissements</div>
  <div class="tuile"><b>${DA(caFacture)}</b>facturé</div>
  <div class="tuile"><b>${DA(encaisse)}</b>encaissé</div>
</div>
<h2>Activité par service</h2>
<table><tr><th>Service</th><th>Demandes</th><th>Terminées</th><th>Annulées</th></tr>
${Object.entries(parService).map(([s, v]) => `<tr><td>${esc(s)}</td><td>${v.total}</td><td>${v.terminees}</td><td>${v.annulees}</td></tr>`).join("")}
</table>
<h2>Encaissements par moyen de paiement</h2>
<table><tr><th>Moyen</th><th>Montant</th></tr>
${Object.entries(parMoyen).map(([m, v]) => `<tr><td>${esc(m.toUpperCase())}</td><td>${DA(v)}</td></tr>`).join("") || "<tr><td colspan=2>Aucun encaissement sur la période.</td></tr>"}
</table>
<h2>Communes les plus servies</h2>
<table><tr><th>Commune</th><th>Demandes</th></tr>
${topCommunes.map(([c, n]) => `<tr><td>${esc(c)}</td><td>${n}</td></tr>`).join("") || "<tr><td colspan=2>Communes non renseignées.</td></tr>"}
</table>
<p class="pied">Généré le ${new Date().toLocaleString("fr-FR")} par ${esc(acces.nomAffiche)} — chiffres réels de la base ASM.
<button class="no-print" onclick="window.print()" style="margin-inline-start:12px">🖨 Imprimer / PDF</button></p>
</body></html>`;
      await journaliser(acces.nomAffiche, "export.rapport", "export", 0, `${debut} → ${fin}`);
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // ═══════════ Exports FINANCIERS (superadmin / admin) ═══════════
    if (["encaissements", "impayes", "especes"].includes(type)) {
      if (!["superadmin", "admin"].includes(acces.profil.role)) return refus();
      const { marquerRetards } = await import("@/lib/finances");
      await marquerRetards();
      const comptesParId = async (ids) => {
        const comptes = await prisma.compteFinancier.findMany({ where: { id: { in: [...new Set(ids)] } } });
        return Object.fromEntries(comptes.map((c) => [c.id, c]));
      };

      // ---- Encaissements : tous les paiements CONFIRMÉS de la période ----
      if (type === "encaissements") {
        if (!periode) return NextResponse.json({ erreur: "période invalide" }, { status: 400 });
        const where = {
          statut: { in: ["CONFIRME", "PARTIELLEMENT_REMBOURSE", "REMBOURSE"] },
          confirmeLe: { gte: new Date(debut + "T00:00:00"), lte: new Date(fin + "T23:59:59") },
        };
        if (p.get("moyen")) where.moyen = p.get("moyen");
        const paiements = await prisma.paiement.findMany({
          where, orderBy: { confirmeLe: "asc" }, take: 5000,
          include: { facture: { select: { numero: true } }, remboursements: true },
        });
        const comptes = await comptesParId(paiements.map((pa) => pa.compteId));
        const lignes = [["Reçu", "Date", "Heure", "Client", "N° compte", "Facture", "Moyen", "Fournisseur", "Réf. fournisseur", "Encaissé par", "Montant (DA)", "Remboursé (DA)", "Net (DA)"]];
        let totalMontant = 0, totalRembourse = 0;
        for (const pa of paiements) {
          const rembourse = pa.remboursements.filter((r) => r.statut !== "REFUSE").reduce((s, r) => s + r.montant, 0);
          totalMontant += pa.montant;
          totalRembourse += rembourse;
          const c = comptes[pa.compteId];
          lignes.push([
            pa.reference, pa.confirmeLe.toISOString().slice(0, 10), pa.confirmeLe.toISOString().slice(11, 16),
            c?.nom || "", c?.numero || "", pa.facture?.numero || "", pa.moyen.toUpperCase(), pa.fournisseur || "",
            pa.refFournisseur || "", pa.encaissePar || "", pa.montant, rembourse || "", pa.montant - rembourse,
          ]);
        }
        lignes.push(["TOTAL", "", "", "", "", "", "", "", "", "", totalMontant, totalRembourse || "", totalMontant - totalRembourse]);
        await journaliser(acces.nomAffiche, "export.encaissements", "export", 0, `${debut} → ${fin} (${paiements.length} paiements · ${totalMontant} DZD)`);
        return repondre(`asm-encaissements-${debut}-${fin}.csv`, lignes, p);
      }

      // ---- Impayés : PHOTO DU JOUR de tout le restant dû (sans période) ----
      if (type === "impayes") {
        const factures = await prisma.facture.findMany({
          where: { statut: { in: ["EMISE", "PARTIELLEMENT_PAYEE", "EN_RETARD"] } },
          orderBy: { echeance: "asc" }, take: 5000,
          include: { relances: true },
        });
        const comptes = await comptesParId(factures.map((f) => f.compteId));
        const jour = new Date().toISOString().slice(0, 10);
        const lignes = [["Facture", "Client", "N° compte", "Téléphone", "Émise le", "Échéance", "Jours de retard", "Total (DA)", "Payé (DA)", "Restant dû (DA)", "Relances envoyées", "Statut"]];
        let totalDu = 0;
        for (const f of factures) {
          const du = f.total - f.paye;
          if (du <= 0) continue;
          totalDu += du;
          const retard = f.echeance < jour ? Math.round((new Date(jour) - new Date(f.echeance)) / 86400000) : 0;
          const c = comptes[f.compteId];
          lignes.push([
            f.numero, c?.nom || "", c?.numero || "", c?.telFacturation || "", f.emissionLe, f.echeance,
            retard || "", f.total, f.paye || "", du, f.relances.length || "", f.statut.replaceAll("_", " "),
          ]);
        }
        lignes.push(["TOTAL", "", "", "", "", "", "", "", "", totalDu, "", ""]);
        await journaliser(acces.nomAffiche, "export.impayes", "export", 0, `photo du ${jour} (${lignes.length - 2} factures · ${totalDu} DZD dus)`);
        return repondre(`asm-impayes-${jour}.csv`, lignes, p);
      }

      // ---- Espèces : journal de caisse de la période (réconciliation) ----
      if (type === "especes") {
        if (!periode) return NextResponse.json({ erreur: "période invalide" }, { status: 400 });
        const paiements = await prisma.paiement.findMany({
          where: {
            moyen: "especes", statut: { in: ["CONFIRME", "PARTIELLEMENT_REMBOURSE", "REMBOURSE"] },
            confirmeLe: { gte: new Date(debut + "T00:00:00"), lte: new Date(fin + "T23:59:59") },
          },
          orderBy: { confirmeLe: "asc" }, take: 5000,
          include: { facture: { select: { numero: true } } },
        });
        const [comptes, tickets, points] = await Promise.all([
          comptesParId(paiements.map((pa) => pa.compteId)),
          prisma.ticketEspeces.findMany({ where: { statut: "PAYE", factureId: { in: paiements.map((pa) => pa.factureId).filter(Boolean) } } }),
          prisma.pointPaiement.findMany({}),
        ]);
        const ticketParFacture = Object.fromEntries(tickets.map((t) => [t.factureId, t]));
        const pointParId = Object.fromEntries(points.map((pt) => [pt.id, pt]));
        const lignes = [["Date", "Heure", "Reçu", "Ticket", "Client", "N° compte", "Facture", "Encaissé par", "Point de paiement", "Montant (DA)"]];
        let total = 0;
        for (const pa of paiements) {
          total += pa.montant;
          const c = comptes[pa.compteId];
          lignes.push([
            pa.confirmeLe.toISOString().slice(0, 10), pa.confirmeLe.toISOString().slice(11, 16),
            pa.reference, ticketParFacture[pa.factureId]?.reference || "", c?.nom || "", c?.numero || "",
            pa.facture?.numero || "", pa.encaissePar || "", pointParId[pa.pointId]?.nom || "", pa.montant,
          ]);
        }
        lignes.push(["TOTAL", "", "", "", "", "", "", "", "", total]);
        await journaliser(acces.nomAffiche, "export.especes", "export", 0, `${debut} → ${fin} (${paiements.length} encaissements · ${total} DZD)`);
        return repondre(`asm-especes-${debut}-${fin}.csv`, lignes, p);
      }
    }

    return NextResponse.json({ erreur: "type inconnu" }, { status: 400 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
