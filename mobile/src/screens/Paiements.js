// Paiements et factures — écran natif, même API que le site
// (/api/finances/moi et /api/finances/payer).
//
// Le règlement porte sur des services RÉELS — transport, aide à domicile —
// et non sur des biens numériques : rien n'oblige à passer par le paiement
// intégré d'Apple. Un paiement en ligne ouvre la page sécurisée du
// fournisseur, comme sur le site ; espèces et virement restent hors ligne.
import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, S } from "../theme";
import { Bouton, Charge } from "../ui";
import { useLangue } from "../i18n";
import { apiGet, apiPost } from "../api";

const DA = (n) => `${Number(n || 0).toLocaleString("fr-FR")} DZD`;
const A_REGLER = ["EMISE", "PARTIELLEMENT_PAYEE", "EN_RETARD"];

function Bandeau({ ton, titre, texte }) {
  const couleurs = {
    ko: { fond: "#FBEDED", bord: "#E3B7B7", texte: "#B03A3A" },
    du: { fond: C.vertPale, bord: C.vert, texte: C.vertFonce },
    ok: { fond: C.vertPale, bord: C.vert, texte: C.vertFonce },
  }[ton];
  return (
    <View style={[S.carte, { backgroundColor: couleurs.fond, borderColor: couleurs.bord, marginBottom: 12 }]}>
      <Text style={{ fontWeight: "800", color: couleurs.texte, fontSize: 15.5 }}>{titre}</Text>
      {!!texte && <Text style={{ color: C.encre, marginTop: 5, fontSize: 14.5 }}>{texte}</Text>}
    </View>
  );
}

