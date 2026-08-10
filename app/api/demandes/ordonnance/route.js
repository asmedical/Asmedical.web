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

    // Deux façons d'envoyer le fichier, pour une bonne raison.
    //
    // Le NAVIGATEUR envoie un multipart classique. Le TÉLÉPHONE, lui, envoie
    // le contenu en base64 : sur React Native, joindre un fichier à un
    // FormData par son URI produit régulièrement un fichier vide côté
    // serveur — c'est exactement ce qui était arrivé aux documents patients,
    // et la lecture en base64 est le contournement déjà éprouvé ici.
    const typeCorps = req.headers.get("content-type") || "";
    let demandeId, telephone, contenu, nomFichier, mime, taille;

    if (typeCorps.includes("application/json")) {
      const c = await req.json().catch(() => ({}));
      demandeId = Number(c.demandeId);
      telephone = String(c.telephone || "");
      nomFichier = String(c.nom || "ordonnance");
      mime = String(c.type || "");
      // Le base64 peut arriver préfixé d'une en-tête « data: » : on ne garde
      // que la charge utile, sans quoi le fichier stocké serait corrompu.
      const brut = String(c.base64 || "").replace(/^data:[^;]+;base64,/, "");
      if (!brut) return NextResponse.json({ erreur: "paramètres invalides" }, { status: 400 });
      contenu = Buffer.from(brut, "base64");
      taille = contenu.length;
    } else {
      const form = await req.formData();
      demandeId = Number(form.get("demandeId"));
      telephone = String(form.get("telephone") || "");
      const fichier = form.get("fichier");
      if (!fichier || typeof fichier === "string") {
        return NextResponse.json({ erreur: "paramètres invalides" }, { status: 400 });
      }
      nomFichier = fichier.name || "ordonnance";
      mime = fichier.type;
      taille = fichier.size;
      contenu = Buffer.from(await fichier.arrayBuffer());
    }

    if (!demandeId || !contenu?.length) {
      return NextResponse.json({ erreur: "paramètres invalides" }, { status: 400 });
    }

    const demande = await prisma.demande.findUnique({ where: { id: demandeId } });
    const acces = await peutJoindre(demande, telephone);
    if (acces.erreur) return NextResponse.json({ erreur: acces.erreur }, { status: 403 });

    const controle = fichierValide({ mime, taille });
    if (controle.erreur) return NextResponse.json({ erreur: controle.erreur }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ erreur: "config" }, { status: 500 });
    const admin = createClient(url, key, { auth: { persistSession: false } });

    const propre = String(nomFichier).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const chemin = `demandes/${demandeId}/${crypto.randomUUID()}-${propre}`;
    const { error: eUp } = await admin.storage.from("documents").upload(chemin, contenu, {
      contentType: mime, upsert: false,
    });
    if (eUp) return NextResponse.json({ erreur: "stockage" }, { status: 500 });

    const doc = await enregistrerDocument(demandeId, {
      nom: nomFichier, chemin, mime, taille, par: "patient",
    });
    await prisma.journal.create({
      data: { auteur: "patient", action: "demande.ordonnance", entite: "demande", entiteId: String(demandeId), detail: doc.nom },
    }).catch(() => {});

    return NextResponse.json({ ok: true, document: { id: doc.id, nom: doc.nom } }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
