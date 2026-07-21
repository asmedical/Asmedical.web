// Compte de DÉMONSTRATION permanent (examens Google Play / App Store).
// Remplace l'ancien mode test « n'importe quel numéro + code » : désormais,
// UN SEUL numéro whitelisté côté serveur peut se connecter avec un code
// fixe — tout autre numéro exige un vrai code SMS.
//
// Configuration (Vercel uniquement, jamais dans le code) :
//   DEMO_TEL  = numéro E.164 du compte de démonstration (ex. +213550000000)
//   DEMO_CODE = code fixe communiqué aux examinateurs (ex. 123456)
// Transition : tant que DEMO_TEL/DEMO_CODE ne sont pas posés mais que
// l'ancien OTP_TEST_CODE existe encore, le compte de démo par défaut est
// +213550000000 avec ce code — l'accès « tout numéro » est SUPPRIMÉ.

const DEMO_TEL_DEFAUT = "+213550000000"; // numéro communiqué à Google (fiche Play)

export function compteDemo(env = process.env) {
  const tel = env.DEMO_TEL || (env.OTP_TEST_CODE ? DEMO_TEL_DEFAUT : null);
  const code = env.DEMO_CODE || env.OTP_TEST_CODE || null;
  if (!tel || !code) return null;
  return { tel: String(tel).replace(/\D/g, ""), code: String(code).trim() };
}

// Ce numéro est-il LE compte de démonstration ?
export function estNumeroDemo(phone, env = process.env) {
  const demo = compteDemo(env);
  return Boolean(demo && String(phone || "").replace(/\D/g, "") === demo.tel);
}

// Numéro + code valides pour la démonstration ? (strict : numéro ET code)
export function verifierDemo(phone, code, env = process.env) {
  const demo = compteDemo(env);
  if (!demo) return false;
  return (
    String(phone || "").replace(/\D/g, "") === demo.tel &&
    String(code || "").trim() === demo.code
  );
}
