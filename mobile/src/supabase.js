// Client Supabase de l'application mobile — MÊME projet que le site :
// un compte créé sur le site fonctionne dans l'app, et inversement.
// La session est conservée sur l'appareil (AsyncStorage).
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { API_BASE } from "./api";

// Clés PUBLIQUES (anon) — identiques à celles du site, sans aucun secret.
const URL_SUPABASE = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const CLE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabaseConfigure = Boolean(URL_SUPABASE && CLE_ANON);

export const supabase = supabaseConfigure
  ? createClient(URL_SUPABASE, CLE_ANON, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Numéro local → international (+213 par défaut) — même règle que le site.
export function normaliserTel(saisie, indicatif = "+213") {
  let s = (saisie || "").replace(/[\s.\-()]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return "+" + s.slice(2);
  if (s.startsWith("0")) return indicatif + s.slice(1);
  return indicatif + s;
}

// Envoi du code (Supabase → SMS/WhatsApp). Si l'envoi échoue mais que CE
// numéro est le compte de DÉMONSTRATION whitelisté serveur (examens des
// stores), on continue quand même vers l'écran code.
export async function envoyerCode(phone) {
  if (!supabase) throw new Error("config");
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) {
    try {
      const r = await fetch(`${API_BASE}/api/otp-test?phone=${encodeURIComponent(phone)}`);
      const d = await r.json();
      if (d?.actif) return;
    } catch {}
    throw error;
  }
}

// Vérification du code (avec repli compte de DÉMONSTRATION, identique au site).
export async function verifierCode(phone, code) {
  if (!supabase) throw new Error("config");
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
  if (!error) return data.user;
  try {
    const r = await fetch(`${API_BASE}/api/otp-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    if (r.ok) {
      const d = await r.json();
      const co = await supabase.auth.signInWithPassword({ phone: d.phone, password: d.motDePasse });
      if (!co.error) return co.data.user;
    }
  } catch {}
  throw error;
}

// Connexion identifiant (email / téléphone / nom d'utilisateur) + mot de passe.
export async function connexionIdentifiant(identifiant, motDePasse) {
  if (!supabase) throw new Error("config");
  const brut = String(identifiant || "").trim();
  let essais = [];
  if (brut.includes("@")) essais.push({ email: brut.toLowerCase() });
  else if (/^[+0-9][0-9 .\-()]*$/.test(brut)) essais.push({ phone: normaliserTel(brut) });
  else {
    // Nom d'utilisateur → résolu côté serveur (même route que le site).
    const r = await fetch(`${API_BASE}/api/resoudre-identifiant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiant: brut }),
    });
    if (r.ok) {
      const d = await r.json();
      if (d.email) essais.push({ email: d.email });
    }
  }
  for (const e of essais) {
    const { data, error } = await supabase.auth.signInWithPassword({ ...e, password: motDePasse });
    if (!error) return data.user;
  }
  throw new Error("identifiants");
}

export async function chargerProfil(userId) {
  if (!supabase || !userId) return null;
  const { data } = await supabase.from("profil").select("*").eq("id", userId).maybeSingle();
  return data || null;
}

export async function deconnexion() {
  if (supabase) await supabase.auth.signOut();
}
