// Contexte d'authentification : session Supabase + profil réel.
// La session est partagée avec le site (mêmes comptes, même base).
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, chargerProfil } from "./supabase";

const AuthContexte = createContext({ pret: false, user: null, profil: null, rafraichirProfil: async () => {} });

export function AuthProvider({ children }) {
  const [etat, setEtat] = useState({ pret: false, user: null, profil: null });

  // Le profil est écrit juste APRÈS l'ouverture de session (inscription) :
  // sans relecture explicite, un établissement qui vient de créer son compte
  // atterrirait dans l'espace patient jusqu'au prochain lancement.
  async function rafraichirProfil() {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user || null;
    const profil = user ? await chargerProfil(user.id) : null;
    setEtat({ pret: true, user, profil });
  }

  useEffect(() => {
    if (!supabase) {
      setEtat({ pret: true, user: null, profil: null });
      return;
    }
    let annule = false;

    async function poser(session) {
      const user = session?.user || null;
      const profil = user ? await chargerProfil(user.id) : null;
      if (!annule) setEtat({ pret: true, user, profil });
    }

    supabase.auth.getSession().then(({ data: { session } }) => poser(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => poser(session));
    return () => {
      annule = true;
      subscription?.unsubscribe();
    };
  }, []);

  return <AuthContexte.Provider value={{ ...etat, rafraichirProfil }}>{children}</AuthContexte.Provider>;
}

export const useAuth = () => useContext(AuthContexte);
