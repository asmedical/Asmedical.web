import PagePolitique from "@/app/components/confidentialite";

// Politique de confidentialité — exigée par Apple et Google Play.
// Le texte vient de lib/confidentialite.js, source unique partagée avec
// l'application (via /api/confidentialite) : un document juridique ne doit
// pas exister en deux versions destinées à diverger.
//
// Cette adresse reste celle du français, sans préfixe : elle est déjà
// déclarée dans les stores et citée dans l'application.
export const metadata = {
  title: "ASM — Politique de confidentialité",
  description: "Comment ASM collecte, utilise et protège vos données personnelles.",
};

export default function Confidentialite() {
  return <PagePolitique langue="fr" />;
}
