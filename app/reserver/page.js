"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Le parcours démarre à l'accueil, qui pose déjà la question du service et
// celle du patient concerné. Cette adresse a existé le temps de construire
// les étapes ; elle reste pour ne pas casser un lien déjà partagé.
export default function Reserver() {
  const routeur = useRouter();
  useEffect(() => {
    routeur.replace("/accueil");
  }, [routeur]);
  return <div className="page" />;
}
