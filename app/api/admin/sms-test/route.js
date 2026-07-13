import { NextResponse } from "next/server";
import { verifierAdmin, journaliser, refus, ROLES_GESTION_EQUIPE } from "@/lib/adminAuth";
import { choisirFournisseur, sendSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

// Diagnostic & test des SMS — SUPER ADMIN uniquement.
// GET  : état de la configuration (présence des variables, JAMAIS leurs valeurs).
// POST : envoie un vrai SMS de test au numéro fourni (journalisé).

export async function GET(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_EQUIPE);
  if (!acces) return refus();
  const { nom } = choisirFournisseur("+213550000000");
  const eliteConfigure = !!(process.env.ELITESMS_API_KEY && process.env.ELITESMS_USER_KEY);

  // Crédit Elite = test d'authentification GRATUIT (aucun SMS consommé).
  let credit = null, erreurElite = null;
  if (eliteConfigure) {
    try {
      const { creditElite } = await import("@/lib/sms/elitesms");
      credit = await creditElite();
    } catch (e) {
      erreurElite = String(e.message || "injoignable").slice(0, 200);
    }
  }

  return NextResponse.json({
    fournisseurAlgerie: nom, // fournisseur retenu pour un numéro algérien
    elite: eliteConfigure,
    credit, erreurElite,
    twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    whatsapp: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
    modeTestOtp: !!process.env.OTP_TEST_CODE, // ⚠ à retirer avant le lancement
  });
}

export async function POST(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_EQUIPE);
  if (!acces) return refus();
  try {
    const { telephone } = await req.json();
    const tel = String(telephone || "").trim();
    if (!/^[+0-9 ().-]{8,20}$/.test(tel)) {
      return NextResponse.json({ erreur: "Numéro invalide." }, { status: 400 });
    }
    const res = await sendSms(tel, "ASM : SMS de test — votre configuration d'envoi fonctionne ✓");
    await journaliser(acces.nomAffiche, "sms.test", "sms", 0, `fournisseur ${res.fournisseur}`);
    if (res.fournisseur === "mock") {
      return NextResponse.json({
        ok: false,
        fournisseur: "mock",
        erreur: "Aucun fournisseur ne gère ce numéro : rien n'a été envoyé. Numéro algérien (05/06/07 ou +213…) → Elite SMS ; autre pays → Twilio (non configuré).",
      });
    }
    // « detail » = réponse brute du fournisseur (jamais de clé dedans) —
    // indispensable pour diagnostiquer un SMS accepté mais non reçu.
    return NextResponse.json({ ok: true, fournisseur: res.fournisseur, id: res.id || null, detail: res.brut || null });
  } catch (e) {
    // Message d'erreur du fournisseur (jamais de clé dedans) pour diagnostiquer.
    return NextResponse.json({ ok: false, erreur: String(e.message || "envoi impossible").slice(0, 300) }, { status: 502 });
  }
}
