import { NextResponse } from "next/server";
import crypto from "crypto";
import { sendOtp } from "@/lib/sms";

// « Send SMS Hook » de Supabase Auth.
//
// Circuit complet de la connexion par SMS :
//   1. L'utilisateur demande un code → Supabase GÉNÈRE l'OTP.
//   2. Supabase appelle CE hook (POST) avec { user, sms:{ otp } }.
//   3. On achemine le code par SMS via l'abstraction lib/sms
//      (fournisseur choisi par SMS_PROVIDER : twilio | sms_partner | infobip | mock).
//   4. L'utilisateur saisit le code → Supabase le VÉRIFIE.
// Notre seul rôle est l'étape 3 : envoyer le SMS. On ne génère ni ne vérifie
// jamais le code nous-mêmes.
//
// Sécurité : Supabase signe chaque appel (standard-webhooks). On vérifie la
// signature avec SMS_HOOK_SECRET (fourni par Supabase, format « v1,whsec_… »)
// avant tout envoi, pour refuser les requêtes qui ne viennent pas de Supabase.

export const dynamic = "force-dynamic";

// Vérifie la signature standard-webhooks. En-têtes attendus :
//   webhook-id, webhook-timestamp, webhook-signature (« v1,<base64> … »).
// Corps signé = `${id}.${timestamp}.${payloadBrut}`, HMAC-SHA256, clé = secret
// décodé depuis sa partie base64.
function signatureValide(secret, headers, payloadBrut) {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!id || !timestamp || !signatures) return false;

  const base = secret.replace(/^v1,?/, "").replace(/^whsec_/, "");
  let cle;
  try {
    cle = Buffer.from(base, "base64");
  } catch {
    return false;
  }

  const attendue = crypto
    .createHmac("sha256", cle)
    .update(`${id}.${timestamp}.${payloadBrut}`)
    .digest("base64");

  // L'en-tête peut contenir plusieurs signatures « v1,<sig> v2,<sig> ».
  return signatures.split(" ").some((part) => {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    if (!sig || sig.length !== attendue.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(attendue));
    } catch {
      return false;
    }
  });
}

export async function POST(req) {
  const payloadBrut = await req.text();

  // Vérification de signature (si le secret est configuré).
  const secret = process.env.SMS_HOOK_SECRET;
  if (secret && !signatureValide(secret, req.headers, payloadBrut)) {
    return NextResponse.json(
      { error: { http_code: 401, message: "signature invalide" } },
      { status: 401 }
    );
  }

  let corps;
  try {
    corps = JSON.parse(payloadBrut);
  } catch {
    return NextResponse.json(
      { error: { http_code: 400, message: "payload invalide" } },
      { status: 400 }
    );
  }

  const phone = corps?.user?.phone;
  const otp = corps?.sms?.otp;
  if (!phone || !otp) {
    return NextResponse.json(
      { error: { http_code: 400, message: "numéro ou code manquant" } },
      { status: 400 }
    );
  }

  try {
    await sendOtp(phone, otp);
    // Supabase attend un corps vide (ou {}) en cas de succès.
    return NextResponse.json({});
  } catch (e) {
    // L'erreur est déjà journalisée (numéro masqué) dans lib/sms.
    return NextResponse.json(
      { error: { http_code: 500, message: "échec de l'envoi du SMS" } },
      { status: 500 }
    );
  }
}
