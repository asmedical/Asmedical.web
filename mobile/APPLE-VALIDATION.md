# Renvoi en validation App Store

Ce fichier sert à deux choses : garder la trace de ce qui a causé le refus,
et donner le texte exact à recoller dans App Store Connect au prochain envoi.

App Store Connect : identifiant d'application `6799295582`,
paquet `com.asmsante.app`, version `1.3.0`.

---

## Ce qui a causé le refus

L'examinateur n'a pas pu se connecter. Le compte de test qui lui avait été
remis n'avait **jamais** accepté une seule connexion depuis sa création :
`last_sign_in_at` était vide.

Le compte avait été créé par un `INSERT` direct dans `auth.users`. Quatre
colonnes de jetons étaient restées à `NULL` alors que le service
d'authentification les lit comme du texte. Il échouait **avant** de comparer
le mot de passe — lequel était correct depuis le début.

Le message d'écran n'a rien laissé voir : « Identifiant ou mot de passe
incorrect » s'affichait pour tout, y compris pour une panne serveur. C'est
ce message qui a caché le problème cinq jours. Il distingue désormais cinq
situations (`mobile/src/authErreurs.js`).

**Ne jamais créer un compte par écriture directe dans `auth.users`.** Passer
par l'API d'administration Supabase, qui remplit ces colonnes.

---

## Vérifications avant de renvoyer

Faites le 18 août 2026, sur la base de production.

| Contrôle | Résultat |
|---|---|
| Le compte d'examen se connecte | oui — `last_sign_in_at` au 16/08 15 h 15 UTC |
| Adresse confirmée, compte non suspendu | oui |
| Colonnes de jetons à `NULL` sur l'ensemble des comptes | aucune, sur 36 comptes |
| Fiche `profil` rattachée au compte | oui — rôle `patient`, Alger-Centre |
| L'écran de connexion ouvre sur identifiant + mot de passe | oui, onglet « connexion » par défaut |
| Une adresse e-mail est acceptée comme identifiant | oui, sans passer par le serveur |
| Suppression de compte engagée depuis l'application | oui — `Profil.js`, exigence 5.1.1(v) |

Requête de contrôle, à rejouer avant chaque envoi :

```sql
select email, last_sign_in_at, email_confirmed_at, banned_until
from auth.users where email = 'apple.review@asm-sante.com';
```

`last_sign_in_at` vide = l'examinateur sera bloqué. Ne pas envoyer.

**Le binaire déjà déposé n'a pas à être recompilé** : le défaut était dans la
base, pas dans l'application.

---

## Compte remis à l'examinateur

```
apple.review@asm-sante.com
```

Le mot de passe n'est pas écrit ici — il vit dans App Store Connect, sous
« Informations pour l'examen de l'app ». Le recopier depuis les notes de
reprise si le champ est vide.

Une réservation demande un numéro de téléphone d'au moins neuf chiffres. La
fiche de ce compte n'en porte aucun : le champ est libre à la saisie, et
l'examinateur peut y mettre ce qu'il veut. Ce n'est pas un blocage, mais
c'est dit dans les notes ci-dessous pour lui éviter de chercher.

---

## Notes d'examen à recoller

À déposer dans App Store Connect → la version → « Informations pour l'examen
de l'app » → « Notes ». En anglais : c'est la langue de lecture des
examinateurs.

```
Thank you for the previous review.

The rejection was caused by a defective test account: it could never sign in,
from the day it was created. The cause was a database record written directly
instead of through the authentication API, which left several columns empty.
The password was correct all along; the server rejected the request before
reading it.

The account has been repaired and a successful sign-in has been verified.
No change to the binary was required, so the same build is resubmitted.

Sign in from the first screen, which opens on the "Connexion" tab:
  Identifier: apple.review@asm-sante.com
  Password:   (see the credentials fields above)

The identifier field accepts an email address, a phone number, or a username.
Use the email address above.

Notes on the app:
- ASM is a medical assistance platform operating in Algiers, Algeria:
  medical transport, home care, and medicine delivery.
- Booking a service asks for a contact phone number of at least nine digits.
  The test account has none on file; any number can be typed into the field.
- Account deletion is initiated inside the app, under Profile. The request is
  reviewed by our team before the record is erased, as the account may hold
  medical documents.
- The app is available in French and Arabic, with right-to-left layout in
  Arabic.
```

---

## Ce qu'il reste à faire à la main

Le renvoi lui-même se fait dans App Store Connect ; aucune commande ne le
déclenche. `eas submit` ne fait que déposer un binaire, or celui-ci est déjà
en place.

1. App Store Connect → l'application → la version refusée
2. Vérifier que le binaire retenu est bien celui déjà déposé
3. Coller les notes ci-dessus, vérifier les deux champs d'identifiants
4. « Ajouter à l'examen » puis « Envoyer à l'examen »
