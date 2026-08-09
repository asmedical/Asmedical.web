// Verrouillage biométrique OPTIONNEL (Face ID / empreinte) — expo-local-authentication.
// Activé par le client dans son Profil : l'app exige alors la biométrie à
// l'ouverture et au retour d'arrière-plan (> 1 min) pour protéger ses
// données médicales. La préférence reste locale à l'appareil (AsyncStorage) ;
// aucune donnée biométrique ne quitte jamais le téléphone (API système).
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

const CLE = "asm_verrou_bio";
const DELAI_REVERROU_MS = 60 * 1000; // re-verrouille après 1 min en arrière-plan

const Ctx = createContext(null);
export const useVerrou = () => useContext(Ctx);

// "faceid" | "empreinte" | null (pour adapter les libellés à l'appareil)
export async function typeBiometrie() {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) return null;
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "faceid";
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "empreinte";
    return types.length ? "empreinte" : null;
  } catch {
    return null;
  }
}

export function VerrouProvider({ children }) {
  const [actif, setActif] = useState(null);        // préférence (null = chargement)
  const [verrouille, setVerrouille] = useState(false);
  const enFond = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(CLE).then((v) => {
      setActif(v === "1");
      if (v === "1") setVerrouille(true); // verrou au démarrage à froid
    }).catch(() => setActif(false));
  }, []);

  // Re-verrouillage au retour d'arrière-plan (au-delà du délai).
  //
  // L'horodatage est REMIS À ZÉRO dès qu'on revient au premier plan. Sans
  // cela il restait en mémoire : chaque retour suivant — y compris celui que
  // provoque l'invite Face ID elle-même — retrouvait un délai déjà dépassé et
  // reverrouillait aussitôt. L'application repartait alors en boucle sans fin,
  // sans que l'utilisateur puisse en sortir.
  useEffect(() => {
    const abo = AppState.addEventListener("change", (etat) => {
      if (etat === "background") {
        enFond.current = Date.now();
        return;
      }
      if (etat === "active") {
        const depuis = enFond.current;
        enFond.current = 0; // consommé : ne resservira pas
        if (actif && depuis && Date.now() - depuis > DELAI_REVERROU_MS) setVerrouille(true);
      }
    });
    return () => abo.remove();
  }, [actif]);

  async function authentifier(invite, annuler) {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: invite,
      cancelLabel: annuler,
    });
    return r.success === true;
  }

  // Activation : matériel + biométrie enregistrée + un test réussi.
  async function activer(invite, annuler) {
    if (!(await LocalAuthentication.hasHardwareAsync())) return { erreur: "materiel" };
    if (!(await LocalAuthentication.isEnrolledAsync())) return { erreur: "non_configure" };
    if (!(await authentifier(invite, annuler))) return { erreur: "refuse" };
    await AsyncStorage.setItem(CLE, "1").catch(() => {});
    setActif(true);
    return { ok: true };
  }

  // Désactivation : confirmée par la biométrie (personne d'autre ne peut la retirer).
  async function desactiver(invite, annuler) {
    if (!(await authentifier(invite, annuler))) return { erreur: "refuse" };
    await AsyncStorage.removeItem(CLE).catch(() => {});
    setActif(false);
    setVerrouille(false);
    return { ok: true };
  }

  async function deverrouiller(invite, annuler) {
    if (await authentifier(invite, annuler)) {
      enFond.current = 0; // rien ne doit reverrouiller juste après
      setVerrouille(false);
      return true;
    }
    return false;
  }

  // Sortie de secours : si la biométrie ne passe plus (capteur, masque,
  // visage non reconnu), l'utilisateur doit pouvoir quitter l'application
  // plutôt que rester enfermé dehors. On lève le verrou ET la préférence :
  // il se reconnectera normalement, par mot de passe ou par code.
  async function abandonner() {
    await AsyncStorage.removeItem(CLE).catch(() => {});
    enFond.current = 0;
    setActif(false);
    setVerrouille(false);
  }

  return (
    <Ctx.Provider value={{ actif, verrouille, activer, desactiver, deverrouiller, abandonner }}>
      {children}
    </Ctx.Provider>
  );
}
