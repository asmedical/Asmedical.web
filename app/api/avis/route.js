import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Identité patient par jeton → téléphone (profil ou compte).
async function telPatient(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;
  const { data: profil } = await admin.from("profil").select("telephone").eq("id", user.id).maybeSingle();
  const digits = (s) => String(s || "").replace(/\D/g, "");
  return digits(user.phone).slice(-8) || digits(profil?.telephone).slice(-8) || null;
}

// POST /api/avis { demandeId, note, commentaire } — le patient note SON
// intervention terminée. Un seul avis par intervention.
export async function POST(req) {
  try {
    const cle = await telPatient(req);
    if (!cle) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });

    const { demandeId, note, commentaire } = await req.json();
    const n = Number(note);
    if (!demandeId || !Number.isInteger(n) || n < 1 || n > 5) {
      return NextResponse.json({ erreur: "note invalide" }, { status: 400 });
    }

    const demande = await prisma.demande.findUnique({ where: { id: Number(demandeId) }, include: { avis: true } });
    if (!demande) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });

    // Appartenance (téléphone) + intervention réellement terminée.
    const digits = String(demande.telephone || "").replace(/\D/g, "").slice(-8);
    if (digits !== cle) return NextResponse.json({ erreur: "non autorisé" }, { status: 403 });
    if (demande.statut !== "TERMINEE") return NextResponse.json({ erreur: "intervention non terminée" }, { status: 400 });
    if (demande.avis) return NextResponse.json({ erreur: "déjà noté" }, { status: 409 });

    const avis = await prisma.avis.create({
      data: {
        demandeId: demande.id,
        soignantId: demande.soignantId,
        transporteurId: demande.transporteurId,
        note: n,
        commentaire: commentaire ? String(commentaire).slice(0, 600) : null,
        telephone: demande.telephone,
      },
    });
    return NextResponse.json({ ok: true, avis: { note: avis.note, commentaire: avis.commentaire } }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
