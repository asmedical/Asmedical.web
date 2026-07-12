// Appels vers les API du site ASM — la MÊME plateforme que le web :
// mêmes routes, même base de données, synchronisation immédiate.
import Constants from "expo-constants";

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  "https://asm-sante.com";

async function jeton() {
  const { supabase } = require("./supabase");
  if (!supabase) return "";
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || "";
}

async function appel(chemin, options = {}) {
  const token = await jeton();
  const r = await fetch(`${API_BASE}${chemin}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  let data = null;
  try {
    data = await r.json();
  } catch {}
  if (!r.ok) {
    const err = new Error(data?.erreur || `HTTP ${r.status}`);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const apiGet = (chemin) => appel(chemin);
export const apiPost = (chemin, corps) =>
  appel(chemin, { method: "POST", body: JSON.stringify(corps) });
