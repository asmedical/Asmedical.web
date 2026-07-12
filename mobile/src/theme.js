// Charte graphique ASM — identique au site (vert, crème, or).
import { StyleSheet } from "react-native";

export const C = {
  vert: "#0E6B3F",
  vertFonce: "#0A5230",
  vertPale: "#F4F9F6",
  ligne: "#E6EEE9",
  or: "#C9A24B",
  encre: "#22332C",
  gris: "#6B7A72",
  grisClair: "#93A79B",
  blanc: "#FFFFFF",
  rouge: "#A33B3B",
};

export const S = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: C.blanc },
  contenu: { padding: 18, paddingBottom: 40 },
  h1: { fontSize: 26, fontWeight: "800", color: C.vertFonce, marginBottom: 6 },
  h2: { fontSize: 17, fontWeight: "800", color: C.vertFonce, marginTop: 18, marginBottom: 8 },
  sous: { fontSize: 15, color: C.gris, marginBottom: 14, lineHeight: 21 },
  carte: {
    backgroundColor: C.blanc, borderWidth: 1, borderColor: C.ligne, borderRadius: 16,
    padding: 14, marginBottom: 10,
  },
  cartePale: {
    backgroundColor: C.vertPale, borderWidth: 1, borderColor: C.ligne, borderRadius: 16,
    padding: 14, marginBottom: 10,
  },
  label: { fontSize: 13.5, fontWeight: "700", color: C.encre, marginBottom: 6 },
  champ: {
    borderWidth: 1.5, borderColor: C.ligne, borderRadius: 12, backgroundColor: C.blanc,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.encre, marginBottom: 12,
  },
  bouton: {
    backgroundColor: C.vert, borderRadius: 14, paddingVertical: 15, alignItems: "center",
  },
  boutonTxt: { color: C.blanc, fontSize: 16.5, fontWeight: "800" },
  boutonSec: {
    backgroundColor: C.blanc, borderWidth: 1.5, borderColor: C.ligne, borderRadius: 14,
    paddingVertical: 13, alignItems: "center",
  },
  boutonSecTxt: { color: C.vertFonce, fontSize: 15, fontWeight: "700" },
  erreur: { color: C.rouge, fontSize: 14, marginVertical: 8, fontWeight: "600" },
  vide: { textAlign: "center", color: C.gris, fontSize: 15, paddingVertical: 30 },
  chip: {
    borderWidth: 1.5, borderColor: C.ligne, borderRadius: 99, paddingHorizontal: 15,
    paddingVertical: 9, marginRight: 8, marginBottom: 8, backgroundColor: C.blanc,
  },
  chipActif: { borderColor: C.vert, backgroundColor: C.vertPale },
  chipTxt: { fontSize: 14, fontWeight: "700", color: C.encre },
  chipTxtActif: { color: C.vertFonce },
  ligneChips: { flexDirection: "row", flexWrap: "wrap" },
  pastille: {
    borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.vertPale,
    alignSelf: "flex-start",
  },
  pastilleTxt: { fontSize: 12, fontWeight: "800", color: C.vertFonce },
});
