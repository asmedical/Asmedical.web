import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { repondreAssistant } from "@/lib/assistantScenarios";
import { demanderIA, contexteClient, assistantIAConfigure } from "@/lib/assistantIA";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Assistant conversationnel ASM. Deux cerveaux :
//  - « ia » : Google Gemini, quand GEMINI_API_KEY est configurée en variable
//    Vercel (comprend le langage libre + connaît le contexte réel du client).
//  - « guide » : moteur à mots-clés local, repli honnête (jamais d'appel externe,
//    aucune clé). Utilisé si la clé manque, en cas d'erreur, ou si l'IA refuse.
// Aucune clé n'apparaît côté navigateur : tout se joue ici, côté serveur.

// Identifie le client via son jeton de session (optionnel) et récupère ses
// dernières demandes — CÔTÉ SERVEUR, donc non falsifiable par le navigateur.
async function chargerContexte(req) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return { contexte: "", cleLimite: null };
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { contexte: "", cleLimite: null };

    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return { contexte: "", cleLimite: null };

    const { data: profil } = await admin
      .from("profil").select("prenom, telephone, role").eq("id", user.id).maybeSingle();

    const digits = (s) => String(s || "").replace(/\D/g, "");
    const cle = digits(user.phone).slice(-8) || digits(profil?.telephone).slice(-8);
    const { idsDemandesParTel } = await import("@/lib/telephones");
    const ids = cle ? await idsDemandesParTel(cle, 20) : [];
    const ou = [{ creeParUserId: user.id }];
    if (ids.length) ou.push({ id: { in: ids } });
    if (profil?.role === "pro") ou.push({ parEtabUserId: user.id });

    const demandes = await prisma.demande.findMany({
      where: { OR: ou },
      orderBy: { creeLe: "desc" },
      take: 5,
      select: { id: true, service: true, statut: true, date: true },
    });
    return {
      contexte: contexteClient({ prenom: profil?.prenom, demandes }),
      cleLimite: user.id,
    };
  } catch {
    return { contexte: "", cleLimite: null };
  }
}

export async function POST(req) {
  let corps = {};
  try {
    corps = await req.json();
  } catch {}
  const message = String(corps.message || "").slice(0, 1000);
  const langue = corps.langue === "ar" ? "ar" : "fr";
  const historique = Array.isArray(corps.historique) ? corps.historique : [];

  if (!message.trim()) {
    return NextResponse.json({ reponse: "", action: null, source: "vide" });
  }

  // Anti-abus : limite les rafales (clé = compte si connu, sinon IP best-effort).
  const ip = (req.headers.get("x-forwarded-for") || "anon").split(",")[0].trim();

  const { contexte, cleLimite } = await chargerContexte(req);
  if (!autorise(`assistant:${cleLimite || ip}`, 20, 60_000)) {
    return NextResponse.json(
      { reponse: repondreAssistant(message, langue).txt, action: "appeler", source: "limite" },
      { status: 200 }
    );
  }

  // Cerveau IA si disponible ; sinon (ou en cas d'échec) repli guidé.
  if (assistantIAConfigure()) {
    try {
      const r = await demanderIA({ message, historique, langue, contexte });
      // r.action est déjà validé (liste blanche ACTIONS_IA) ; « appeler » et
      // toutes les cibles connues du composant sont gérées à l'affichage.
      return NextResponse.json({ reponse: r.reponse, action: r.action, source: "ia" });
    } catch {
      // On retombe silencieusement sur le moteur guidé.
    }
  }

  const rep = repondreAssistant(message, langue);
  return NextResponse.json({ reponse: rep.txt, action: rep.action || null, source: "guide" });
}
