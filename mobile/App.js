// Application mobile ASM — Assistance Sociale Médicale.
// Même plateforme que le site asm-sante.com : mêmes comptes (Supabase),
// mêmes API, même base de données — synchronisation immédiate.
import React, { useEffect } from "react";
import { Text, View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LangueProvider, useLangue } from "./src/i18n";
import { AuthProvider, useAuth } from "./src/auth";
import { VerrouProvider, useVerrou } from "./src/verrou";
import { Bouton } from "./src/ui";
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

// Écran de verrouillage biométrique (si le client l'a activé dans son Profil).
function EcranVerrou() {
  const { t } = useLangue();
  const { deverrouiller } = useVerrou();
  useEffect(() => {
    deverrouiller(t("bio_invite"), t("annuler")); // proposition immédiate à l'ouverture
  }, []); // eslint-disable-line
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.blanc, padding: 28 }}>
      <Text style={{ fontSize: 52 }}>🔒</Text>
      <Text style={{ fontSize: 20, fontWeight: "800", color: C.vertFonce, marginTop: 12, textAlign: "center" }}>{t("bio_verrou_t")}</Text>
      <Text style={{ color: C.gris, marginTop: 8, marginBottom: 22, textAlign: "center", lineHeight: 21 }}>{t("bio_verrou_p")}</Text>
      <Bouton titre={t("bio_deverrouiller")} onPress={() => deverrouiller(t("bio_invite"), t("annuler"))} />
    </View>
  );
}

function Racine() {
  const { pret, user } = useAuth();
  const { t } = useLangue();
  const verrou = useVerrou();

  if (verrou?.actif && verrou?.verrouille && user) return <EcranVerrou />;

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
          <VerrouProvider>
            <StatusBar style="dark" />
            <Racine />
          </VerrouProvider>
        </AuthProvider>
      </LangueProvider>
    </SafeAreaProvider>
  );
}
