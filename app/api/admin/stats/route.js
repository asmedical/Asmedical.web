import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, refus } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Tableau de bord : compteurs réels (aucune donnée inventée).
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const maintenant = new Date().toISOString().slice(0, 16);

    const [
      aRappeler, duJour, prioritaires, enCours, enRetard, nonConfirmees, problemes,
      soignantsAttente, transporteursAttente, soignantsActifs, transporteursActifs,
      comptesSoignants, comptesTransporteurs, abonnementsActifs, messagesNonLus, dernieres,
    ] = await Promise.all([
      prisma.demande.count({ where: { statut: "A_RAPPELER" } }),
      prisma.demande.count({ where: { date: { startsWith: aujourdhui }, statut: { not: "ANNULEE" } } }),
      prisma.demande.count({ where: { prioritaire: true, statut: { notIn: ["TERMINEE", "ANNULEE"] } } }),
      prisma.demande.count({ where: { statut: "EN_COURS" } }),
      prisma.demande.count({ where: { date: { lt: maintenant }, statut: { notIn: ["TERMINEE", "ANNULEE", "ABSENT"] } } }),
      prisma.demande.count({ where: { AND: [{ OR: [{ soignantId: { not: null } }, { transporteurId: { not: null } }] }, { accepteeLe: null }, { statut: { in: ["AFFECTEE", "CONFIRMEE"] } }] } }),
      prisma.demande.count({ where: { problemeLe: { not: null }, statut: { notIn: ["TERMINEE", "ANNULEE"] } } }),
      prisma.soignant.count({ where: { statut: "EN_ATTENTE" } }),
      prisma.transporteur.count({ where: { statut: "EN_ATTENTE" } }),
      prisma.soignant.count({ where: { statut: "VALIDE" } }),
      prisma.transporteur.count({ where: { statut: "VALIDE" } }),
      prisma.soignant.count({ where: { userId: { not: null } } }),
      prisma.transporteur.count({ where: { userId: { not: null } } }),
      prisma.abonnement.count({ where: { statut: "ACTIF" } }),
      prisma.message.count({ where: { deEquipe: false, luParEquipe: false } }),
      prisma.demande.findMany({ orderBy: { creeLe: "desc" }, take: 5 }),
    ]);

    // Nombre de clients (profils) via Supabase
    let clients = null;
    try {
      const { count } = await acces.admin
        .from("profil")
        .select("id", { count: "exact", head: true });
      clients = count;
    } catch {}

    return NextResponse.json({
      aRappeler,
      duJour,
      prioritaires,
      enCours,
      enRetard,
      nonConfirmees,
      problemes,
      soignantsAttente,
      transporteursAttente,
      soignantsActifs,
      transporteursActifs,
      comptesEmployes: comptesSoignants + comptesTransporteurs,
      abonnementsActifs,
      messagesNonLus,
      clients,
      dernieres,
    });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
