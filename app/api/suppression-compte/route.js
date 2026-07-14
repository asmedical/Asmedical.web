import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Demande PUBLIQUE de suppression de compte (exigence Google Play).
// Aucune suppression automatique : la demande entre dans la file
// « Suppressions » et reste soumise à la validation du super admin
// (protection contre les demandes malveillantes au nom d'autrui).
export async function POST(req) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`suppr:${ip}`, 5, 3600000)) {
      return NextResponse.json({ erreur: "Trop de demandes — réessayez plus tard." }, { status: 429 });
    }

    const c = await req.json();
    const nom = String(c.nom || "").trim().slice(0, 120);
    const telephone = String(c.telephone || "").trim().slice(0, 30);
    const email = String(c.email || "").trim().slice(0, 160);
    const motif = String(c.motif || "").trim().slice(0, 500);
    if (!nom || telephone.replace(/\D/g, "").length < 8) {
      return NextResponse.json({ erreur: "Nom et numéro de téléphone requis." }, { status: 400 });
    }

    // Retrouver le profil par téléphone si possible (sinon la demande est
    // quand même enregistrée : l'équipe identifiera le compte).
    let cibleId = `tel:${telephone.replace(/\D/g, "")}`;
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && key) {
        const admin = createClient(url, key, { auth: { persistSession: false } });
        const tel8 = telephone.replace(/\D/g, "").slice(-8);
        const { data: profils } = await admin.from("profil").select("id, telephone").limit(500);
        const profil = (profils || []).find((p) => String(p.telephone || "").replace(/\D/g, "").slice(-8) === tel8);
        if (profil) cibleId = profil.id;
      }
    } catch {}

    // Anti-doublon : une demande en attente par compte suffit.
    const deja = await prisma.demandeSuppression.findFirst({ where: { cibleId, statut: "EN_ATTENTE" } });
    if (deja) return NextResponse.json({ ok: true, deja: true });

    await prisma.demandeSuppression.create({
      data: {
        cibleType: "client",
        cibleId,
        cibleNom: `${nom} · ${telephone}${email ? ` · ${email}` : ""}`,
        motif: motif || "Demande envoyée depuis la page publique de suppression de compte.",
        demandePar: "Client (page publique)",
      },
    });
    try {
      await prisma.journal.create({
        data: { auteur: "Page publique", action: "suppression.demande.publique", entite: "client", entiteId: cibleId, detail: nom },
      });
    } catch {}

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
