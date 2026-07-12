# Application mobile ASM (Expo / React Native)

Vraie application iOS + Android, branchée sur la MÊME plateforme que le site :
mêmes comptes (Supabase), mêmes API (`https://asm-sante.com/api/...`), même base
Railway — une réservation faite dans l'app apparaît instantanément dans l'admin,
et inversement (synchronisation type Leboncoin).

## V1 — espace patient
- Connexion : code SMS / WhatsApp (avec mode test serveur) ou identifiant + mot de passe
- Accueil : les 3 prestations + prochain rendez-vous réel
- Réservation : créneaux temps réel (transport / aide à domicile), fenêtres de livraison à capacité
- Suivi en direct : étapes, intervenant, véhicule (modèle, couleur, plaque), appel direct, avis
- Messagerie temps quasi réel avec l'équipe, notifications, profil, FR/AR

## Lancer en développement
1. `cd mobile && npm install`
2. Copier `.env.example` → `.env` et coller les 2 valeurs publiques Supabase
   (les mêmes que `NEXT_PUBLIC_...` dans Vercel).
3. `npx expo start` puis scanner le QR avec l'app **Expo Go** (App Store / Play Store).

## Builds de production (EAS)
- `npm i -g eas-cli && eas login` (compte Expo gratuit)
- Android : `eas build -p android` — package `com.asm_sante.twa` :
  configurer EAS avec le keystore PWABuilder (credentials → Android → keystore)
  pour publier comme MISE À JOUR de l'app Google Play existante.
- iOS : `eas build -p ios` (nécessite le compte Apple Developer).

## Feuille de route
- Notifications push natives (expo-notifications + route serveur dédiée)
- Connexions Google / Facebook / Apple in-app (expo-auth-session)
- RTL complet pour l'arabe, espace établissement, espace employé
