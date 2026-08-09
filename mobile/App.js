// Application mobile ASM — Assistance Sociale Médicale.
// Même plateforme que le site asm-sante.com : mêmes comptes (Supabase),
// mêmes API, même base de données — synchronisation immédiate.
import React, { useEffect, useState } from "react";
import { Text, View, ActivityIndicator, Linking, TouchableOpacity, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { LangueProvider, useLangue } from "./src/i18n";
import { AuthProvider, useAuth } from "./src/auth";
import { VerrouProvider, useVerrou } from "./src/verrou";
import { Bouton } from "./src/ui";
import { C } from "./src/theme";
import { IcoCalendrier, IcoBulle, IcoPlus, IcoDocumentLignes, IcoPersonne, IcoStethoscope, IcoEtablissement } from "./src/icones";
import { deconnexion } from "./src/supabase";
import Connexion from "./src/screens/Connexion";
import Accueil from "./src/screens/Accueil";
import Reservation from "./src/screens/Reservation";
import MesDemandes from "./src/screens/MesDemandes";
import Suivi from "./src/screens/Suivi";
import Messagerie from "./src/screens/Messagerie";
import Documentation from "./src/screens/Documentation";
import Profil from "./src/screens/Profil";
import Employe from "./src/screens/Employe";
import Pro from "./src/screens/Pro";
import Assistant from "./src/Assistant";

// Rôles — MÊME répartition que le site (app/connexion/page.js). Le serveur
// revérifie de toute façon à chaque appel : ceci ne fait qu'aiguiller vers
// la bonne interface, ce n'est pas un contrôle de sécurité.
const ROLES_EMPLOYE = ["aide_soignant", "infirmier", "chauffeur", "transporteur", "coordinateur", "employe_interne"];
const ROLES_INTERNE = ["superadmin", "admin", "moderateur", "standardiste"];

// Référence de navigation : permet à l'assistant (superposé) d'ouvrir un écran.
const navigationRef = createNavigationContainerRef();
const naviguer = (nom, params) => {
  if (navigationRef.isReady()) navigationRef.navigate(nom, params);
};

const Tabs = createBottomTabNavigator();
const Pile = createNativeStackNavigator();

const THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: C.vert, background: C.blanc, card: C.blanc, border: C.ligne, text: C.encre },
};

// Barre de navigation — MÊME structure que le site : rendez-vous, messages,
// gros bouton central pour réserver, documentation, compte. Les icônes sont
// les mêmes tracés (src/icones.js) : plus d'émojis d'un côté et de dessins
// de l'autre.
function BarreOnglets({ state, navigation, central }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: C.blanc,
        borderTopWidth: 1,
        borderTopColor: C.ligne,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
      }}
    >
      {state.routes.map((route, i) => {
        const focus = state.index === i;
        const onPress = () => {
          const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focus && !ev.defaultPrevented) navigation.navigate(route.name);
        };
        const Ico = ICONES_ONGLET[route.name] || IcoPersonne;
        const estCentral = route.name === central;

        if (estCentral) {
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: focus }}
              accessibilityLabel={LIBELLE_ONGLET[route.name]}
              style={{ flex: 1, alignItems: "center" }}
            >
              <View
                style={{
                  width: 52, height: 52, borderRadius: 26, backgroundColor: C.vert,
                  alignItems: "center", justifyContent: "center", marginTop: -18,
                  shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
                  elevation: 5,
                }}
              >
                <IcoPlus couleur={C.blanc} />
              </View>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focus }}
            accessibilityLabel={LIBELLE_ONGLET[route.name]}
            style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}
          >
            <Ico couleur={focus ? C.vertFonce : C.grisClair} />
            {focus && (
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.vert, marginTop: 4 }} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const ICONES_ONGLET = {
  RendezVous: IcoCalendrier,
  Messages: IcoBulle,
  Reserver: IcoPlus,
  Documents: IcoDocumentLignes,
  MoiTab: IcoPersonne,
  Interventions: IcoStethoscope,
  Etablissement: IcoEtablissement,
};
const LIBELLE_ONGLET = {
  RendezVous: "Rendez-vous", Messages: "Messages", Reserver: "Réserver",
  Documents: "Mes documents", MoiTab: "Mon profil",
  Interventions: "Mes interventions", Etablissement: "Établissement",
};

