import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, refus } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Recherche GLOBALE du centre de gestion : patients, établissements,
// soignants, transporteurs et demandes — par nom, téléphone (espaces
// tolérés), email, commune ou n° de demande. Résultats groupés.
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const brut = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 80);
    if (brut.length < 2) return NextResponse.json({ resultats: null });

    // Neutralise les caractères spéciaux du filtre PostgREST (séparateurs
    // de conditions) pour que la saisie ne puisse pas modifier la requête.
    const q = brut.replace(/[,()]/g, " ").trim();
    const chiffres = brut.replace(/[\s.\-()]/g, "").replace(/^\+/, "");
    const estNumero = /^\d{2,}$/.test(chiffres);
    const numDemande = /^#?(\d{1,8})$/.exec(brut.replace("n°", "").trim());

    // Profils (patients + établissements) via Supabase.
    let clients = [];
    let etablissements = [];
    try {
      let req1 = acces.admin
        .from("profil")
        .select("id, role, prenom, nom, telephone, email, commune, etablissement")
        .limit(12);
      req1 = estNumero
        ? req1.ilike("telephone", `%${chiffres}%`)
        : req1.or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,email.ilike.%${q}%,etablissement.ilike.%${q}%,commune.ilike.%${q}%`);
      const { data } = await req1;
      for (const p of data || []) {
        if (p.role === "pro") etablissements.push(p);
        else if (!p.role || p.role === "patient") clients.push(p);
      }
    } catch {}

    // Intervenants + demandes via Prisma. Pour les numéros, on compare les
    // CHIFFRES normalisés des deux côtés (espaces/points/tirets tolérés,
    // que le numéro soit stocké avec ou sans espaces).
    const norm = (t) => String(t || "").replace(/\D/g, "");
    const parTel = (liste) => liste.filter((x) => norm(x.telephone).includes(chiffres)).slice(0, 5);

    let soignants, transporteurs, demandes;
    if (estNumero || numDemande) {
      const [tousS, tousT, recentes, parId] = await Promise.all([
        prisma.soignant.findMany({ take: 300, select: { id: true, prenom: true, nom: true, telephone: true, statut: true, photoUrl: true } }),
        prisma.transporteur.findMany({ take: 300, select: { id: true, nom: true, telephone: true, statut: true, photoUrl: true } }),
        prisma.demande.findMany({ orderBy: { creeLe: "desc" }, take: 400, select: { id: true, service: true, nom: true, telephone: true, date: true, statut: true } }),
        numDemande
          ? prisma.demande.findMany({ where: { id: Number(numDemande[1]) }, select: { id: true, service: true, nom: true, telephone: true, date: true, statut: true } })
          : Promise.resolve([]),
      ]);
      soignants = parTel(tousS);
      transporteurs = parTel(tousT);
      const parNum = recentes.filter((d) => norm(d.telephone).includes(chiffres)).slice(0, 6);
      // n° de demande d'abord, puis correspondances téléphone (dédupliquées).
      demandes = [...parId, ...parNum.filter((d) => !parId.some((x) => x.id === d.id))].slice(0, 6);
    } else {
      [soignants, transporteurs, demandes] = await Promise.all([
        prisma.soignant.findMany({
          where: { OR: [{ nom: { contains: q, mode: "insensitive" } }, { prenom: { contains: q, mode: "insensitive" } }, { communes: { contains: q, mode: "insensitive" } }] },
          take: 5,
          select: { id: true, prenom: true, nom: true, telephone: true, statut: true, photoUrl: true },
        }),
        prisma.transporteur.findMany({
          where: { OR: [{ nom: { contains: q, mode: "insensitive" } }, { zone: { contains: q, mode: "insensitive" } }, { vehicule: { contains: q, mode: "insensitive" } }] },
          take: 5,
          select: { id: true, nom: true, telephone: true, statut: true, photoUrl: true },
        }),
        prisma.demande.findMany({
          where: { OR: [{ nom: { contains: q, mode: "insensitive" } }, { destination: { contains: q, mode: "insensitive" } }, { commune: { contains: q, mode: "insensitive" } }] },
          orderBy: { creeLe: "desc" },
          take: 6,
          select: { id: true, service: true, nom: true, telephone: true, date: true, statut: true },
        }),
      ]);
    }

    return NextResponse.json({
      resultats: {
        clients: clients.slice(0, 5),
        etablissements: etablissements.slice(0, 5),
        soignants,
        transporteurs,
        demandes,
      },
    });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
