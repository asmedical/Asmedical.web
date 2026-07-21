# Google Maps — application native Expo (préparation)

Le site web (et donc l'application Google Play actuelle, qui affiche le site)
utilise déjà Google Maps via le serveur. Ce mémo prépare le branchement des
**SDK natifs** pour le jour où l'application Expo remplace la TWA (tâche
« app native + Face ID »).

## Clés à créer dans Google Cloud (console.cloud.google.com → Identifiants)

| Clé | API autorisée | Restriction |
|---|---|---|
| `GOOGLE_MAPS_ANDROID_API_KEY` | Maps SDK for Android | Applications Android : package `com.asm_sante.twa` + empreinte SHA-1 du keystore EAS |
| `GOOGLE_MAPS_IOS_API_KEY` | Maps SDK for iOS | Applications iOS : bundle `com.asmsante.app` |

L'empreinte SHA-1 du build EAS s'obtient avec `eas credentials` (Android →
Keystore). Ne PAS utiliser la clé serveur ni la clé JS dans l'app native.

## Branchement (au moment du build natif)

1. Poser les clés en secrets EAS :
   `eas secret:create --name GOOGLE_MAPS_ANDROID_API_KEY --value …`
   `eas secret:create --name GOOGLE_MAPS_IOS_API_KEY --value …`
2. Convertir `app.json` en `app.config.js` et ajouter :
   ```js
   android: { config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } } },
   ios: { config: { googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY } },
   ```
3. Installer `react-native-maps` (version alignée sur le SDK Expo courant).
4. Les écrans réutilisent les MÊMES routes serveur que le web
   (`/api/geo?type=suggestions|lieu|itineraire|suivi`) : la clé serveur ne
   quitte jamais le serveur, l'app native n'appelle jamais Google en direct
   pour les suggestions/itinéraires — seul l'affichage de la carte utilise
   le SDK natif.

## OAuth Google (Sign-In) — quand vous créerez les clients

- Web Client ID (type Web) → Supabase Auth → Google provider.
- Android Client ID (package + SHA-1), iOS Client ID (bundle).
- Variables : `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`,
  `GOOGLE_IOS_CLIENT_ID` (+ secret côté Supabase uniquement).
- Côté site : `NEXT_PUBLIC_OAUTH_PROVIDERS=google` affiche le bouton
  (le code existe déjà — app/connexion/page.js).
