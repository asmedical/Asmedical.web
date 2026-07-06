import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Finalise un compte créé par SMS : rattache email + mot de passe au compte,
// email marqué comme confirmé DIRECTEMENT (email_confirm), sans envoyer
// d'email de confirmation. On évite ainsi la dépendance au SMTP au moment de
// l'inscription (l'identité est déjà prouvée par le SMS).
//
// Sécurité : on n'agit que sur le compte de l'appelant. Le jeton d'accès
// fourni est vérifié côté serveur (clé service_role) pour retrouver son id ;
// impossible de modifier le compte d'un autre.
export async function POST(req) {
  try {
    const { access_token, email, password } = await req.json();
    if (!access_token || !email || !password) {
      return NextResponse.json({ erreur: "invalide" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ erreur: "config" }, { status: 500 });

    const admin = createClient(url, key, { auth: { persistSession: false } });

    // Vérifie l'identité de l'appelant à partir de son jeton.
    const {
      data: { user },
      error: eUser,
    } = await admin.auth.getUser(access_token);
    if (eUser || !user) {
      return NextResponse.json({ erreur: "non_autorise" }, { status: 401 });
    }

    const { error } = await admin.auth.admin.updateUserById(user.id, {
      email: String(email).trim(),
      password: String(password),
      email_confirm: true,
    });

    if (error) {
      const m = (error.message || "").toLowerCase();
      if (m.includes("already") || m.includes("registered") || error.code === "email_exists") {
        return NextResponse.json({ erreur: "email_pris" }, { status: 409 });
      }
      return NextResponse.json({ erreur: "echec" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "serveur" }, { status: 500 });
  }
}
