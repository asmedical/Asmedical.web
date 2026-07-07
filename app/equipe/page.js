"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// L'ancien back-office par code (ASM2026) est remplacé par le véritable
// espace d'administration /admin (accès par rôle interne, sécurisé côté
// serveur). On redirige toute visite de /equipe vers /admin.
export default function EquipeRedirige() {
  const routeur = useRouter();
  useEffect(() => {
    routeur.replace("/admin");
  }, [routeur]);
  return (
    <div className="adm-page">
      <p className="adm-vide" style={{ padding: 40 }}>
        Redirection vers l&apos;espace d&apos;administration…
      </p>
    </div>
  );
}