// Chaque écran d'onglet doit démarrer SOUS la barre d'état : sans cela les
// titres se retrouvaient coupés par l'encoche. On applique la marge dans
// l'écran lui-même plutôt que via une option du navigateur, dont le nom a
// changé d'une version à l'autre de react-navigation.
function avecZoneSure(Composant) {
  return function EcranZoneSure(props) {
    const insets = useSafeAreaInsets();
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: C.blanc }}>
        <Composant {...props} />
      </View>
    );
  };
}

const AccueilZ = avecZoneSure(Accueil);
const MesDemandesZ = avecZoneSure(MesDemandes);
const MessagerieZ = avecZoneSure(Messagerie);
const DocumentationZ = avecZoneSure(Documentation);
const ProfilZ = avecZoneSure(Profil);
const EmployeZ = avecZoneSure(Employe);
const ProZ = avecZoneSure(Pro);

function Onglets() {
  return (
    <Tabs.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(p) => <BarreOnglets {...p} central="Reserver" />}
    >
      <Tabs.Screen name="RendezVous" component={MesDemandesZ} />
      <Tabs.Screen name="Messages" component={MessagerieZ} />
      <Tabs.Screen name="Reserver" component={AccueilZ} />
      <Tabs.Screen name="Documents" component={DocumentationZ} />
      <Tabs.Screen name="MoiTab" component={ProfilZ} />
    </Tabs.Navigator>
  );
}

// Employé de terrain : ses interventions, la messagerie d'équipe, son profil.
// Pas de réservation — ce n'est pas son métier.
function OngletsEmploye() {
  return (
    <Tabs.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(p) => <BarreOnglets {...p} />}
    >
      <Tabs.Screen name="Interventions" component={EmployeZ} />
      <Tabs.Screen name="Messages" component={MessagerieZ} />
      <Tabs.Screen name="MoiTab" component={ProfilZ} />
    </Tabs.Navigator>
  );
}

// Établissement : tableau de bord, demandes, messagerie, profil.
function OngletsPro() {
  return (
    <Tabs.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(p) => <BarreOnglets {...p} />}
    >
      <Tabs.Screen name="Etablissement" component={ProZ} />
      <Tabs.Screen name="RendezVous" component={MesDemandesZ} />
      <Tabs.Screen name="Messages" component={MessagerieZ} />
      <Tabs.Screen name="MoiTab" component={ProfilZ} />
    </Tabs.Navigator>
  );
}

// Comptes internes : l'administration se pilote depuis le site, sur grand
// écran. On le dit clairement — avec une sortie, pour pouvoir se
// reconnecter avec un autre compte.
function EcranAdmin() {
  const { t } = useLangue();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.blanc, padding: 28, paddingTop: insets.top + 28 }}>
      <Text style={{ fontSize: 48 }}>🖥️</Text>
      <Text style={{ fontSize: 20, fontWeight: "800", color: C.vertFonce, marginTop: 12, textAlign: "center" }}>
        {t("role_admin_t")}
      </Text>
      <Text style={{ color: C.gris, marginTop: 8, marginBottom: 22, textAlign: "center", lineHeight: 21 }}>
        {t("role_admin_p")}
      </Text>
      <Bouton titre={t("role_ouvrir_site")} onPress={() => Linking.openURL("https://www.asm-sante.com/admin").catch(() => {})} />
      <View style={{ height: 12 }} />
      <Bouton titre={t("deconnexion")} secondaire onPress={() => deconnexion().catch(() => {})} />
    </View>
  );
}

