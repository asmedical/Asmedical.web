"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { T } from "@/lib/i18n";

// État global côté client : langue FR/AR, espace choisi (patient/pro),
// connexion simulée (MVP — sera remplacée par une vraie auth OTP),
// service en cours de réservation.
const AsmContexte = createContext(null);

export function AsmProvider({ children }) {
  const [langue, setLangue] = useState("fr");
  const [connecte, setConnecte] = useState(false);
  const [compteType, setCompteType] = useState("patient"); // patient | pro
  const [espaceChoisi, setEspaceChoisi] = useState("patient");
  const [serviceEnCours, setServiceEnCours] = useState(null);

  // Restauration après rechargement
  useEffect(() => {
    try {
      const l = localStorage.getItem("asm_langue");
      if (l === "ar" || l === "fr") setLangue(l);
      const c = sessionStorage.getItem("asm_connecte");
      if (c === "patient" || c === "pro") {
        setConnecte(true);
        setCompteType(c);
        setEspaceChoisi(c);
      }
      const e = sessionStorage.getItem("asm_espace");
      if (e === "patient" || e === "pro") setEspaceChoisi(e);
      const s = sessionStorage.getItem("asm_service");
      if (s) setServiceEnCours(s);
    } catch {}
  }, []);

  // Bascule LTR / RTL sur tout le document
  useEffect(() => {
    document.documentElement.lang = langue;
    document.documentElement.dir = langue === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem("asm_langue", langue);
    } catch {}
  }, [langue]);

  const t = useCallback((cle) => T[langue][cle] ?? T.fr[cle] ?? cle, [langue]);

  const choisirEspace = useCallback((e) => {
    setEspaceChoisi(e);
    try {
      sessionStorage.setItem("asm_espace", e);
    } catch {}
  }, []);

  const choisirService = useCallback((s) => {
    setServiceEnCours(s);
    try {
      if (s) sessionStorage.setItem("asm_service", s);
      else sessionStorage.removeItem("asm_service");
    } catch {}
  }, []);

  const seConnecter = useCallback((type) => {
    setConnecte(true);
    setCompteType(type);
    setEspaceChoisi(type);
    try {
      sessionStorage.setItem("asm_connecte", type);
      sessionStorage.setItem("asm_espace", type);
    } catch {}
  }, []);

  return (
    <AsmContexte.Provider
      value={{
        langue,
        setLangue,
        t,
        connecte,
        compteType,
        espaceChoisi,
        choisirEspace,
        serviceEnCours,
        choisirService,
        seConnecter,
      }}
    >
      {children}
    </AsmContexte.Provider>
  );
}

export function useAsm() {
  return useContext(AsmContexte);
}
