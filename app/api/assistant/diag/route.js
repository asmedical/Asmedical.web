import { NextResponse } from "next/server";
import { testIA } from "@/lib/assistantIA";

export const dynamic = "force-dynamic";

// Diagnostic de l'assistant IA (Gemini). À ouvrir dans le navigateur :
// /api/assistant/diag . Indique si la clé est lue et si Gemini répond, avec la
// raison d'erreur — SANS jamais exposer la clé. À retirer après le réglage.
export async function GET() {
  const r = await testIA();
  return NextResponse.json(
    {
      ...r,
      verdict: r.ok
        ? "✅ Gemini répond : l'assistant IA est opérationnel."
        : "❌ Gemini ne répond pas — voir « raison ».",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
