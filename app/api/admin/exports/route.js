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
      return reponseCsv(`asm-demandes-${debut}-${fin}.csv`, lignes);
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
      return reponseCsv(`asm-${type}.csv`, lignes);
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
      return reponseCsv(`asm-paie-${debut}-${fin}.csv`, lignes);
    }

    return NextResponse.json({ erreur: "type inconnu" }, { status: 400 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
