import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus, ROLES_GESTION_INTERVENANTS } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const TAILLE_MAX = 3 * 1024 * 1024; // 3 Mo

// Upload d'une photo de soignant / transporteur vers le bucket public
// « photos » (côté serveur, clé service_role). Met à jour photoUrl.
export async function POST(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_INTERVENANTS);
  if (!acces) return refus();
  try {
    const form = await req.formData();
    const fichier = form.get("fichier");
    const entite = form.get("entite"); // soignant | transporteur
    const id = Number(form.get("id"));

    if (!fichier || typeof fichier === "string" || !["soignant", "transporteur"].includes(entite) || !id) {
      return NextResponse.json({ erreur: "invalide" }, { status: 400 });
    }
    if (!String(fichier.type || "").startsWith("image/")) {
      return NextResponse.json({ erreur: "Le fichier doit être une image." }, { status: 400 });
    }
    if (fichier.size > TAILLE_MAX) {
      return NextResponse.json({ erreur: "Image trop lourde (3 Mo max)." }, { status: 400 });
    }

    const ext = (String(fichier.name || "").split(".").pop() || "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 5) || "jpg";
    const chemin = `${entite}s/${id}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await fichier.arrayBuffer());

    const { error: eUp } = await acces.admin.storage
      .from("photos")
      .upload(chemin, buffer, { contentType: fichier.type, upsert: true });
    if (eUp) {
      const detail = String(eUp.message || "");
      const msg = /bucket/i.test(detail)
        ? "Le bucket « photos » est introuvable dans Supabase Storage."
        : `Stockage impossible : ${detail || "erreur inconnue"}`;
      return NextResponse.json({ erreur: msg }, { status: 500 });
    }

    // URL publique si le bucket est public ; sinon bascule automatique
    // sur une URL signée longue durée (10 ans) — bucket privé accepté.
    const { data: pub } = acces.admin.storage.from("photos").getPublicUrl(chemin);
    let url = pub.publicUrl;
    let accessible = false;
    try {
      const test = await fetch(url, { method: "HEAD" });
      accessible = test.ok;
    } catch {}
    if (!accessible) {
      const { data: signee, error: eSign } = await acces.admin.storage
        .from("photos")
        .createSignedUrl(chemin, 60 * 60 * 24 * 365 * 10);
      if (eSign || !signee?.signedUrl) {
        return NextResponse.json(
          { erreur: "Photo enregistrée mais illisible : rendez le bucket « photos » public dans Supabase Storage." },
          { status: 500 }
        );
      }
      url = signee.signedUrl;
    }

    if (entite === "soignant") await prisma.soignant.update({ where: { id }, data: { photoUrl: url } });
    else await prisma.transporteur.update({ where: { id }, data: { photoUrl: url } });

    await journaliser(acces.nomAffiche, `${entite}.photo`, entite, id);
    return NextResponse.json({ ok: true, url });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur (le bucket « photos » existe-t-il ?)" }, { status: 500 });
  }
}
