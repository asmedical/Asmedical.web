import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { ROLES_EMPLOYE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const TAILLE_MAX = 10 * 1024 * 1024;
const FORMATS = ["application/pdf", "image/jpeg", "image/png"];
const CATEGORIES = ["piece_identite", "diplome", "certificat", "permis", "assurance", "carte_grise", "contrat", "rib", "autre"];

function nomPropre(nom) {
  return String(nom || "doc").replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

// Contexte employé (client service_role + userId + rôle).
async function contexte(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { err: NextResponse.json({ erreur: "non connecté" }, { status: 401 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { err: NextResponse.json({ erreur: "config" }, { status: 500 }) };
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return { err: NextResponse.json({ erreur: "non connecté" }, { status: 401 }) };
  const { data: profil } = await admin.from("profil").select("role").eq("id", user.id).maybeSingle();
  const role = profil?.role || user.user_metadata?.role || "";
  if (!ROLES_EMPLOYE.includes(role)) return { err: NextResponse.json({ erreur: "refusé" }, { status: 403 }) };
  return { admin, userId: user.id };
}

// GET → mes documents (avec statut, remarque admin et URL signée).
export async function GET(req) {
  const ctx = await contexte(req);
  if (ctx.err) return ctx.err;
  try {
    const docs = await prisma.documentEmploye.findMany({ where: { userId: ctx.userId }, orderBy: { creeLe: "desc" } });
    let urls = {};
    if (docs.length) {
      const { data } = await ctx.admin.storage.from("documents").createSignedUrls(docs.map((d) => d.chemin), 3600);
      urls = Object.fromEntries((data || []).map((u, i) => [docs[i].id, u.signedUrl || null]));
    }
    return NextResponse.json({ documents: docs.map((d) => ({ ...d, url: urls[d.id] || null })) });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// POST (multipart) → je dépose un de mes documents.
export async function POST(req) {
  const ctx = await contexte(req);
  if (ctx.err) return ctx.err;
  try {
    const form = await req.formData();
    const fichier = form.get("fichier");
    const categorie = CATEGORIES.includes(form.get("categorie")) ? form.get("categorie") : "autre";
    if (!fichier || typeof fichier === "string") return NextResponse.json({ erreur: "invalide" }, { status: 400 });
    if (!FORMATS.includes(fichier.type)) return NextResponse.json({ erreur: "Format accepté : PDF, JPG ou PNG." }, { status: 400 });
    if (fichier.size > TAILLE_MAX) return NextResponse.json({ erreur: "Fichier trop lourd (10 Mo max)." }, { status: 400 });

    const chemin = `employes/${ctx.userId}/${Date.now()}-${nomPropre(fichier.name)}`;
    const buffer = Buffer.from(await fichier.arrayBuffer());
    const { error: eUp } = await ctx.admin.storage.from("documents").upload(chemin, buffer, { contentType: fichier.type, upsert: false });
    if (eUp) return NextResponse.json({ erreur: "Envoi impossible." }, { status: 500 });

    const doc = await prisma.documentEmploye.create({
      data: { userId: ctx.userId, categorie, nom: String(fichier.name).slice(0, 120), chemin, taille: fichier.size, typeMime: fichier.type, deposePar: "employe", statut: "EN_ATTENTE" },
    });
    return NextResponse.json({ ok: true, document: doc }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
