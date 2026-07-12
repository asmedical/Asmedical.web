// Application mobile ASM — Assistance Santé Médical.
// Même plateforme que le site asm-sante.com : mêmes comptes (Supabase),
// mêmes API, même base de données — synchronisation immédiate.
import React from "react";
import { Text, View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LangueProvider, useLangue } from "./src/i18n";
import { AuthProvider, useAuth } from "./src/auth";
import { C } from "./src/theme";
import Connexion from "./src/screens/Connexion";
import Accueil from "./src/screens/Accueil";
import Reservation from "./src/screens/Reservation";
import MesDemandes from "./src/screens/MesDemandes";
import Suivi from "./src/screens/Suivi";
import Messagerie from "./src/screens/Messagerie";
import Profil from "./src/screens/Profil";

const Tabs = createBottomTabNavigator();
const Pile = createNativeStackNavigator();

const THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: C.vert, background: C.blanc, card: C.blanc, border: C.ligne, text: C.encre },
};

const ICONES = { Accueil: "🏠", RendezVous: "📅", Messages: "💬", MoiTab: "👤" };

function Onglets() {
  const { t } = useLangue();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.vertFonce,
        tabBarInactiveTintColor: C.grisClair,
        tabBarLabelStyle: { fontWeight: "700", fontSize: 11 },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{ICONES[route.name]}</Text>
        ),
      })}
    >
      <Tabs.Screen name="Accueil" component={Accueil} options={{ title: t("tab_accueil") }} />
      <Tabs.Screen name="RendezVous" component={MesDemandes} options={{ title: t("tab_rdv") }} />
      <Tabs.Screen name="Messages" component={Messagerie} options={{ title: t("tab_messages") }} />
      <Tabs.Screen name="MoiTab" component={Profil} options={{ title: t("tab_profil") }} />
    </Tabs.Navigator>
  );
}

function Racine() {
  const { pret, user } = useAuth();
  const { t } = useLangue();

  if (!pret) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.blanc }}>
        <ActivityIndicator size="large" color={C.vert} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={THEME}>
      {user ? (
        <Pile.Navigator screenOptions={{ headerTintColor: C.vertFonce, headerTitleStyle: { fontWeight: "800" } }}>
          <Pile.Screen name="TabsRacine" component={Onglets} options={{ headerShown: false }} />
          <Pile.Screen name="Reservation" component={Reservation} options={{ title: t("rdv_t") }} />
          <Pile.Screen name="Suivi" component={Suivi} options={{ title: t("suivi_t") }} />
        </Pile.Navigator>
      ) : (
        <Pile.Navigator screenOptions={{ headerShown: false }}>
          <Pile.Screen name="Connexion" component={Connexion} />
        </Pile.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LangueProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Racine />
        </AuthProvider>
      </LangueProvider>
    </SafeAreaProvider>
  );
}
