import { notFound } from "next/navigation";
import PageAide from "@/app/components/aide";
import { AIDE, LANGUES } from "@/lib/aide";

// /aide/ar et /aide/en. Le français vit sur /aide, sans préfixe : c'est la
// langue des patients, elle n'a pas à être reléguée derrière un code.
export function generateStaticParams() {
  return LANGUES.filter((l) => l.cle !== "fr").map((l) => ({ langue: l.cle }));
}

export function generateMetadata({ params }) {
  const a = AIDE[params.langue];
  return a ? { title: `${a.titre} — ASM`, description: a.intro.slice(0, 160) } : {};
}

export default function AideLangue({ params }) {
  if (!AIDE[params.langue] || params.langue === "fr") notFound();
  return <PageAide langue={params.langue} />;
}