// Écran de verrouillage biométrique (si le client l'a activé dans son Profil).
// L'invite n'est proposée QU'UNE FOIS automatiquement : si elle échoue, on
// laisse la main plutôt que de relancer sans fin. Une sortie de secours
// évite de rester enfermé dehors quand la biométrie ne passe plus.
function EcranVerrou() {
  const { t } = useLangue();
  const { deverrouiller, abandonner } = useVerrou();
  const insets = useSafeAreaInsets();
  const [essai, setEssai] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      const ok = await deverrouiller(t("bio_invite"), t("annuler"));
      if (!annule && !ok) setEssai(true);
    })();
    return () => { annule = true; };
  }, []); // eslint-disable-line

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.blanc, padding: 28, paddingTop: insets.top + 28 }}>
      <Text style={{ fontSize: 52 }}>🔒</Text>
      <Text style={{ fontSize: 20, fontWeight: "800", color: C.vertFonce, marginTop: 12, textAlign: "center" }}>{t("bio_verrou_t")}</Text>
      <Text style={{ color: C.gris, marginTop: 8, marginBottom: 22, textAlign: "center", lineHeight: 21 }}>{t("bio_verrou_p")}</Text>
      <Bouton titre={t("bio_deverrouiller")} onPress={() => deverrouiller(t("bio_invite"), t("annuler"))} />
      {essai && (
        <>
          <View style={{ height: 12 }} />
          <Bouton titre={t("bio_abandon")} secondaire onPress={abandonner} />
        </>
      )}
    </View>
  );
}

function Racine() {
  const { pret, user, profil } = useAuth();
  const { t } = useLangue();
  const verrou = useVerrou();
  // La bulle de l'assistant est masquée dans la messagerie : elle recouvrait
  // le bouton « Envoyer » et interceptait l'appui, empêchant l'envoi.
  const [route, setRoute] = useState("");

  // C'est le RÔLE du compte qui décide de l'interface — jamais un choix fait
  // dans l'application. Même règle que le site.
  const role = profil?.role || user?.user_metadata?.role || "";
  const estEmploye = ROLES_EMPLOYE.includes(role);
  const estInterne = ROLES_INTERNE.includes(role);
  const estPro = role === "pro";
  const Racines = estEmploye ? OngletsEmploye : estPro ? OngletsPro : Onglets;

  if (verrou?.actif && verrou?.verrouille && user) return <EcranVerrou />;

  if (!pret) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.blanc }}>
        <ActivityIndicator size="large" color={C.vert} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={THEME}
      onReady={() => setRoute(navigationRef.getCurrentRoute()?.name || "")}
      onStateChange={() => setRoute(navigationRef.getCurrentRoute()?.name || "")}
    >
      {user && estInterne ? (
        <EcranAdmin />
      ) : user ? (
        <View style={{ flex: 1 }}>
          <Pile.Navigator
            screenOptions={{
              headerTintColor: C.vertFonce,
              headerTitleStyle: { fontWeight: "800" },
              // Sans cela, le bouton retour affichait « TabsRacine »,
              // le nom technique de l'écran précédent.
              headerBackTitle: t("retour"),
              ...(Platform.OS === "ios" ? { headerBackButtonDisplayMode: "minimal" } : null),
            }}
          >
            <Pile.Screen name="TabsRacine" component={Racines} options={{ headerShown: false, title: "ASM" }} />
            <Pile.Screen name="Reservation" component={Reservation} options={{ title: t("rdv_t") }} />
            <Pile.Screen name="Suivi" component={Suivi} options={{ title: t("suivi_t") }} />
          </Pile.Navigator>
          {/* Assistant IA superposé (bulle flottante) — sauf dans la messagerie. */}
          {route !== "Messages" && <Assistant navigate={naviguer} />}
        </View>
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
