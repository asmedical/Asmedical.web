import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorise } from "@/lib/ratelimit";
import { compteDemo, estNumeroDemo, verifierDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

// COMPTE DE DÉMONSTRATION (examens Google Play / App Store).
// ⚠️ L'ancien mode test « n'importe quel numéro + code » est SUPPRIMÉ :
// seul le numéro whitelisté (DEMO_TEL) avec son code fixe (DEMO_CODE)
// ouvre une session sans SMS. Tous les autres numéros passent par le
// flux SMS réel (Elite/Twilio). Voir lib/demo.js.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET ?phone=… → ce numéro est-il le compte de démonstration ?
// (permet au site de passer à l'écran code même si l'envoi SMS a échoué —
// uniquement pour ce numéro-là)
export async function GET(req) {
  const phone = new URL(req.url).searchParams.get("phone") || "";
  return NextResponse.json({ actif: estNumeroDemo(phone) });
}

// POST { phone, code } → si (numéro, code) = compte de démonstration :
// crée le compte si besoin (téléphone confirmé) et renvoie un mot de passe
// à usage immédiat pour ouvrir la session côté navigateur.
export async function POST(req) {
  try {
    if (!compteDemo()) return NextResponse.json({ erreur: "désactivé" }, { status: 404 });

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`otptest:${ip}`, 8, 60000)) {
      return NextResponse.json({ erreur: "Trop de tentatives." }, { status: 429 });
    }

    const { phone, code } = await req.json();
    const p = String(phone || "").trim();
    if (!/^\+\d{9,15}$/.test(p)) return NextResponse.json({ erreur: "téléphone invalide" }, { status: 400 });
    if (!verifierDemo(p, code)) return NextResponse.json({ erreur: "code incorrect" }, { status: 401 });

    const a = admin();
    if (!a) return NextResponse.json({ erreur: "config" }, { status: 500 });

    // Mot de passe éphémère aléatoire (jamais montré, jamais réutilisable
    // sans repasser par cette route).
    const mdp = "T!" + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);

    // Crée le compte (téléphone confirmé) ; s'il existe déjà, on le retrouve.
    let userId = null;
    const { data: cree, error: eCreate } = await a.auth.admin.createUser({
      phone: p,
      phone_confirm: true,
      password: mdp,
    });
    if (!eCreate && cree?.user) {
      userId = cree.user.id;
    } else {
      const chiffres = p.replace(/\D/g, "");
      for (let page = 1; page <= 5 && !userId; page++) {
        const { data } = await a.auth.admin.listUsers({ page, perPage: 200 });
        const u = (data?.users || []).find((x) => String(x.phone || "").replace(/\D/g, "") === chiffres);
        if (u) userId = u.id;
        if (!data?.users?.length || data.users.length < 200) break;
      }
      if (!userId) return NextResponse.json({ erreur: "compte introuvable" }, { status: 404 });
      const { error: eMaj } = await a.auth.admin.updateUserById(userId, { password: mdp, phone_confirm: true });
      if (eMaj) return NextResponse.json({ erreur: "échec" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, phone: p, motDePasse: mdp });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
