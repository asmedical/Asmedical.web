import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { ROLES_EMPLOYE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const LIB_SERVICE = { transport: "Transport", domicile: "Aide à domicile", medicaments: "Livraison de médicaments" };

// Identifie l'employé + sa fiche intervenant à partir du jeton.
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
  const estChauffeur = role === "chauffeur" || role === "transporteur";
  const modele = estChauffeur ? prisma.transporteur : prisma.soignant;
  const iv = await modele.findUnique({ where: { userId: user.id } });
  if (!iv) return { err: NextResponse.json({ erreur: "aucune fiche liée" }, { status: 403 }) };
  return { user, role, estChauffeur, iv, admin };
}

// Message patient selon l'action posée par l'intervenant sur le terrain.
const MSG_PATIENT = {
  en_route: { titre: "Votre intervenant est en route 🚗", corps: "Il/elle se dirige vers vous." },
  arrivee: { titre: "Votre intervenant est arrivé 📍", corps: "Il/elle est sur place." },
  terminer: { titre: "Intervention terminée ✅", corps: "Merci ! Donnez votre avis en quelques secondes." },
};

// Vérifie que la demande est bien affectée à cet intervenant (sécurité).
function possede(demande, ctx) {
  if (!demande) return false;
  return ctx.estChauffeur ? demande.transporteurId === ctx.iv.id : demande.soignantId === ctx.iv.id;
}

// Étape courante déduite des horodatages (progression fine sans casser le
// statut principal utilisé côté admin / patient).
function etape(d) {
  if (d.statut === "ANNULEE") return "annulee";
  if (d.statut === "ABSENT") return "absent";
  if (d.finLe) return "terminee";
  if (d.debutLe) return "en_cours";
  if (d.arriveeLe) return "arrivee";
  if (d.enRouteLe) return "en_route";
  if (d.accepteeLe) return "acceptee";
  return "affectee";
}

// Consignes visibles par l'intervenant (extraites du JSON details) —
// jamais les notes internes privées de l'admin.
function consignes(d) {
  const out = { besoins: [], acces: null, code: null };
  try {
    const p = JSON.parse(d.details || "{}");
    out.besoins = Array.isArray(p.besoins) ? p.besoins : [];
    out.acces = p.acces || null;
    out.code = p.code || null;
    out.acte = p.acte || null;
  } catch {}
  return out;
}

// Vue « fiche mission » filtrée pour l'intervenant.
function vueIntervenant(d) {
  return {
    id: d.id,
    service: d.service,
    serviceLib: LIB_SERVICE[d.service] || d.service,
    typeTrajet: d.typeTrajet,
    date: d.date,
    statut: d.statut,
    etape: etape(d),
    prioritaire: d.prioritaire,
    fenetre: d.fenetre,
    // Client (lecture seule)
    client: { nom: d.nom || null, telephone: d.telephone || null },
    depart: d.depart || null,
    destination: d.destination || null,
    // Consignes utiles (pas de notes internes)
    notes: d.notes || null,
    consignes: consignes(d),
    // Progression
    accepteeLe: d.accepteeLe, enRouteLe: d.enRouteLe, arriveeLe: d.arriveeLe,
    debutLe: d.debutLe, finLe: d.finLe, problemeLe: d.problemeLe,
    problemeTexte: d.problemeTexte, compteRendu: d.compteRendu,
  };
}

// GET /api/employe/intervention?id=… → fiche mission (si affectée à moi).
export async function GET(req) {
  try {
    const ctx = await contexte(req);
    if (ctx.err) return ctx.err;
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });
    const d = await prisma.demande.findUnique({ where: { id } });
    if (!possede(d, ctx)) return NextResponse.json({ erreur: "non autorisé" }, { status: 403 });
    return NextResponse.json({ intervention: vueIntervenant(d), estChauffeur: ctx.estChauffeur });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/employe/intervention — fait avancer SA mission.
// { id, action } avec action ∈ accepter | en_route | arrivee | commencer |
// terminer | probleme | absent  (+ compteRendu / problemeTexte selon le cas)
// Rétro-compat : { id, statut } accepte encore EN_COURS / TERMINEE / ABSENT.
export async function PATCH(req) {
  try {
    const ctx = await contexte(req);
    if (ctx.err) return ctx.err;
    const c = await req.json();
    const id = Number(c.id);
    if (!id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });
    const d = await prisma.demande.findUnique({ where: { id } });
    if (!possede(d, ctx)) return NextResponse.json({ erreur: "non autorisé" }, { status: 403 });

    const now = new Date();
    const data = {};
    let libelle = "";

    const action = c.action || ({ EN_COURS: "commencer", TERMINEE: "terminer", ABSENT: "absent" }[c.statut]);
    switch (action) {
      case "accepter":
        data.accepteeLe = now; if (d.statut === "AFFECTEE") data.statut = "CONFIRMEE"; libelle = "intervention confirmée"; break;
      case "en_route":
        data.enRouteLe = now; libelle = "en route"; break;
      case "arrivee":
        data.arriveeLe = now; libelle = "arrivée sur place"; break;
      case "commencer":
        data.debutLe = now; data.statut = "EN_COURS"; libelle = "intervention commencée"; break;
      case "terminer":
        data.finLe = now; data.statut = "TERMINEE";
        if (c.compteRendu) data.compteRendu = String(c.compteRendu).slice(0, 1500);
        libelle = "intervention terminée"; break;
      case "probleme":
        data.problemeLe = now; data.problemeTexte = String(c.problemeTexte || "").slice(0, 1000) || "Problème signalé"; libelle = "problème signalé"; break;
      case "absent":
        data.statut = "ABSENT"; libelle = "patient absent"; break;
      default:
        return NextResponse.json({ erreur: "action inconnue" }, { status: 400 });
    }

    const maj = await prisma.demande.update({ where: { id }, data });
    await prisma.journal.create({
      data: {
        auteur: `${ctx.iv.prenom || ctx.iv.nom || "intervenant"}`.trim(),
        action: "intervention.avancement",
        entite: "demande",
        entiteId: String(id),
        detail: `${libelle} (par l'intervenant)`,
      },
    });

    // Prévient le patient des étapes qui le concernent (en route / arrivé / terminé).
    if (MSG_PATIENT[action]) {
      const { notifierPatient } = await import("@/lib/notifier");
      await notifierPatient(ctx.admin, maj, MSG_PATIENT[action]);
    }

    // Facturation automatique à la clôture (jamais bloquante pour la mission).
    if (action === "terminer") {
      try {
        const { facturerDemande } = await import("@/lib/finances");
        await facturerDemande(maj);
      } catch {}
      // Compte-rendu partagé aux proches et établissements autorisés.
      try {
        const { notifierProchesFin } = await import("@/lib/proches");
        await notifierProchesFin(maj);
      } catch {}
    }

    return NextResponse.json({ ok: true, intervention: vueIntervenant(maj) });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
