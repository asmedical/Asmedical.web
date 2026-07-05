import { createClient } from "@supabase/supabase-js";

// Client Supabase côté navigateur (Storage + Auth).
// Les variables NEXT_PUBLIC_* sont injectées au build par Vercel.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anon);

export const supabase = supabaseConfigured
  ? createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

// Garantit une session utilisateur. Pour le MVP on ouvre une session
// anonyme (identité stable stockée sur l'appareil) ; elle sera remplacée
// par la connexion téléphone + OTP en V1, sans changer la logique des
// documents (tout est rattaché à auth.uid()).
export async function assurerSession() {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}
