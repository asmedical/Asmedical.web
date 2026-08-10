// Prix estimé AVANT réservation.
//
// Mêmes règles et même route que sur le site (/api/finances/estimation) :
// les tarifs en vigueur et la remise du compte connecté. N'affiche rien tant
// que la grille tarifaire n'est pas configurée — une estimation absente vaut
// mieux qu'une estimation fausse.
import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { C, S } from "./theme";
import { useLangue } from "./i18n";
import { apiGet } from "./api";

export default function Estimation({ service, jour, heure, duree, typeTrajet, prioritaire, packId, km, besoins, allerRetour }) {
  const { t } = useLangue();
  const [est, setEst] = useState(null);

  const clefBesoins = (besoins || []).join(",");

  useEffect(() => {
    let annule = false;
    setEst(null);
    if (!jour || !service) return;
    const u = new URLSearchParams({ service, duree: String(duree || 60) });
    u.set("date", `${jour}T${heure || "09:00"}`);
    if (typeTrajet) u.set("typeTrajet", typeTrajet);
    if (prioritaire) u.set("prioritaire", "1");
    if (packId) u.set("pack", String(packId));
    if (Number.isFinite(Number(km))) u.set("km", String(km));
    if (clefBesoins) u.set("besoins", clefBesoins);
    if (allerRetour) u.set("ar", "1");
    apiGet(`/api/finances/estimation?${u}`)
      .then((d) => { if (!annule && d?.disponible) setEst(d); })
      .catch(() => {});
    return () => { annule = true; };
  }, [service, jour, heure, duree, typeTrajet, prioritaire, packId, km, clefBesoins, allerRetour]);

  if (!est) return null;

  return (
    <View style={[S.cartePale, { borderColor: C.vert, marginBottom: 14 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 15 }}>{t("est_t")}</Text>
        <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 17 }}>
          {est.total.toLocaleString("fr-FR")} {est.devise}
        </Text>
      </View>
      {est.lignes.map((l, i) => (
        <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
          <Text style={{ color: C.encre, fontSize: 13, flex: 1 }}>
            {l.libelle}{l.quantite > 1 ? ` × ${l.quantite}` : ""}
          </Text>
          <Text style={{ color: C.encre, fontSize: 13 }}>{l.montant.toLocaleString("fr-FR")}</Text>
        </View>
      ))}
      {est.remiseTotal > 0 && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
          <Text style={{ color: C.vertFonce, fontWeight: "800", fontSize: 13 }}>
            {est.remiseDetail || t("est_remise")}
          </Text>
          <Text style={{ color: C.vertFonce, fontWeight: "800", fontSize: 13 }}>
            -{est.remiseTotal.toLocaleString("fr-FR")}
          </Text>
        </View>
      )}
      <Text style={{ color: C.gris, fontSize: 11.5, marginTop: 6, lineHeight: 16 }}>{t("est_note")}</Text>
    </View>
  );
}
