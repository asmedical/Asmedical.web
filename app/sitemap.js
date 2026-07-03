const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://asmedical.vercel.app";

// Pages publiques à référencer (SEO local : « transport dialyse Alger »…)
export default function sitemap() {
  return ["", "/accueil", "/connaitre", "/connexion", "/role"].map((p) => ({
    url: `${BASE}${p || "/"}`,
    changeFrequency: "monthly",
    priority: p === "" ? 1 : 0.7,
  }));
}
