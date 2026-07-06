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

// Met un numéro saisi localement au format international (E.164).
// Défaut Algérie (+213) : 0550 12 34 56 → +213550123456.
export function normaliserTel(saisie) {
  let s = (saisie || "").replace(/[\s.\-()]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return "+" + s.slice(2);
  if (s.startsWith("0")) return "+213" + s.slice(1);
  return "+213" + s;
}

// Envoie un code de connexion par SMS (Supabase → passerelle SMS).
export async function envoyerCode(phone) {
  if (!supabase) throw new Error("config");
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
}

// Vérifie le code reçu ; ouvre la session réelle si correct.
export async function verifierCode(phone, code) {
  if (!supabase) throw new Error("config");
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
  if (error) throw error;
  return data.user;
}

export async function deconnexion() {
  if (supabase) await supabase.auth.signOut();
}

// Change le mot de passe de l'utilisateur connecté.
export async function changerMotDePasse(nouveau) {
  if (!supabase) throw new Error("config");
  const { error } = await supabase.auth.updateUser({ password: nouveau });
  if (error) throw error;
}

// ---- Récupération par email (mot de passe oublié) ----
// Envoie un code à 6 chiffres par email à un compte EXISTANT uniquement
// (shouldCreateUser: false ⇒ pas de création de compte via cette voie).
export async function envoyerCodeEmail(email) {
  if (!supabase) throw new Error("config");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

// Vérifie le code email ; ouvre la session réelle si correct.
export async function verifierCodeEmail(email, code) {
  if (!supabase) throw new Error("config");
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });
  if (error) throw error;
  return data.user;
}

// Ajoute email + mot de passe au compte (créé d'abord par SMS), pour
// permettre ensuite la connexion par identifiant. Passe par une route
// serveur qui rattache l'email déjà confirmé (sans envoi d'email), ce qui
// évite l'étape « confirmation d'email » (et sa dépendance au SMTP).
export async function definirEmailMotDePasse(email, password) {
  if (!supabase) throw new Error("config");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("session");

  const r = await fetch("/api/finaliser-compte", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: token, email, password }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    const err = new Error(d.erreur || "echec");
    if (d.erreur === "email_pris") err.code = "email_exists";
    throw err;
  }
  // Le changement de mot de passe côté serveur invalide la session SMS.
  // On rouvre une session propre avec le nouvel email + mot de passe, pour
  // que la suite de l'inscription (profil) reste authentifiée.
  const { error: eLogin } = await supabase.auth.signInWithPassword({ email, password });
  if (eLogin) throw eLogin;
}

// Connexion par identifiant (email OU nom d'utilisateur) + mot de passe.
export async function connexionIdentifiant(identifiant, password) {
  if (!supabase) throw new Error("config");
  let email = (identifiant || "").trim();
  if (!email.includes("@")) {
    // Nom d'utilisateur → on résout l'email associé côté serveur.
    const r = await fetch("/api/resoudre-identifiant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiant: email }),
    });
    if (!r.ok) throw new Error("introuvable");
    const d = await r.json();
    email = d.email;
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

// ---- Profil patient / établissement (champs obligatoires) ----

export async function utilisateurCourant() {
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Renvoie le profil s'il existe (⇔ compte déjà finalisé), sinon null.
export async function chargerProfil(uid) {
  if (!supabase || !uid) return null;
  const { data } = await supabase.from("profil").select("*").eq("id", uid).maybeSingle();
  return data || null;
}

// Enregistre / met à jour le profil de l'utilisateur connecté.
export async function enregistrerProfil(champs) {
  if (!supabase) throw new Error("config");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("non connecté");
  const { error } = await supabase
    .from("profil")
    .upsert({ id: user.id, ...champs, maj_le: new Date().toISOString() });
  if (error) throw error;
}
