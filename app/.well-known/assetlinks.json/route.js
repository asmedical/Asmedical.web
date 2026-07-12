import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Lien numérique site ↔ application Android (Trusted Web Activity).
// Nécessaire pour que l'app Google Play s'ouvre en plein écran, sans
// barre de navigateur. L'empreinte SHA-256 du certificat de signature
// est fournie par la Play Console (Intégrité de l'application →
// Signature d'application) et se colle dans Vercel :
//   ANDROID_ASSETLINKS_SHA256=AA:BB:...  (plusieurs possibles, séparées par des virgules)
export async function GET() {
  const brut = process.env.ANDROID_ASSETLINKS_SHA256 || "";
  const empreintes = brut.split(",").map((s) => s.trim()).filter(Boolean);
  const paquet = process.env.ANDROID_PACKAGE_NAME || "com.asmsante.app";
  if (!empreintes.length) return NextResponse.json([]);
  return NextResponse.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: paquet,
        sha256_cert_fingerprints: empreintes,
      },
    },
  ]);
}
