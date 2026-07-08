import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus, ROLES_GESTION_INTERVENANTS } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo
const FORMATS = ["application/pdf", "image/jpeg", "image/png"];
const CATEGORIES = ["piece_identite", "diplome", "certificat", "permis", "assurance", "carte_grise", "contrat", "rib", "autre"];
const STATUTS = ["EN_ATTENTE", "VALIDE", "REFUSE"];

function nomPropre(nom) {
  return String(nom || "doc").replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

// Ajoute une URL signée courte à chaque document pour l'ouvrir.
async function avecUrls(admin, docs) {
  if (!docs.length) return docs;
  const { data } = await admin.storage.from("documents").createSignedUrls(docs.map((d) => d.chemin), 3600);
  const urls = Object.fromEntries((data || []).map((u, i) => [docs[i].id, u.signedUrl || null]));
  return docs.map((d) => ({ ...d, url: urls[d.id] || null }));
}

// GET ?userId= → documents RH de l'employé.
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) return NextResponse.json({ erreur: "userId manquant" }, { status: 400 });
    const docs = await prisma.documentEmploye.findMany({ where: { userId }, orderBy: { creeLe: "desc" } });
    return NextResponse.json({ documents: await avecUrls(acces.admin, docs) });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// POST (multipart) → l'admin dépose un document pour l'employé.
export async function POST(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_INTERVENANTS);
  if (!acces) return refus();
  try {
    const form = await req.formData();
    const fichier = form.get("fichier");
    const userId = String(form.get("userId") || "");
    const categorie = CATEGORIES.includes(form.get("categorie")) ? form.get("categorie") : "autre";
    const expiration = String(form.get("expiration") || "").slice(0, 10) || null;

    if (!userId || !fichier || typeof fichier === "string") return NextResponse.json({ erreur: "invalide" }, { status: 400 });
    if (!FORMATS.includes(fichier.type)) return NextResponse.json({ erreur: "Format accepté : PDF, JPG ou PNG." }, { status: 400 });
    if (fichier.size > TAILLE_MAX) return NextResponse.json({ erreur: "Fichier trop lourd (10 Mo max)." }, { status: 400 });

    const chemin = `employes/${userId}/${Date.now()}-${nomPropre(fichier.name)}`;
    const buffer = Buffer.from(await fichier.arrayBuffer());
    const { error: eUp } = await acces.admin.storage.from("documents").upload(chemin, buffer, { contentType: fichier.type, upsert: false });
    if (eUp) return NextResponse.json({ erreur: "Stockage impossible : " + (eUp.message || "") }, { status: 500 });

    const doc = await prisma.documentEmploye.create({
      data: { userId, categorie, nom: String(fichier.name).slice(0, 120), chemin, taille: fichier.size, typeMime: fichier.type, expiration, deposePar: "admin", statut: "VALIDE" },
    });
    await journaliser(acces.nomAffiche, "document.ajoute", "compte", userId, `${categorie} (${doc.nom})`);
    return NextResponse.json({ ok: true, document: doc }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH → valider / refuser + remarque + expiration.
export async function PATCH(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_INTERVENANTS);
  if (!acces) return refus();
  try {
    const c = await req.json();
    const id = Number(c.id);
    if (!id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });
    const data = {};
    if (STATUTS.includes(c.statut)) data.statut = c.statut;
    if (c.remarque !== undefined) data.remarque = c.remarque ? String(c.remarque).slice(0, 500) : null;
    if (c.expiration !== undefined) data.expiration = c.expiration ? String(c.expiration).slice(0, 10) : null;
    const doc = await prisma.documentEmploye.update({ where: { id }, data });
    await journaliser(acces.nomAffiche, "document.maj", "compte", doc.userId, `${doc.categorie} → ${data.statut || "modifié"}`);
    return NextResponse.json({ ok: true, document: doc });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE ?id= → supprime le document (fichier + fiche).
export async function DELETE(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_INTERVENANTS);
  if (!acces) return refus();
  try {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });
    const doc = await prisma.documentEmploye.findUnique({ where: { id } });
    if (!doc) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
    try { await acces.admin.storage.from("documents").remove([doc.chemin]); } catch {}
    await prisma.documentEmploye.delete({ where: { id } });
    await journaliser(acces.nomAffiche, "document.supprime", "compte", doc.userId, doc.nom);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
