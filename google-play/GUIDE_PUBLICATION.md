# Publier ASM sur Google Play — guide pas à pas

Tout le nécessaire est déjà prêt dans ce dossier :
- `visuels/` : icône 512, bannière 1024×500, 6 captures téléphone au bon format ;
- `fiche-store.md` : tous les textes à copier-coller (nom, descriptions FR/AR) ;
- `donnees-securite.md` : les réponses au questionnaire « Sécurité des données » ;
- la page **https://asm-sante.com/confidentialite** (obligatoire) est en ligne.

## Étape 1 — Créer le compte développeur (≈ 15 min, 25 $ une seule fois)
1. Allez sur **play.google.com/console** et connectez-vous avec un compte Google.
2. Choisissez « Vous-même » (ou « Organisation » si vous avez les papiers de la société —
   recommandé pour une entreprise : nom ASM affiché comme éditeur).
3. Payez les 25 $ (une seule fois, à vie) et complétez la vérification d'identité.

## Étape 2 — Fabriquer l'application Android (≈ 10 min, gratuit, sans code)
1. Allez sur **pwabuilder.com**, entrez `https://asm-sante.com`, lancez l'analyse.
2. Cliquez **Package for stores → Android**.
3. Options à renseigner :
   - App name : `ASM — Assistance Santé Médical` · Short name : `ASM`
   - Package ID : `com.asmsante.app`
   - Version : `1.0.0`
   - Signing key : **Create new** (PWABuilder crée la clé de signature)
4. Téléchargez le paquet : vous obtenez un fichier **.aab** (l'application),
   un fichier **assetlinks.json** et la **clé de signature (.keystore) avec ses mots de passe**.

> ⚠️ **GARDEZ PRÉCIEUSEMENT le fichier de clé et les mots de passe** (coffre, sauvegarde) :
> ils seront exigés pour toute mise à jour de l'application. Ne les envoyez à personne.

## Étape 3 — Relier le site et l'app (5 min)
Pour que l'app s'ouvre en plein écran (sans barre de navigateur), le site doit publier
l'« empreinte » de votre application. C'est déjà codé — il suffit d'une variable :
1. Ouvrez le fichier `assetlinks.json` téléchargé, copiez la valeur
   `sha256_cert_fingerprints` (forme `AA:BB:CC:…`).
2. Dans **Vercel → Settings → Environment Variables**, ajoutez :
   - `ANDROID_ASSETLINKS_SHA256` = l'empreinte copiée
   - (le nom de paquet `com.asmsante.app` est déjà la valeur par défaut)
3. Redéployez, puis vérifiez que **https://asm-sante.com/.well-known/assetlinks.json**
   affiche bien l'empreinte.
4. Plus tard, si la Play Console affiche une **deuxième** empreinte (section
   « Intégrité de l'application » → signature par Google Play), ajoutez-la à la suite,
   séparée par une virgule : `EMPREINTE1,EMPREINTE2`.

## Étape 4 — Créer la fiche dans la Play Console (≈ 30 min)
1. Play Console → **Créer une application** : nom `ASM — Assistance Santé Médical`,
   langue par défaut : Français, application **gratuite**.
2. **Fiche du Play Store** : copiez les textes de `fiche-store.md`, ajoutez :
   - Icône : `visuels/icone-512.png`
   - Bannière : `visuels/feature-graphic-1024x500.png`
   - Captures téléphone : les 6 images `visuels/0x-….png`
3. **Politique de confidentialité** : `https://asm-sante.com/confidentialite`
4. **Sécurité des données** : répondez avec `donnees-securite.md`.
5. **Classification du contenu** : questionnaire standard → application de santé,
   pas de contenu choquant → classification « Tout public / 3+ ».
6. **Audience cible** : 18 ans et plus.
7. **Application de santé** : si la console le demande, déclarez la catégorie
   « services de bien-être / prise en charge » (pas un dispositif médical).

## Étape 5 — Envoyer l'application
1. **Production → Créer une release** (ou « Tests internes » d'abord si vous voulez
   essayer discrètement sur votre téléphone).
2. Glissez le fichier **.aab** téléchargé à l'étape 2, enregistrez, envoyez en validation.
3. La première validation Google prend en général **de 2 à 7 jours**.

## Après la publication
- Installez l'app depuis le Play Store et vérifiez qu'elle s'ouvre **plein écran**
  (si une barre de navigateur apparaît : l'empreinte de l'étape 3 manque ou est incomplète).
- Chaque évolution du site est **automatiquement dans l'app** (c'est le même site) —
  pas de mise à jour Play Store à faire, sauf pour changer l'icône ou le nom.

## Et l'App Store (iPhone) ?
Même principe plus tard : compte Apple Developer (99 $/an) + empaquetage
(PWABuilder propose aussi iOS). En attendant, les utilisateurs iPhone installent
l'application depuis Safari (bannière « Installez l'application ASM » déjà en place).
