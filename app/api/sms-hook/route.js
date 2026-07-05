import { NextResponse } from "next/server";

// « Send SMS Hook » appelé par Supabase pour envoyer le code de connexion
// via la passerelle SMS algérienne choisie.
//
// ⚠️ À NE PAS activer côté Supabase tant que le fournisseur n'est pas branché.
// Pendant la phase de test, on utilise les « numéros de test » de Supabase,
// qui ne passent pas par ce hook.
//
// Quand le fournisseur sera choisi, on renseignera dans Vercel :
//   SMS_API_URL     — endpoint d'envoi de la passerelle
//   SMS_API_KEY     — clé / identifiant de la passerelle
//   SMS_EXPEDITEUR  — nom d'expéditeur affiché (sender ID), ex. "ASM"
// et on remplira l'appel ci-dessous selon la doc du fournisseur.

export async function POST(req) {
  try {
    const corps = await req.json();
    const phone = corps?.user?.phone;
    const otp = corps?.sms?.otp;
    if (!phone || !otp) {
      return NextResponse.json({ error: "payload invalide" }, { status: 400 });
    }

    const message = `ASM : votre code de connexion est ${otp}. Il expire dans 5 minutes.`;

    if (!process.env.SMS_API_URL) {
      // Passerelle pas encore branchée.
      return NextResponse.json({ error: "passerelle SMS non configurée" }, { status: 501 });
    }

    // TODO — adapter à la doc du fournisseur algérien une fois le devis reçu :
    // await fetch(process.env.SMS_API_URL, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${process.env.SMS_API_KEY}`,
    //   },
    //   body: JSON.stringify({
    //     to: phone,
    //     from: process.env.SMS_EXPEDITEUR || "ASM",
    //     text: message,
    //   }),
    // });

    return NextResponse.json({});
  } catch {
    return NextResponse.json({ error: "erreur serveur" }, { status: 500 });
  }
}