export default function Paiements() {
  const { t } = useLangue();
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState(null);
  const [occupe, setOccupe] = useState("");
  const [rafraichit, setRafraichit] = useState(false);

  const charger = useCallback(async () => {
    try {
      setD(await apiGet("/api/finances/moi"));
      setErreur("");
    } catch (e) {
      setErreur(e?.data?.erreur || t("pr_err"));
      setD((x) => x || { factures: [], paiements: [], tickets: [], souscriptions: [], moyens: [], resume: { duTotal: 0, enRetard: 0 } });
    }
  }, [t]);

  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  async function payer(facture, moyen) {
    setErreur("");
    setInfo(null);
    setOccupe(`${facture.id}-${moyen}`);
    try {
      const r = await apiPost("/api/finances/payer", { factureId: facture.id, moyen });
      if (r.type === "en_ligne" && r.url) {
        // Page sécurisée du fournisseur : elle doit s'ouvrir dans le
        // navigateur, jamais dans une vue interne.
        Linking.openURL(r.url).catch(() => setErreur(t("pr_err")));
      } else if (r.type === "ticket") {
        setInfo({ type: "ticket", ticket: r.ticket });
      } else if (r.type === "virement") {
        setInfo({ type: "virement", infos: r.infos, paiement: r.paiement });
      }
      await charger();
    } catch (e) {
      setErreur(e?.data?.erreur || t("pr_err"));
    }
    setOccupe("");
  }

  if (d === null) return <View style={S.ecran}><Charge /></View>;

  const aPayer = (d.factures || []).filter((f) => A_REGLER.includes(f.statut));
  const ticketsActifs = (d.tickets || []).filter((tk) => tk.statut === "EN_ATTENTE");
  const resume = d.resume || { duTotal: 0, enRetard: 0 };

  return (
    <ScrollView
      style={S.ecran}
      contentContainerStyle={S.contenu}
      refreshControl={
        <RefreshControl refreshing={rafraichit} onRefresh={async () => { setRafraichit(true); await charger(); setRafraichit(false); }} />
      }
    >
      <Text style={S.h1}>{t("pf_t")}</Text>
      {!!d.compte?.numero && <Text style={S.sous}>{t("pf_s")} {d.compte.numero}</Text>}

      {resume.enRetard > 0 && <Bandeau ton="ko" titre={t("pf_retard_t")} texte={`${t("pf_retard_p")} ${DA(resume.enRetard)}.`} />}
      {resume.enRetard === 0 && resume.duTotal > 0 && <Bandeau ton="du" titre={t("pf_du_t")} texte={`${DA(resume.duTotal)} — ${t("pf_du_p")}`} />}
      {resume.duTotal === 0 && <Bandeau ton="ok" titre={t("pf_a_jour")} />}

      {!!erreur && <Text style={S.erreur}>{erreur}</Text>}

      {info?.type === "ticket" && (
        <Bandeau
          ton="du"
          titre={t("pf_ticket_ok")}
          texte={`${t("pf_ticket_ref")} : ${info.ticket.reference}`}
        />
      )}
      {info?.type === "virement" && (
        <Bandeau
          ton="du"
          titre={t("pf_virement_t")}
          texte={`${info.infos.banque} · ${info.infos.titulaire}\nRIB ${info.infos.rib}\n${t("pf_virement_ref")} : ${info.paiement.reference}`}
        />
      )}

      <Text style={S.h2}>{t("pf_a_payer")}{aPayer.length ? ` (${aPayer.length})` : ""}</Text>
      {aPayer.length === 0 && <Text style={S.vide}>{t("pf_rien")}</Text>}

      {aPayer.map((f) => (
        <View key={f.id} style={[S.carte, { marginBottom: 10 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", color: C.encre, fontSize: 15.5 }}>{f.numero}</Text>
              {!!f.echeance && (
                <Text style={{ color: C.gris, fontSize: 13, marginTop: 2 }}>
                  {t("pf_echeance")} {new Date(f.echeance).toLocaleDateString("fr-FR")}
                </Text>
              )}
            </View>
            <Text style={{ fontWeight: "800", color: C.vertFonce, fontSize: 16 }}>{DA(f.total - f.paye)}</Text>
          </View>

          {/* Moyens réellement disponibles : la liste vient du serveur, on
              n'affiche jamais un moyen que la plateforme ne sait pas traiter. */}
          <View style={[S.ligneChips, { marginTop: 10 }]}>
            {(d.moyens || []).map((m) => (
              <TouchableOpacity
                key={m.cle || m}
                onPress={() => payer(f, m.cle || m)}
                disabled={!!occupe}
                accessibilityRole="button"
                style={{
                  borderWidth: 1.5, borderColor: C.vert, borderRadius: 12,
                  paddingHorizontal: 14, paddingVertical: 10, marginRight: 8, marginBottom: 8,
                  opacity: occupe === `${f.id}-${m.cle || m}` ? 0.5 : 1,
                }}
              >
                <Text style={{ color: C.vertFonce, fontWeight: "800", fontSize: 14 }}>
                  {m.libelle || t(`pf_moyen_${m.cle || m}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {ticketsActifs.length > 0 && (
        <>
          <Text style={S.h2}>{t("pf_tickets")}</Text>
          {ticketsActifs.map((tk) => (
            <View key={tk.id} style={[S.carte, { marginBottom: 8 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "800", color: C.encre }}>{tk.reference}</Text>
                <Text style={{ fontWeight: "800", color: C.vertFonce }}>{DA(tk.montant)}</Text>
              </View>
              <Text style={{ color: C.gris, fontSize: 13, marginTop: 3 }}>
                {t("pf_ticket_exp")} {new Date(tk.expireLe).toLocaleDateString("fr-FR")}
              </Text>
            </View>
          ))}
        </>
      )}

      {(d.souscriptions || []).length > 0 && (
        <>
          <Text style={S.h2}>{t("pf_abos")}</Text>
          {d.souscriptions.map((sc) => (
            <View key={sc.id} style={[S.carte, { marginBottom: 8 }]}>
              <Text style={{ fontWeight: "800", color: C.encre }}>{sc.plan?.nom || "—"}</Text>
              <Text style={{ color: C.gris, fontSize: 13, marginTop: 3 }}>{sc.statut}</Text>
            </View>
          ))}
        </>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
