import PageAide from "@/app/components/aide";

// URL d'assistance publique — c'est celle qui est déclarée aux stores.
// Le français est servi directement, sans redirection : une adresse qui
// rebondit avant d'afficher quelque chose est un mauvais point de contact
// quand la connexion est mauvaise.
export const metadata = {
  title: "Assistance — ASM",
  description:
    "Joindre ASM : téléphone, WhatsApp, e-mail. Aide à la connexion, réservation, suppression de compte. Français, العربية, English.",
};

export default function Aide() {
  return <PageAide langue="fr" />;
}
