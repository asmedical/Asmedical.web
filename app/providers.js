"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { T } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

// Rôles internes autorisés à accéder à l'espace administration.
const ROLES_INTERNES = ["superadmin", "admin", "moderateur", "standardiste"];

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
  const [roleInterne, setRoleInterne] = useState(""); // "" si client normal
  const [nonLus, setNonLus] = useState({ notifs: 0, chat: 0 }); // cloche + badges

  // Compteurs non lus (notifications + chat) — vraies données uniquement.
  const rafraichirNonLus = useCallback(async () => {
    try {
      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setNonLus({ notifs: 0, chat: 0 });
        return;
      }
      const r = await fetch("/api/notifications?compteur=1", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setNonLus({ notifs: d.notifs || 0, chat: d.chat || 0 });
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!connecte) {
      setNonLus({ notifs: 0, chat: 0 });
      return;
    }
    rafraichirNonLus();
    const minuteur = setInterval(rafraichirNonLus, 30000);
    return () => clearInterval(minuteur);
  }, [connecte, rafraichirNonLus]);

  // Récupère le rôle réel (Supabase) : révèle l'accès admin aux internes ET
  // recale le type de compte sur le rôle réel — un compte patient ne peut
  // pas rester « pro » (et inversement), même après un rechargement.
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        if (!supabase) return;
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || annule) return;
        const { data } = await supabase.from("profil").select("role").eq("id", user.id).maybeSingle();
        if (annule) return;
        const role = data?.role || "";
        setRoleInterne(ROLES_INTERNES.includes(role) ? role : "");
        if (role) {
          const type = role === "pro" ? "pro" : "patient";
          setCompteType(type);
          setEspaceChoisi(type);
          try {
            sessionStorage.setItem("asm_connecte", type);
            sessionStorage.setItem("asm_espace", type);
          } catch {}
        }
      } catch {}
    })();
    return () => {
      annule = true;
    };
  }, [connecte]);

  // Application (PWA) : service worker actif dès la première visite
  // (page de secours hors-ligne + réception des notifications push).
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Filet de sécurité pour le retour des connexions externes (Google, etc.) :
  // si le fournisseur nous a déposés ailleurs que sur /connexion (typiquement
  // l'accueil, via la « Site URL » de Supabase), la session a bien été posée
  // par Supabase (detectSessionInUrl) mais l'aiguillage n'a pas eu lieu. On
  // ramène alors l'utilisateur sur /connexion, où le retour est finalisé et
  // l'utilisateur redirigé selon son rôle. Le drapeau n'existe QUE pendant un
  // retour OAuth (posé par connexionOAuth), donc aucune navigation normale
  // n'est affectée.
  useEffect(() => {
    try {
      if (
        sessionStorage.getItem("asm_oauth_retour") === "1" &&
        window.location.pathname !== "/connexion"
      ) {
        window.location.replace("/connexion");
      }
    } catch {}
  }, []);

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

  // Déconnexion complète : état local + session Supabase.
  const seDeconnecter = useCallback(async () => {
    setConnecte(false);
    setCompteType("patient");
    setEspaceChoisi("patient");
    setServiceEnCours(null);
    setRoleInterne("");
    try {
      sessionStorage.removeItem("asm_connecte");
      sessionStorage.removeItem("asm_espace");
      sessionStorage.removeItem("asm_service");
    } catch {}
    try {
      const { deconnexion } = await import("@/lib/supabase");
      await deconnexion();
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
        seDeconnecter,
        roleInterne,
        estInterne: Boolean(roleInterne),
        nonLus,
        rafraichirNonLus,
      }}
    >
      {children}
    </AsmContexte.Provider>
  );
}

export function useAsm() {
  return useContext(AsmContexte);
}
