import { createClient } from "@supabase/supabase-js";

// Client Supabase côté navigateur (Storage + Auth).
// Les variables NEXT_PUBLIC_* sont injectées au build par Vercel.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anon);

export const supabase = supabaseConfigured
  ? createClient(url, anon, {
      // detectSessionInUrl : indispensable au retour des connexions
      // Google / Facebook / Apple (le jeton arrive dans l'URL de retour).
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    })
  : null;

// Connexion via un fournisseur externe (google | facebook | apple).
// Le fournisseur doit être activé dans Supabase (Authentication → Providers).
// Robustesse : on pose un drapeau (sessionStorage) AVANT de partir. Au
// retour — que Supabase nous redépose sur /connexion OU sur la « Site URL »
// (accueil) —, un filet global (providers) ramène l'utilisateur sur
// /connexion, où la session est détectée puis aiguillée selon le rôle.
export async function connexionOAuth(provider) {
  if (!supabase) throw new Error("config");
  try { sessionStorage.setItem("asm_oauth_retour", "1"); } catch {}
  // On marque le retour DANS L'URL (?oauth=retour), pas seulement en
  // sessionStorage : certains navigateurs (Chrome, apps embarquées) perdent le
  // sessionStorage en changeant de contexte pendant la redirection Google.
  // Supabase ajoute ensuite « &code=… » que detectSessionInUrl échange.
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/connexion?oauth=retour` },
  });
  if (error) {
    try { sessionStorage.removeItem("asm_oauth_retour"); } catch {}
    throw error;
  }
}

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

// Met un numéro saisi localement au format international (E.164), selon
// l'indicatif pays choisi par l'utilisateur (défaut Algérie +213).
// Ex. indicatif "+33" : 0746 79 24 62 → +33746792462.
// Un numéro déjà tapé en +... ou 00... est respecté tel quel.
export function normaliserTel(saisie, indicatif = "+213") {
  let s = (saisie || "").replace(/[\s.\-()]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return "+" + s.slice(2);
  if (s.startsWith("0")) return indicatif + s.slice(1);
  return indicatif + s;
}

// Envoie un code de connexion par SMS (Supabase → passerelle SMS).
// COMPTE DE DÉMONSTRATION (examens Google/Apple) : si l'envoi SMS échoue
// mais que CE numéro est le compte de démo whitelisté serveur, on laisse
// passer à l'écran code — son code fixe y sera accepté. Tout autre numéro
// suit le flux SMS réel.
export async function envoyerCode(phone) {
  if (!supabase) throw new Error("config");
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) {
    try {
      const r = await fetch(`/api/otp-test?phone=${encodeURIComponent(phone)}`);
      const d = await r.json();
      if (d?.actif) return; // compte de démonstration : on continue sans SMS
    } catch {}
    throw error;
  }
}

// Vérifie le code reçu ; ouvre la session réelle si correct.
// En repli, tente le compte de DÉMONSTRATION côté serveur (numéro
// whitelisté uniquement — refusé pour tout autre numéro).
export async function verifierCode(phone, code) {
  if (!supabase) throw new Error("config");
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
  if (!error) return data.user;

  try {
    const r = await fetch("/api/otp-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    if (r.ok) {
      const d = await r.json();
      const { data: co, error: eCo } = await supabase.auth.signInWithPassword({
        phone: d.phone,
        password: d.motDePasse,
      });
      if (!eCo && co?.user) return co.user;
    }
  } catch {}
  throw error;
}

export async function deconnexion() {
  if (supabase) await supabase.auth.signOut();
}

// Récupère les VRAIES demandes du patient connecté (via /api/mes-demandes).
export async function chargerMesDemandes() {
  if (!supabase) return [];
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return [];
  const r = await fetch("/api/mes-demandes", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return [];
  const d = await r.json();
  return d.demandes || [];
}

// Change le mot de passe de l'utilisateur connecté.
export async function changerMotDePasse(nouveau) {
  if (!supabase) throw new Error("config");
  const { error } = await supabase.auth.updateUser({ password: nouveau });
  if (error) throw error;
}

// Première connexion employé : enregistre le nouveau mot de passe ET lève
// l'obligation « mot de passe temporaire » (métadonnées utilisateur).
// On rafraîchit ensuite la session pour que le nouveau jeton reflète
// immédiatement les métadonnées (sinon le serveur pourrait encore voir
// l'ancien état et redemander un changement).
export async function definirMotDePasseDefinitif(nouveau) {
  if (!supabase) throw new Error("config");
  const { data: { user } } = await supabase.auth.getUser();
  const meta = user?.user_metadata || {};
  const { error } = await supabase.auth.updateUser({
    password: nouveau,
    data: {
      ...meta,
      must_change_password: false,
      password_changed_at: new Date().toISOString(),
      first_login_at: meta.first_login_at || new Date().toISOString(),
    },
  });
  if (error) throw error;
  try {
    await supabase.auth.refreshSession();
  } catch {}
}

// ---- Connexion / CRÉATION de compte par email ----
// Envoie un code à 6 chiffres par email ; crée le compte s'il n'existe pas
// (alternative au SMS : indispensable hors d'Algérie tant que l'envoi
// international n'est pas branché).
export async function envoyerCodeEmailCreation(email) {
  if (!supabase) throw new Error("config");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
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
