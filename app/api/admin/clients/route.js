import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// GET /api/admin/clients?q=&id= — liste/recherche des comptes clients
// (table profil Supabase, lue avec la clé service_role côté serveur).
// Avec ?id= : fiche complète (profil + demandes liées à son téléphone).
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const p = new URL(req.url).searchParams;
    const id = p.get("id");

    if (id) {
      const { data: profil } = await acces.admin.from("profil").select("*").eq("id", id).maybeSingle();
      if (!profil) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
      let demandes = [];
      if (profil.telephone) {
        const tel8 = String(profil.telephone).replace(/\D/g, "").slice(-8);
        demandes = tel8
          ? await prisma.demande.findMany({
              where: { telephone: { contains: tel8 } },
              orderBy: { creeLe: "desc" },
              take: 50,
            })
          : [];
      }
      return NextResponse.json({ profil, demandes });
    }

    const q = (p.get("q") || "").trim();
    let requete = acces.admin
      .from("profil")
      .select("id, role, prenom, nom, telephone, email, commune, etablissement, cree_le")
      .order("cree_le", { ascending: false })
      .limit(100);
    if (q) {
      requete = requete.or(
        `nom.ilike.%${q}%,prenom.ilike.%${q}%,telephone.ilike.%${q}%,email.ilike.%${q}%,etablissement.ilike.%${q}%`
      );
    }
    const { data: clients, error } = await requete;
    if (error) throw error;
    return NextResponse.json({ clients: clients || [] });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH : corriger la fiche d'un client (nom, commune, téléphone…)
export async function PATCH(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const c = await req.json();
    if (!c.id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });
    const autorises = ["prenom", "nom", "commune", "telephone", "email", "etablissement", "contact"];
    const data = {};
    for (const k of autorises) if (c[k] !== undefined) data[k] = String(c[k] || "").slice(0, 160);
    data.maj_le = new Date().toISOString();
    const { error } = await acces.admin.from("profil").update(data).eq("id", c.id);
    if (error) throw error;
    await journaliser(acces.nomAffiche, "client.maj", "client", c.id, Object.keys(data).join(","));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
