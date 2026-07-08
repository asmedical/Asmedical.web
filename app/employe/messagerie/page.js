"use client";
import { Suspense } from "react";
import CentreMessages from "@/app/components/messagerie-partagee";

// Messagerie de l'employé — même centre de messages que côté patient,
// mais rendu dans l'habillage employé (barre du bas dédiée).
export default function MessagerieEmploye() {
  return (
    <Suspense>
      <CentreMessages />
    </Suspense>
  );
}
