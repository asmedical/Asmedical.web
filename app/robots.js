const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://asmedical.vercel.app";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Espaces privés : inutiles pour Google, on ne les indexe pas
      disallow: ["/equipe", "/tableau", "/suivi", "/messagerie", "/documentation", "/api/"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
