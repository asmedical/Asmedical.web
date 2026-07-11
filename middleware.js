import { NextResponse } from "next/server";

// Mode maintenance activable sans redéploiement de code :
// il suffit de mettre MAINTENANCE_MODE=on dans Vercel puis de redéployer
// (ou de re-déclencher). /api/health reste joignable pour le monitoring.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo-asm.jpg|icone-|manifest.webmanifest|robots.txt|sitemap.xml|sw.js|api/health).*)",
  ],
};

export function middleware(req) {
  if (process.env.MAINTENANCE_MODE === "on") {
    const { pathname } = req.nextUrl;
    if (!pathname.startsWith("/maintenance")) {
      const url = req.nextUrl.clone();
      url.pathname = "/maintenance";
      return NextResponse.rewrite(url);
    }
  }
  return NextResponse.next();
}
