/** @type {import('next').NextConfig} */

// En-têtes de sécurité appliqués à toutes les réponses.
// (Pas de Content-Security-Policy stricte ici pour ne pas casser les polices
//  Google, Supabase, etc. — à ajouter plus tard en mode « report-only » d'abord.)
const enTetesSecurite = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // masque l'en-tête « X-Powered-By: Next.js »
  eslint: { ignoreDuringBuilds: true }, // le lint ne doit jamais casser le build de prod
  async headers() {
    return [{ source: "/:path*", headers: enTetesSecurite }];
  },
};

module.exports = nextConfig;
