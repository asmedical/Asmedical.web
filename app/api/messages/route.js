import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Messagerie côté patient/établissement. L'identité vient TOUJOURS du jeton
// de session (jamais d'un paramètre client) : chacun n'accède qu'à son fil —
// ou aux FILS PAR DEMANDE auxquels il participe (?demande=ID), vérifiés
// serveur : patient, proche/établissement rattaché, ou réservataire.
async function identifier(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const {
    data: { user },
  } = await admin.auth.getUser(token);
  if (!user) return null;
  const { data: profil } = await admin
    .from("profil").select("telephone, prenom, nom, etablissement, role").eq("id", user.id).maybeSingle();
  return { user, profil: profil || {}, admin };
}

function nomAffiche(id) {
  return (
    id.profil.etablissement ||
    [id.profil.prenom, id.profil.nom].filter(Boolean).join(" ") ||
    "Participant"
  );
}

// GET : mon fil (et marque les messages de l'équipe comme lus) — ou le fil
// d'une demande si ?demande=ID et que j'y participe.
export async function GET(req) {
  try {
    const id = await identifier(req);
    if (!id) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    const user = id.user;

    const demandeId = new URL(req.url).searchParams.get("demande");
    if (demandeId) {
      const { accesFil, messagesFil } = await import("@/lib/filDemande");
      const acces = await accesFil(demandeId, {
        userId: user.id,
        telephone: user.phone || id.profil.telephone,
      });
      if (!acces.ok) return NextResponse.json({ erreur: "accès refusé" }, { status: 403 });
      const messages = await messagesFil(demandeId);
      return NextResponse.json({
        messages: messages.map((m) => ({ ...m, deMoi: m.userId === user.id })),
        role: acces.role,
      });
    }

    const messages = await prisma.message.findMany({
      where: { userId: user.id, demandeId: null },
      orderBy: { creeLe: "asc" },
      take: 200,
    });
    await prisma.message.updateMany({
      where: { userId: user.id, demandeId: null, deEquipe: true, luParPatient: false },
      data: { luParPatient: true },
    });
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// POST : j'écris à l'équipe — ou dans le fil d'une demande (demandeId).
export async function POST(req) {
  try {
    const id = await identifier(req);
    if (!id) return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
    const user = id.user;
    if (!autorise(`msg:${user.id}`, 20, 60000)) {
      return NextResponse.json({ erreur: "Trop de messages, patientez un instant." }, { status: 429 });
    }

    const corps = await req.json();
    const propre = String(corps.texte || "").trim().slice(0, 1000);
    if (!propre) return NextResponse.json({ erreur: "message vide" }, { status: 400 });

    if (corps.demandeId) {
      const { accesFil, ecrireFil, notifierFil } = await import("@/lib/filDemande");
      const acces = await accesFil(corps.demandeId, {
        userId: user.id,
        telephone: user.phone || id.profil.telephone,
      });
      if (!acces.ok) return NextResponse.json({ erreur: "accès refusé" }, { status: 403 });
      const nom = acces.role === "patient" ? nomAffiche(id) || "Patient" : nomAffiche(id);
      const res = await ecrireFil(corps.demandeId, { userId: user.id, nom, texte: propre });
      if (res.erreur) return NextResponse.json({ erreur: res.erreur }, { status: 400 });
      // Les autres participants sont prévenus (jamais l'auteur).
      notifierFil(id.admin, acces.demande, {
        auteurUserId: user.id, nomAuteur: nom, apercu: propre,
      }).catch(() => {});
      return NextResponse.json({ ok: true, message: res.message }, { status: 201 });
    }

    const message = await prisma.message.create({
      data: { userId: user.id, deEquipe: false, texte: propre },
    });
    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
