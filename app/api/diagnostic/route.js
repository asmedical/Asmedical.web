import { NextResponse } from "next/server";

// Jamais mis en cache : chaque appel reflète l'état réel de la config.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SANS_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

// Diagnostic de configuration (lecture seule, aucune donnée sensible exposée).
// Vérifie que les variables Supabase sont présentes et que le projet répond.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const resultat = {
    url_definie: Boolean(url),
    url_valide: /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url),
    url_sans_rest: !url.includes("/rest/"),
    anon_definie: Boolean(anon),
    service_role_definie: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    projet_joignable: null,
    connexion_anonyme: null,
    table_document: null,
    conseil: "",
  };

  if (!resultat.url_valide || !anon) {
    resultat.conseil =
      "NEXT_PUBLIC_SUPABASE_URL doit être exactement https://xxxx.supabase.co (sans /rest/v1/) et NEXT_PUBLIC_SUPABASE_ANON_KEY doit être renseignée. Corrigez dans Vercel puis Redeploy.";
    return NextResponse.json(resultat, { headers: SANS_CACHE });
  }

  const base = url.replace(/\/$/, "");
  try {
    // Le projet répond-il ?
    const r = await fetch(`${base}/auth/v1/settings`, { headers: { apikey: anon } });
    resultat.projet_joignable = r.ok;

    // La connexion anonyme est-elle activée ?
    const rc = await fetch(`${base}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify({ data: {} }),
    });
    // /signup anonyme renvoie 200 si activé, 422/403 sinon
    let jeton = null;
    if (rc.ok) {
      const j = await rc.json().catch(() => ({}));
      jeton = j.access_token || null;
      resultat.connexion_anonyme = true;
    } else {
      const j = await rc.json().catch(() => ({}));
      resultat.connexion_anonyme = false;
      if (String(j.msg || j.error_code || "").toLowerCase().includes("anonymous")) {
        resultat.conseil =
          "Activez « Anonymous sign-ins » dans Supabase → Authentication → Sign In / Providers.";
      }
    }

    // La table document existe-t-elle (et RLS) ?
    const rt = await fetch(`${base}/rest/v1/document?select=id&limit=1`, {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${jeton || anon}`,
      },
    });
    if (rt.status === 200) resultat.table_document = true;
    else if (rt.status === 404) {
      resultat.table_document = false;
      resultat.conseil =
        resultat.conseil ||
        "La table « document » n'existe pas : exécutez supabase/documents.sql dans Supabase → SQL Editor.";
    } else {
      resultat.table_document = `réponse ${rt.status}`;
    }
  } catch (e) {
    resultat.projet_joignable = false;
    resultat.conseil = "Le projet Supabase ne répond pas. Vérifiez l'URL.";
  }

  if (!resultat.conseil && resultat.connexion_anonyme && resultat.table_document === true) {
    resultat.conseil = "✅ Tout est prêt. Rechargez « Mes documents ».";
  }

  return NextResponse.json(resultat, { headers: SANS_CACHE });
}
