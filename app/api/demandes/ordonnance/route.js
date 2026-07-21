import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { peutJoindre, fichierValide, enregistrerDocument } from "@/lib/documentsDemande";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Joindre une ORDONNANCE à une demande de livraison de médicaments.
// Fonctionne aussi pour une réservation SANS compte : l'appelant doit
// fournir le téléphone exact de la demande (et la demande être récente).
// Le fichier part dans le bucket privé « documents » — jamais public.
export async function POST(req) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`ordonnance:${ip}`, 6, 60000)) {
      return NextResponse.json({ erreur: "Trop d'envois — réessayez dans une minute." }, { status: 429 });
    }

    const form = await req.formData();
    const demandeId = Number(form.get("demandeId"));
    const telephone = String(form.get("telephone") || "");
    const fichier = form.get("fichier");
    if (!demandeId || !fichier || typeof fichier === "string") {
      return NextResponse.json({ erreur: "paramètres invalides" }, { status: 400 });
    }

    const demande = await prisma.demande.findUnique({ where: { id: demandeId } });
    const acces = await peutJoindre(demande, telephone);
    if (acces.erreur) return NextResponse.json({ erreur: acces.erreur }, { status: 403 });

    const controle = fichierValide({ mime: fichier.type, taille: fichier.size });
    if (controle.erreur) return NextResponse.json({ erreur: controle.erreur }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ erreur: "config" }, { status: 500 });
    const admin = createClient(url, key, { auth: { persistSession: false } });

    const propre = String(fichier.name || "ordonnance").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const chemin = `demandes/${demandeId}/${crypto.randomUUID()}-${propre}`;
    const tampon = Buffer.from(await fichier.arrayBuffer());
    const { error: eUp } = await admin.storage.from("documents").upload(chemin, tampon, {
      contentType: fichier.type, upsert: false,
    });
    if (eUp) return NextResponse.json({ erreur: "stockage" }, { status: 500 });

    const doc = await enregistrerDocument(demandeId, {
      nom: fichier.name, chemin, mime: fichier.type, taille: fichier.size, par: "patient",
    });
    await prisma.journal.create({
      data: { auteur: "patient", action: "demande.ordonnance", entite: "demande", entiteId: String(demandeId), detail: doc.nom },
    }).catch(() => {});

    return NextResponse.json({ ok: true, document: { id: doc.id, nom: doc.nom } }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
