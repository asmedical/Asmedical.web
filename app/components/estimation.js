"use client";
import { useEffect, useState } from "react";

// Prix estimé AVANT réservation.
//
// Interroge les tarifs en vigueur — les mêmes règles que la facture finale —
// et la remise du client connecté. N'affiche rien tant que la grille
// tarifaire n'est pas configurée : une estimation absente vaut mieux qu'une
// estimation fausse.
//
// Ce composant est partagé par l'ancien formulaire et le parcours guidé :
// deux calculs d'estimation auraient fini par annoncer deux prix différents
// pour la même course.
export default function EstimationPrix({
  t, service, jour, heure, duree, typeTrajet, prioritaire, visible,
  packId, km, besoins, allerRetour,
}) {
  const [est, setEst] = useState(null);

  useEffect(() => {
    let annule = false;
    setEst(null);
    if (!visible || !jour) return;
    (async () => {
      try {
        const u = new URLSearchParams({ service, duree: String(duree || 60) });
        u.set("date", `${jour}T${heure || "09:00"}`);
        if (typeTrajet) u.set("typeTrajet", typeTrajet);
        if (prioritaire) u.set("prioritaire", "1");
        if (packId) u.set("pack", String(packId));
        if (Number.isFinite(km)) u.set("km", String(km));
        if (besoins?.length) u.set("besoins", besoins.join(","));
        if (allerRetour) u.set("ar", "1");
        let token = "";
        try {
          const { supabase } = await import("@/lib/supabase");
          const { data: { session } } = await supabase.auth.getSession();
          token = session?.access_token || "";
        } catch {}
        const r = await fetch(`/api/finances/estimation?${u.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const d = await r.json();
        if (!annule && r.ok && d.disponible) setEst(d);
      } catch {}
    })();
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, service, jour, heure, duree, typeTrajet, prioritaire, packId, km, allerRetour, besoins?.join(",")]);

  if (!est) return null;
  return (
    <div className="estimation">
      <div className="estimation-tete">
        <strong>{t("est_t")}</strong>
        <strong className="estimation-total">{est.total.toLocaleString("fr-FR")} {est.devise}</strong>
      </div>
      <ul>
        {est.lignes.map((l, i) => (
          <li key={i}>
            <span>{l.libelle}{l.quantite > 1 ? ` × ${l.quantite}` : ""}</span>
            <span>{l.montant.toLocaleString("fr-FR")}</span>
          </li>
        ))}
        {est.remiseTotal > 0 && (
          <li className="estimation-remise">
            <span>{est.remiseDetail || t("est_remise")}</span>
            <span>-{est.remiseTotal.toLocaleString("fr-FR")}</span>
          </li>
        )}
      </ul>
      <small>{t("est_note")}</small>
    </div>
  );
}
