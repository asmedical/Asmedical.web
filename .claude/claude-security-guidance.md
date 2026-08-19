# Ce qu'il faut surveiller sur ASM

Plateforme de transport sanitaire et d'aide à domicile. Les données en jeu sont
des données de santé : trajets, adresses de domicile, position en direct,
ordonnances photographiées. Une fuite ici n'est pas un incident technique.

## Le numéro de téléphone

Deux numéros coexistent. `user.phone`, vérifié par code à l'inscription, et
`profil.telephone`, un champ libre que chacun modifie sur son propre compte.

**Un droit d'accès ne se fonde que sur le premier**, via `telephoneVerifie()`
dans `lib/telephones.js`. Signaler toute route qui retrouve, filtre ou autorise
à partir d'un numéro déclaré : il a suffi une fois d'écrire le numéro d'un autre
patient dans son profil pour voir ses trajets, ses préférences et sa position —
et changer sa destination.

Le numéro déclaré reste légitime comme **donnée de contact** : rappeler le
patient, l'afficher sur une fiche. Jamais pour décider.

## Les comptes

Ne jamais créer ni modifier un compte par SQL direct dans `auth.users`. Quatre
colonnes de jetons restent à `NULL`, le service d'authentification les lit comme
du texte, et la connexion échoue avant même de comparer le mot de passe. Passer
par l'API d'administration Supabase.

## Les accès aux demandes

Une demande appartient à un patient. Toute route qui lit ou modifie une demande
doit vérifier ce lien côté serveur, à partir de l'identité de la session — jamais
à partir d'un identifiant ou d'un numéro reçu du client. Cela vaut aussi pour
les proches : leur périmètre vient du rattachement accepté, pas de ce qu'ils
demandent.

## Les secrets

Aucune clé de service, jeton Vercel, clé de compte de service Google ou
`service_role` Supabase dans le dépôt, ni dans `mobile/app.json`, `eas.json` ou
un fichier de test. La clé anonyme Supabase et `EXPO_PUBLIC_*` sont publiques
par construction : elles, c'est normal.

## Les tâches planifiées

Les routes de cron doivent exiger `CRON_SECRET`. Une route de cron ouverte
laisse déclencher des rappels, des relances ou des changements d'état depuis
l'extérieur.

## Le paiement

Le code de test `ASM2026` et la simulation de paiement ne doivent pas se
retrouver actifs en production. Signaler tout chemin qui valide un paiement sans
contrôle réel.
