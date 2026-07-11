import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// ⚠️ MODE TEST TEMPORAIRE — en attendant l'activation SMS (Twilio/Elite).
// Actif UNIQUEMENT si la variable OTP_TEST_CODE est définie (ex. 123456).
// N'importe quel numéro + ce code = session ouverte (création ou connexion).
// À DÉSACTIVER avant l'ouverture au public : supprimer OTP_TEST_CODE de
// Vercel puis redéployer — le flux SMS normal reprend, sans toucher au code.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET → le mode test est-il actif ? (permet au site de passer à l'écran
// code même si l'envoi SMS a échoué)
export async function GET() {
  return NextResponse.json({ actif: Boolean(process.env.OTP_TEST_CODE) });
}

// POST { phone, code } → si code = OTP_TEST_CODE : crée le compte si besoin
// (téléphone confirmé) et renvoie un mot de passe à usage immédiat pour
// ouvrir la session côté navigateur (signInWithPassword téléphone).
export async function POST(req) {
  try {
    const attendu = process.env.OTP_TEST_CODE;
    if (!attendu) return NextResponse.json({ erreur: "désactivé" }, { status: 404 });

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`otptest:${ip}`, 8, 60000)) {
      return NextResponse.json({ erreur: "Trop de tentatives." }, { status: 429 });
    }

    const { phone, code } = await req.json();
    const p = String(phone || "").trim();
    if (!/^\+\d{9,15}$/.test(p)) return NextResponse.json({ erreur: "téléphone invalide" }, { status: 400 });
    if (String(code || "").trim() !== attendu) return NextResponse.json({ erreur: "code incorrect" }, { status: 401 });

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
      // Déjà existant → retrouver par téléphone (base encore petite).
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
