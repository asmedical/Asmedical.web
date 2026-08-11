import { notFound } from "next/navigation";
import PagePolitique from "@/app/components/confidentialite";
import { POLITIQUE, LANGUES } from "@/lib/confidentialite";

// /confidentialite/ar et /confidentialite/en.
export function generateStaticParams() {
  return LANGUES.filter((l) => l.cle !== "fr").map((l) => ({ langue: l.cle }));
}

export function generateMetadata({ params }) {
  const p = POLITIQUE[params.langue];
  return p ? { title: `ASM — ${p.titre}` } : {};
}

export default function PolitiqueLangue({ params }) {
  if (!POLITIQUE[params.langue] || params.langue === "fr") notFound();
  return <PagePolitique langue={params.langue} />;
}
