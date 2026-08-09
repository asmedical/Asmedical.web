// Contexte d'authentification : session Supabase + profil réel.
// La session est partagée avec le site (mêmes comptes, même base).
import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, chargerProfil } from "./supabase";

const AuthContexte = createContext({ pret: false, user: null, profil: null, rafraichirProfil: async () => {} });

// Dernier profil connu, gardé sur le téléphone. Il ne remplace jamais la
// vérité du serveur : il évite seulement d'attendre le réseau avant
// d'afficher quoi que ce soit.
const CLE_CACHE = "asm_profil";

async function lireCache(userId) {
  try {
    const brut = await AsyncStorage.getItem(CLE_CACHE);
    if (!brut) return null;
    const p = JSON.parse(brut);
    return p && p.id === userId ? p : null;
  } catch {
    return null;
  }
}

async function ecrireCache(profil) {
  try {
    if (profil?.id) await AsyncStorage.setItem(CLE_CACHE, JSON.stringify(profil));
    else await AsyncStorage.removeItem(CLE_CACHE);
  } catch {}
}

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
    await ecrireCache(profil);
    setEtat({ pret: true, user, profil });
  }

  useEffect(() => {
    if (!supabase) {
      setEtat({ pret: true, user: null, profil: null });
      return;
    }
    let annule = false;

    // Le profil décide de l'espace affiché (patient, employé, établissement) :
    // on ne peut donc pas ouvrir l'application avant de le connaître, sous
    // peine de montrer le mauvais espace puis de basculer sous les yeux de
    // l'utilisateur. Mais attendre le réseau à chaque lancement, c'est un
    // écran de chargement de plusieurs secondes en 4G. On affiche donc
    // immédiatement le dernier profil connu, puis on le rafraîchit derrière.
    async function poser(session) {
      const user = session?.user || null;
      if (!user) {
        await ecrireCache(null);
        if (!annule) setEtat({ pret: true, user: null, profil: null });
        return;
      }

      const cache = await lireCache(user.id);
      if (cache && !annule) setEtat({ pret: true, user, profil: cache });

      const profil = await chargerProfil(user.id);
      // Un profil absent (réseau coupé) ne doit pas effacer celui qu'on
      // affiche déjà : mieux vaut une donnée d'hier qu'un écran vide.
      const retenu = profil || cache;
      if (profil) await ecrireCache(profil);
      if (!annule) setEtat({ pret: true, user, profil: retenu });
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
